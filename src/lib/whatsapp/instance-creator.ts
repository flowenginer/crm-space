// =====================================================
// SERVIÇO DE CRIAÇÃO DE INSTÂNCIAS WHATSAPP
// Chama Edge Function para evitar CORS
// =====================================================

import { supabase } from '@/integrations/supabase/client';

// =====================================================
// CACHE DE TIPO DE CANAL (OPTIMIZATION)
// Evita queries repetidas ao banco para cada mensagem
// TTL de 5 minutos
// =====================================================
const channelTypeCache = new Map<string, { type: string; timestamp: number }>();
const CHANNEL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getChannelType(channelId: string): Promise<string | null> {
  const now = Date.now();
  const cached = channelTypeCache.get(channelId);
  
  // Return cached value if still valid
  if (cached && (now - cached.timestamp) < CHANNEL_CACHE_TTL) {
    console.log('[Instance Creator] Using cached channel type:', cached.type);
    return cached.type;
  }
  
  // Fetch from database
  const { data: channel, error } = await supabase
    .from('whatsapp_channels')
    .select('type')
    .eq('id', channelId)
    .single();
  
  if (error || !channel) {
    console.error('[Instance Creator] Channel lookup error:', error);
    return null;
  }
  
  // Cache the result
  channelTypeCache.set(channelId, { type: channel.type, timestamp: now });
  console.log('[Instance Creator] Cached channel type:', channel.type);
  
  return channel.type;
}

// Clear stale cache entries periodically (cleanup)
function cleanupChannelCache() {
  const now = Date.now();
  for (const [key, value] of channelTypeCache.entries()) {
    if (now - value.timestamp > CHANNEL_CACHE_TTL) {
      channelTypeCache.delete(key);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupChannelCache, 10 * 60 * 1000);

// =====================================================
// TIPOS
// =====================================================
export interface CreateInstanceResult {
  success: boolean;
  instanceId?: string;
  token?: string;
  qrCode?: string;
  error?: string;
}

export interface ProviderConfig {
  baseUrl: string;
  adminToken: string;
  clientToken?: string;
}

export interface ProviderInstance {
  instanceName: string;
  instanceId?: string;
  owner?: string;
  ownerJid?: string;
  profileName?: string;
  profilePicUrl?: string;
  status?: string;
  connectionStatus?: string | {
    state?: string;
  };
  instance?: {
    instanceName?: string;
    instanceId?: string;
    owner?: string;
    profileName?: string;
    profilePictureUrl?: string;
    state?: string;
  };
}

// =====================================================
// FUNÇÃO UNIFICADA - ENVIAR MENSAGEM VIA EDGE FUNCTION
// Detecta automaticamente o tipo de canal (cloudapi vs outros)
// =====================================================
export async function sendWhatsAppMessage(
  channelId: string,
  phone: string,
  content: string,
  type: 'text' | 'image' | 'audio' | 'video' | 'document' = 'text',
  mediaUrl?: string,
  quotedMessageId?: string,
  filename?: string,
  conversationId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    console.log('[Instance Creator] Sending message:', { channelId, phone, type, quotedMessageId, filename, conversationId });
    
    // OPTIMIZATION: Use cached channel type to avoid database query on every message
    const channelType = await getChannelType(channelId);
    
    if (!channelType) {
      return { success: false, error: 'Canal não encontrado' };
    }
    
    console.log('[Instance Creator] Channel type:', channelType);
    
    // Use different edge function based on channel type
    // "official" = API Oficial (Cloud API)
    if (channelType === 'cloudapi' || channelType === 'official') {
      // CloudAPI (Official WhatsApp API) uses cloudapi-send-message
      const { data, error } = await supabase.functions.invoke('cloudapi-send-message', {
        body: {
          channelId,
          phone,
          type,
          content,
          mediaUrl,
          caption: type !== 'text' ? content : undefined,
          filename,
          conversationId,
        },
      });

      console.log('[Instance Creator] CloudAPI Send Response:', data, error);

      if (error) {
        return { success: false, error: error.message || 'Erro ao enviar mensagem via CloudAPI' };
      }

      return data as { success: boolean; messageId?: string; error?: string };
    } else if (channelType === 'instagram') {
      // Instagram Direct uses instagram-send-message
      // Instagram supports audio in aac, m4a, wav, mp4 (NOT mp3)
      const igType = type === 'document' ? 'file' : type;
      const { data, error } = await supabase.functions.invoke('instagram-send-message', {
        body: {
          channelId,
          recipientId: phone, // For Instagram, "phone" is actually "ig:IGSID"
          type: igType,
          content,
          mediaUrl,
          conversationId,
          mimeType: type === 'audio' ? 'audio/wav' : undefined,
        },
      });

      console.log('[Instance Creator] Instagram Send Response:', data, error);

      if (error) {
        return { success: false, error: error.message || 'Erro ao enviar mensagem via Instagram' };
      }

      return data as { success: boolean; messageId?: string; error?: string };
    } else {
      // Regular providers (zapi, uazapi, evolution) use whatsapp-instance
      const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
        body: {
          action: 'send',
          channelId,
          phone,
          content,
          type,
          mediaUrl,
          quotedMessageId,
          filename,
        },
      });

      console.log('[Instance Creator] WhatsApp Instance Send Response:', data, error);

      if (error) {
        return { success: false, error: error.message || 'Erro ao enviar mensagem' };
      }

      return data as { success: boolean; messageId?: string; error?: string };
    }
  } catch (error: any) {
    console.error('[Instance Creator] Send Error:', error);
    return { success: false, error: error.message || 'Erro ao enviar mensagem' };
  }
}

