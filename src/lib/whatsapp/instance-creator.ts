// =====================================================
// SERVIÇO DE CRIAÇÃO DE INSTÂNCIAS WHATSAPP
// Z-API, UAZAPI e Evolution API
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

// =====================================================
// Z-API - CRIAR INSTÂNCIA
// =====================================================
export async function createZAPIInstance(
  config: ProviderConfig,
  instanceName: string,
  webhookUrl: string
): Promise<CreateInstanceResult> {
  try {
    // Z-API usa endpoint de integrador para criar instâncias
    const response = await fetch('https://api.z-api.io/instances/integrator/on-demand', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': config.clientToken || '',
      },
      body: JSON.stringify({
        name: instanceName,
        deliveryCallbackUrl: webhookUrl,
        receivedCallbackUrl: webhookUrl,
        disconnectedCallbackUrl: webhookUrl,
        connectedCallbackUrl: webhookUrl,
        messageStatusCallbackUrl: webhookUrl,
        callRejectAuto: true,
        callRejectMessage: 'No momento não podemos atender ligações. Por favor, envie uma mensagem.',
        autoReadMessage: false,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error };
    }

    return {
      success: true,
      instanceId: data.id,
      token: data.token,
    };
  } catch (error: any) {
    console.error('[Z-API] Create instance error:', error);
    return { success: false, error: error.message };
  }
}

// Buscar QR Code da instância Z-API
export async function getZAPIQRCode(
  instanceId: string,
  token: string,
  clientToken?: string
): Promise<{ qrCode?: string; connected?: boolean }> {
  try {
    // Primeiro verifica se já está conectado
    const statusRes = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/status`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': clientToken || '',
        },
      }
    );
    const statusData = await statusRes.json();

    if (statusData.connected) {
      return { connected: true };
    }

    // Busca QR Code
    const qrRes = await fetch(
      `https://api.z-api.io/instances/${instanceId}/token/${token}/qr-code/image`,
      {
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': clientToken || '',
        },
      }
    );
    const qrData = await qrRes.json();

    return {
      qrCode: qrData.value,
      connected: false,
    };
  } catch (error) {
    console.error('[Z-API] Get QR Code error:', error);
    return {};
  }
}

// =====================================================
// UAZAPI - CRIAR INSTÂNCIA
// =====================================================
export async function createUAZAPIInstance(
  config: ProviderConfig,
  instanceName: string,
  webhookUrl: string
): Promise<CreateInstanceResult> {
  try {
    const response = await fetch(`${config.baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.adminToken}`,
        'apikey': config.adminToken,
      },
      body: JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
        webhook: {
          url: webhookUrl,
          enabled: true,
          events: [
            'QRCODE_UPDATED',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'CONNECTION_UPDATE',
          ],
        },
      }),
    });

    const data = await response.json();

    if (data.error || !data.instance) {
      return { success: false, error: data.error || 'Falha ao criar instância' };
    }

    return {
      success: true,
      instanceId: data.instance.instanceName || instanceName,
      token: data.hash?.apikey || data.token,
      qrCode: data.qrcode?.base64,
    };
  } catch (error: any) {
    console.error('[UAZAPI] Create instance error:', error);
    return { success: false, error: error.message };
  }
}

// Buscar QR Code da instância UAZAPI
export async function getUAZAPIQRCode(
  baseUrl: string,
  instanceName: string,
  token: string
): Promise<{ qrCode?: string; connected?: boolean }> {
  try {
    const statusRes = await fetch(
      `${baseUrl}/instance/connectionState/${instanceName}`,
      {
        headers: {
          'apikey': token,
        },
      }
    );
    const statusData = await statusRes.json();

    if (statusData.instance?.state === 'open') {
      return { connected: true };
    }

    const qrRes = await fetch(
      `${baseUrl}/instance/qrcode/${instanceName}`,
      {
        headers: {
          'apikey': token,
        },
      }
    );
    const qrData = await qrRes.json();

    return {
      qrCode: qrData.qrcode?.base64 || qrData.base64,
      connected: false,
    };
  } catch (error) {
    console.error('[UAZAPI] Get QR Code error:', error);
    return {};
  }
}

