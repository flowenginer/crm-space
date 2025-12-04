// =====================================================
// SERVIÇO DE CRIAÇÃO DE INSTÂNCIAS WHATSAPP
// Chama Edge Function para evitar CORS
// =====================================================

import { supabase } from '@/integrations/supabase/client';

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
  instanceId: string
): Promise<{ success: boolean; status?: string; state?: string; ownerJid?: string; error?: string }> {
  try {
    console.log('[Instance Creator] Getting status:', { providerCode, instanceId });
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'getStatus',
        providerCode,
        instanceId,
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