// =====================================================
// FUNÇÃO UNIFICADA - CRIAR INSTÂNCIA
// =====================================================
export async function createWhatsAppInstance(
  providerCode: 'zapi' | 'uazapi' | 'evolution',
  instanceName: string,
  webhookBaseUrl: string
): Promise<CreateInstanceResult> {
  try {
    console.log('[Instance Creator] Creating instance:', { providerCode, instanceName });
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'create',
        providerCode,
        instanceName,
        webhookUrl: `${webhookBaseUrl}/functions/v1/whatsapp-webhook?provider=${providerCode}`,
      },
    });

    console.log('[Instance Creator] Response:', data, error);

    if (error) {
      return { success: false, error: error.message || 'Erro ao criar instância' };
    }

    return data as CreateInstanceResult;
  } catch (error: any) {
    console.error('[Instance Creator] Error:', error);
    return { success: false, error: error.message || 'Erro ao criar instância' };
  }
}

// =====================================================
// FUNÇÃO UNIFICADA - BUSCAR QR CODE
// =====================================================
export async function getWhatsAppQRCode(
  providerCode: 'zapi' | 'uazapi' | 'evolution',
  instanceId: string,
  token: string
): Promise<{ qrCode?: string; connected?: boolean }> {
  try {
    console.log('[Instance Creator] Getting QR code:', { providerCode, instanceId });
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'qrcode',
        providerCode,
        instanceId,
        instanceToken: token,
      },
    });

    console.log('[Instance Creator] QR Response:', data, error);

    if (error) {
      console.error('[Instance Creator] QR Error:', error);
      return {};
    }

    return data as { qrCode?: string; connected?: boolean };
  } catch (error: any) {
    console.error('[Instance Creator] Error:', error);
    return {};
  }
}

// =====================================================
// FUNÇÃO UNIFICADA - BUSCAR TODAS AS INSTÂNCIAS
// =====================================================
export async function fetchProviderInstances(
  providerCode: 'zapi' | 'uazapi' | 'evolution'
): Promise<{ success: boolean; instances?: ProviderInstance[]; error?: string }> {
  try {
    console.log('[Instance Creator] Fetching instances for:', providerCode);
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'fetchInstances',
        providerCode,
      },
    });

    console.log('[Instance Creator] Fetch Instances Response:', data, error);

    if (error) {
      return { success: false, error: error.message || 'Erro ao buscar instâncias' };
    }

    return data as { success: boolean; instances?: ProviderInstance[]; error?: string };
  } catch (error: any) {
    console.error('[Instance Creator] Error:', error);
    return { success: false, error: error.message || 'Erro ao buscar instâncias' };
  }
}

// =====================================================
// FUNÇÃO UNIFICADA - TESTAR CONEXÃO
// =====================================================
export async function testProviderConnection(
  providerCode: 'zapi' | 'uazapi' | 'evolution'
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('[Instance Creator] Testing connection for:', providerCode);
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'testConnection',
        providerCode,
      },
    });

    console.log('[Instance Creator] Test Connection Response:', data, error);

    if (error) {
      return { success: false, error: error.message || 'Erro ao testar conexão' };
    }

    return data as { success: boolean; message?: string; error?: string };
  } catch (error: any) {
    console.error('[Instance Creator] Error:', error);
    return { success: false, error: error.message || 'Erro ao testar conexão' };
  }
}

// =====================================================
// FUNÇÃO UNIFICADA - EXCLUIR INSTÂNCIA DO PROVEDOR
// =====================================================
export async function deleteProviderInstance(
  providerCode: 'zapi' | 'uazapi' | 'evolution',
  instanceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Instance Creator] Deleting instance:', { providerCode, instanceId });
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'deleteInstance',
        providerCode,
        instanceId,
      },
    });

    console.log('[Instance Creator] Delete Instance Response:', data, error);

    if (error) {
      return { success: false, error: error.message || 'Erro ao excluir instância' };
    }

    return data as { success: boolean; error?: string };
  } catch (error: any) {
    console.error('[Instance Creator] Error:', error);
    return { success: false, error: error.message || 'Erro ao excluir instância' };
  }
}