// =====================================================
// EVOLUTION API - CRIAR INSTÂNCIA
// =====================================================
export async function createEvolutionInstance(
  config: ProviderConfig,
  instanceName: string,
  webhookUrl: string
): Promise<CreateInstanceResult> {
  try {
    const response = await fetch(`${config.baseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.adminToken,
      },
      body: JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        rejectCall: true,
        msgCall: 'No momento não podemos atender ligações.',
        groupsIgnore: false,
        alwaysOnline: false,
        readMessages: false,
        readStatus: false,
        syncFullHistory: false,
        webhook: {
          url: webhookUrl,
          byEvents: false,
          base64: true,
          events: [
            'QRCODE_UPDATED',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'CONNECTION_UPDATE',
            'SEND_MESSAGE',
          ],
        },
      }),
    });

    const data = await response.json();

    if (!data.instance) {
      return { success: false, error: data.message || 'Falha ao criar instância' };
    }

    return {
      success: true,
      instanceId: data.instance.instanceName,
      token: data.hash?.apikey,
      qrCode: data.qrcode?.base64,
    };
  } catch (error: any) {
    console.error('[Evolution] Create instance error:', error);
    return { success: false, error: error.message };
  }
}

// Buscar QR Code da instância Evolution
export async function getEvolutionQRCode(
  baseUrl: string,
  instanceName: string,
  apiKey: string
): Promise<{ qrCode?: string; connected?: boolean }> {
  try {
    const statusRes = await fetch(
      `${baseUrl}/instance/connectionState/${instanceName}`,
      {
        headers: {
          'apikey': apiKey,
        },
      }
    );
    const statusData = await statusRes.json();

    if (statusData.instance?.state === 'open') {
      return { connected: true };
    }

    const qrRes = await fetch(
      `${baseUrl}/instance/qrcode/${instanceName}`,
      {
        headers: {
          'apikey': apiKey,
        },
      }
    );
    const qrData = await qrRes.json();

    return {
      qrCode: qrData.qrcode?.base64 || qrData.base64,
      connected: false,
    };
  } catch (error) {
    console.error('[Evolution] Get QR Code error:', error);
    return {};
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
  // Buscar configuração do provedor
  const { data: provider, error } = await supabase
    .from('whatsapp_providers')
    .select('*')
    .eq('code', providerCode)
    .single();

  if (error || !provider) {
    return { success: false, error: 'Provedor não encontrado' };
  }

  // Type assertion for the new fields
  const providerData = provider as typeof provider & {
    admin_token?: string;
    client_token?: string;
    is_configured?: boolean;
  };

  if (!providerData.is_configured || !providerData.admin_token) {
    return { 
      success: false, 
      error: `Provedor ${provider.name} não está configurado. Configure as credenciais em Configurações > Integrações.` 
    };
  }

  const config: ProviderConfig = {
    baseUrl: provider.base_url,
    adminToken: providerData.admin_token,
    clientToken: providerData.client_token,
  };

  // Webhook URL específico para cada provedor
  const webhookUrl = `${webhookBaseUrl}/functions/v1/whatsapp-webhook?provider=${providerCode}`;

  switch (providerCode) {
    case 'zapi':
      return createZAPIInstance(config, instanceName, webhookUrl);
    case 'uazapi':
      return createUAZAPIInstance(config, instanceName, webhookUrl);
    case 'evolution':
      return createEvolutionInstance(config, instanceName, webhookUrl);
    default:
      return { success: false, error: 'Provedor desconhecido' };
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
  const { data: provider } = await supabase
    .from('whatsapp_providers')
    .select('*')
    .eq('code', providerCode)
    .single();

  if (!provider) {
    return {};
  }

  const providerData = provider as typeof provider & {
    admin_token?: string;
    client_token?: string;
  };

  switch (providerCode) {
    case 'zapi':
      return getZAPIQRCode(instanceId, token, providerData.client_token);
    case 'uazapi':
      return getUAZAPIQRCode(provider.base_url, instanceId, token);
    case 'evolution':
      return getEvolutionQRCode(provider.base_url, instanceId, providerData.admin_token || '');
    default:
      return {};
  }
}