// =====================================================
// FUNÇÃO UNIFICADA - OBTER STATUS DA INSTÂNCIA
// =====================================================
export async function getInstanceStatus(
  providerCode: 'zapi' | 'uazapi' | 'evolution',
  instanceId: string,
  instanceToken?: string
): Promise<{ success: boolean; status?: string; state?: string; ownerJid?: string; error?: string }> {
  try {
    console.log('[Instance Creator] Getting status:', { providerCode, instanceId, hasToken: !!instanceToken });
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'getStatus',
        providerCode,
        instanceId,
        instanceToken,
      },
    });

    console.log('[Instance Creator] Get Status Response:', data, error);

    if (error) {
      return { success: false, error: error.message || 'Erro ao obter status' };
    }

    return data as { success: boolean; status?: string; state?: string; ownerJid?: string; error?: string };
  } catch (error: any) {
    console.error('[Instance Creator] Error:', error);
    return { success: false, error: error.message || 'Erro ao obter status' };
  }
}

// =====================================================
// FUNÇÃO - RECONFIGURAR WEBHOOK DE INSTÂNCIA EXISTENTE (legacy)
// =====================================================
export async function setChannelWebhook(
  providerCode: 'zapi' | 'uazapi' | 'evolution',
  instanceId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('[Instance Creator] Setting webhook:', { providerCode, instanceId });
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'setWebhook',
        providerCode,
        instanceId,
      },
    });

    console.log('[Instance Creator] SetWebhook Response:', data, error);

    if (error) {
      return { success: false, error: error.message || 'Erro ao configurar webhook' };
    }

    return data as { success: boolean; message?: string; error?: string };
  } catch (error: any) {
    console.error('[Instance Creator] SetWebhook Error:', error);
    return { success: false, error: error.message || 'Erro ao configurar webhook' };
  }
}

// =====================================================
// FUNÇÃO - RECONFIGURAR WEBHOOK POR CHANNEL ID (nova versão)
// =====================================================
export async function reconfigureChannelWebhook(
  channelId: string
): Promise<{ success: boolean; message?: string; webhookUrl?: string; error?: string }> {
  try {
    console.log('[Instance Creator] Reconfiguring webhook for channel:', channelId);
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'reconfigureWebhook',
        channelId,
      },
    });

    console.log('[Instance Creator] ReconfigureWebhook Response:', data, error);

    if (error) {
      return { success: false, error: error.message || 'Erro ao reconfigurar webhook' };
    }

    return data as { success: boolean; message?: string; webhookUrl?: string; error?: string };
  } catch (error: any) {
    console.error('[Instance Creator] ReconfigureWebhook Error:', error);
    return { success: false, error: error.message || 'Erro ao reconfigurar webhook' };
  }
}

// =====================================================
// FUNÇÃO - BUSCAR FOTO DO PERFIL DO CONTATO
// =====================================================
export async function fetchContactProfile(
  channelId: string,
  phone: string
): Promise<{ success: boolean; profilePictureUrl?: string | null; name?: string | null; error?: string }> {
  try {
    console.log('[Instance Creator] Fetching contact profile:', { channelId, phone });

    // OPTIMIZATION: Use cached channel type
    const channelType = await getChannelType(channelId);

    if (!channelType) {
      console.error('[Instance Creator] Channel lookup error (fetchContactProfile)');
      return { success: false, error: 'Canal não encontrado' };
    }

    // CloudAPI (API Oficial) não fornece foto/nome do contato via API do provedor.
    // Então evitamos chamar whatsapp-instance (que exige provider configurado) e retornamos vazio.
    if (channelType === 'cloudapi' || channelType === 'official' || channelType === 'instagram') {
      return { success: true, profilePictureUrl: null, name: null };
    }

    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'fetchProfile',
        channelId,
        phone,
      },
    });

    console.log('[Instance Creator] FetchProfile Response:', data, error);

    if (error) {
      return { success: false, error: error.message || 'Erro ao buscar perfil' };
    }

    return data as { success: boolean; profilePictureUrl?: string | null; name?: string | null; error?: string };
  } catch (error: any) {
    console.error('[Instance Creator] FetchProfile Error:', error);
    return { success: false, error: error.message || 'Erro ao buscar perfil' };
  }
}

// =====================================================
// FUNÇÃO - BUSCAR CONFIGURAÇÃO ATUAL DO WEBHOOK
// =====================================================
export async function fetchChannelWebhook(
  providerCode: 'zapi' | 'uazapi' | 'evolution',
  instanceId: string
): Promise<{ success: boolean; enabled?: boolean; url?: string; events?: string[]; error?: string }> {
  try {
    console.log('[Instance Creator] Fetching webhook config:', { providerCode, instanceId });
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'fetchWebhook',
        providerCode,
        instanceId,
      },
    });

    console.log('[Instance Creator] FetchWebhook Response:', data, error);

    if (error) {
      return { success: false, error: error.message || 'Erro ao buscar webhook' };
    }

    return data;
  } catch (error: any) {
    console.error('[Instance Creator] FetchWebhook Error:', error);
    return { success: false, error: error.message || 'Erro ao buscar webhook' };
  }
}

// =====================================================
// FUNÇÃO - REINICIAR INSTÂNCIA
// =====================================================
export async function restartChannelInstance(
  providerCode: 'zapi' | 'uazapi' | 'evolution',
  instanceId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('[Instance Creator] Restarting instance:', { providerCode, instanceId });
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'restartInstance',
        providerCode,
        instanceId,
      },
    });

    console.log('[Instance Creator] RestartInstance Response:', data, error);

    if (error) {
      return { success: false, error: error.message || 'Erro ao reiniciar instância' };
    }

    return data;
  } catch (error: any) {
    console.error('[Instance Creator] RestartInstance Error:', error);
    return { success: false, error: error.message || 'Erro ao reiniciar instância' };
  }
}

// =====================================================
// FUNÇÃO - CONFIGURAÇÃO COMPLETA DO CANAL
// =====================================================
export async function configureChannelFull(
  providerCode: 'zapi' | 'uazapi' | 'evolution',
  instanceId: string
): Promise<{ 
  success: boolean; 
  message?: string; 
  steps?: any[]; 
  webhookEnabled?: boolean;
  webhookUrl?: string;
  webhookEvents?: string[];
  messagesUpsertActive?: boolean;
  error?: string 
}> {
  try {
    console.log('[Instance Creator] Full channel configuration:', { providerCode, instanceId });
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'configureChannel',
        providerCode,
        instanceId,
      },
    });

    console.log('[Instance Creator] ConfigureChannel Response:', data, error);

    if (error) {
      return { success: false, error: error.message || 'Erro ao configurar canal' };
    }

    return data;
  } catch (error: any) {
    console.error('[Instance Creator] ConfigureChannel Error:', error);
    return { success: false, error: error.message || 'Erro ao configurar canal' };
  }
}

// =====================================================
// FUNÇÃO - SINCRONIZAR STATUS DO CANAL
// =====================================================
export async function syncChannelStatus(
  channelId: string
): Promise<{ success: boolean; status?: string; phone?: string; message?: string; error?: string }> {
  try {
    console.log('[Instance Creator] Syncing status for channel:', channelId);
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'syncStatus',
        channelId,
      },
    });

    console.log('[Instance Creator] SyncStatus Response:', data, error);

    if (error) {
      return { success: false, error: error.message || 'Erro ao sincronizar status' };
    }

    return data;
  } catch (error: any) {
    console.error('[Instance Creator] SyncStatus Error:', error);
    return { success: false, error: error.message || 'Erro ao sincronizar status' };
  }
}

// =====================================================
// FUNÇÃO - LOGOUT DE INSTÂNCIA (RESET ESTADO TRAVADO)
// =====================================================
export async function logoutChannelInstance(
  channelId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('[Instance Creator] Logging out instance for channel:', channelId);
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'logoutInstance',
        channelId,
      },
    });

    console.log('[Instance Creator] LogoutInstance Response:', data, error);

    if (error) {
      return { success: false, error: error.message || 'Erro ao fazer logout da instância' };
    }

    return data;
  } catch (error: any) {
    console.error('[Instance Creator] LogoutInstance Error:', error);
    return { success: false, error: error.message || 'Erro ao fazer logout da instância' };
  }
}

// =====================================================
// FUNÇÃO - MARCAR MENSAGENS COMO LIDAS NO WHATSAPP
// Envia duplo check azul para o lead (APIs não oficiais)
// =====================================================
export async function markMessagesAsReadOnWhatsApp(
  channelId: string,
  conversationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Instance Creator] Marking messages as read on WhatsApp:', { channelId, conversationId });

    // Verificar se é canal não-oficial (só esses precisam do markAsRead)
    const channelType = await getChannelType(channelId);
    if (!channelType || channelType === 'cloudapi' || channelType === 'official' || channelType === 'instagram') {
      console.log('[Instance Creator] Skipping markAsRead for official API channel');
      return { success: true };
    }

    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'markAsRead',
        channelId,
        conversationId,
      },
    });

    if (error) {
      console.error('[Instance Creator] MarkAsRead error:', error);
      return { success: false, error: error.message };
    }

    console.log('[Instance Creator] MarkAsRead response:', data);
    return data as { success: boolean; error?: string };
  } catch (error: any) {
    console.error('[Instance Creator] MarkAsRead Error:', error);
    return { success: false, error: error.message };
  }
}
