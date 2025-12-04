import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =====================================================
// TIPOS
// =====================================================
interface CreateInstanceRequest {
  action: 'create' | 'qrcode' | 'status' | 'fetchInstances' | 'testConnection' | 'deleteInstance' | 'getStatus';
  providerCode: 'zapi' | 'uazapi' | 'evolution';
  instanceName?: string;
  instanceId?: string;
  instanceToken?: string;
  webhookUrl?: string;
}

interface ProviderConfig {
  baseUrl: string;
  adminToken: string;
  clientToken?: string;
}

// Helper to safely parse JSON response
async function safeJsonParse(response: Response, context: string) {
  const text = await response.text();
  console.log(`[${context}] Raw response (${response.status}):`, text.substring(0, 500));
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
  }
  
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text.substring(0, 200)}`);
  }
}

// Helper to normalize base URL (remove trailing /manager or /manager/)
function normalizeBaseUrl(url: string): string {
  let normalized = url.trim();
  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  // Remove /manager suffix if present (users sometimes add it incorrectly)
  if (normalized.endsWith('/manager')) {
    normalized = normalized.slice(0, -8);
  }
  return normalized;
}

// =====================================================
// Z-API
// =====================================================
async function createZAPIInstance(config: ProviderConfig, instanceName: string, webhookUrl: string) {
  console.log('[Z-API] Creating instance:', instanceName);
  
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
      callRejectMessage: 'No momento não podemos atender ligações.',
      autoReadMessage: false,
    }),
  });

  const data = await safeJsonParse(response, 'Z-API Create');

  if (data.error) {
    return { success: false, error: data.error };
  }

  return {
    success: true,
    instanceId: data.id,
    token: data.token,
  };
}

async function getZAPIQRCode(instanceId: string, token: string, clientToken?: string) {
  console.log('[Z-API] Getting QR code for:', instanceId);
  
  // Check status first
  const statusRes = await fetch(
    `https://api.z-api.io/instances/${instanceId}/token/${token}/status`,
    {
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken || '',
      },
    }
  );
  const statusData = await safeJsonParse(statusRes, 'Z-API Status');

  if (statusData.connected) {
    return { connected: true };
  }

  // Get QR Code
  const qrRes = await fetch(
    `https://api.z-api.io/instances/${instanceId}/token/${token}/qr-code/image`,
    {
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken || '',
      },
    }
  );
  const qrData = await safeJsonParse(qrRes, 'Z-API QR');

  return {
    qrCode: qrData.value,
    connected: false,
  };
}

async function fetchZAPIInstances(config: ProviderConfig) {
  console.log('[Z-API] Fetching all instances');
  // Z-API doesn't have a fetch all instances endpoint in the same way
  // Would need account-level API
  return { success: false, error: 'Z-API não suporta listagem de instâncias via API' };
}

// =====================================================
// UAZAPI (baseado em Evolution API)
// =====================================================
async function createUAZAPIInstance(config: ProviderConfig, instanceName: string, webhookUrl: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[UAZAPI] Creating instance:', instanceName, 'at', baseUrl);
  console.log('[UAZAPI] Token (primeiros 8 chars):', config.adminToken?.substring(0, 8) + '...');
  
  const url = `${baseUrl}/instance/create`;
  console.log('[UAZAPI] Request URL:', url);
  
  const requestBody = {
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
      events: ['QRCODE_UPDATED', 'MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'SEND_MESSAGE'],
    },
  };
  console.log('[UAZAPI] Request body:', JSON.stringify(requestBody));
  
  // UAZAPI usa 'admintoken' como header principal
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'admintoken': config.adminToken,
    },
    body: JSON.stringify(requestBody),
  });

  // If 401, try with 'apikey' header (Evolution API format)
  if (response.status === 401) {
    console.log('[UAZAPI] 401 with admintoken header, trying apikey...');
    const retryResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.adminToken,
      },
      body: JSON.stringify(requestBody),
    });

    if (retryResponse.status === 401) {
      const errorText = await retryResponse.text();
      console.log('[UAZAPI] Still 401 after trying both auth methods:', errorText);
      return { 
        success: false, 
        error: 'Token inválido ou sem permissão. Verifique se o Admin Token está correto.' 
      };
    }

    const data = await safeJsonParse(retryResponse, 'UAZAPI Create (apikey)');
    if (data.error || !data.instance) {
      return { success: false, error: data.error || data.message || 'Falha ao criar instância' };
    }
    return {
      success: true,
      instanceId: data.instance.instanceName || instanceName,
      token: data.hash?.apikey || data.token || config.adminToken,
      qrCode: data.qrcode?.base64,
    };
  }

  const data = await safeJsonParse(response, 'UAZAPI Create');

  if (data.error || !data.instance) {
    return { success: false, error: data.error || data.message || 'Falha ao criar instância' };
  }

  return {
    success: true,
    instanceId: data.instance.instanceName || instanceName,
    token: data.hash?.apikey || data.token || config.adminToken,
    qrCode: data.qrcode?.base64,
  };
}

async function getUAZAPIQRCode(baseUrl: string, instanceName: string, token: string) {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  console.log('[UAZAPI] Getting QR code for:', instanceName, 'at', normalizedUrl);
  
  // UAZAPI usa 'admintoken' para operações administrativas
  const statusRes = await fetch(`${normalizedUrl}/instance/connectionState/${instanceName}`, {
    headers: { 'admintoken': token },
  });
  const statusData = await safeJsonParse(statusRes, 'UAZAPI Status');

  if (statusData.instance?.state === 'open') {
    return { connected: true };
  }

  // Get QR Code
  const qrRes = await fetch(`${normalizedUrl}/instance/qrcode/${instanceName}`, {
    headers: { 'admintoken': token },
  });
  const qrData = await safeJsonParse(qrRes, 'UAZAPI QR');

  return {
    qrCode: qrData.qrcode?.base64 || qrData.base64,
    connected: false,
  };
}

async function fetchUAZAPIInstances(config: ProviderConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[UAZAPI] Fetching all instances from:', baseUrl);
  
  try {
    // UAZAPI usa 'admintoken' como header principal
    const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
      headers: { 'admintoken': config.adminToken },
    });
    
    if (response.status === 401) {
      // Fallback para 'apikey'
      console.log('[UAZAPI] 401 with admintoken, trying apikey...');
      const retryRes = await fetch(`${baseUrl}/instance/fetchInstances`, {
        headers: { 'apikey': config.adminToken },
      });
      
      if (!retryRes.ok) {
        const text = await retryRes.text();
        return { success: false, error: `HTTP ${retryRes.status}: ${text.substring(0, 100)}` };
      }
      
      const data = await retryRes.json();
      return { success: true, instances: data };
    }
    
    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 100)}` };
    }
    
    const data = await response.json();
    return { success: true, instances: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function testUAZAPIConnection(config: ProviderConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[UAZAPI] Testing connection to:', baseUrl);
  
  try {
    // UAZAPI usa 'admintoken' como header principal
    const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
      headers: { 'admintoken': config.adminToken },
    });
    
    console.log('[UAZAPI] Test response status:', response.status);
    
    if (response.status === 401) {
      // Fallback para 'apikey'
      console.log('[UAZAPI] 401 with admintoken, trying apikey...');
      const retryRes = await fetch(`${baseUrl}/instance/fetchInstances`, {
        headers: { 'apikey': config.adminToken },
      });
      
      if (retryRes.status === 401) {
        return { 
          success: false, 
          error: 'Token inválido. Verifique se você está usando o Admin Token correto da sua conta UAZAPI.' 
        };
      }
      
      if (retryRes.ok) {
        const data = await retryRes.json();
        return { success: true, message: `Conexão OK! ${Array.isArray(data) ? data.length : 0} instância(s) encontrada(s).` };
      }
    }
    
    if (response.ok) {
      const data = await response.json();
      return { success: true, message: `Conexão OK! ${Array.isArray(data) ? data.length : 0} instância(s) encontrada(s).` };
    }
    
    const text = await response.text();
    return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 100)}` };
  } catch (err: any) {
    return { success: false, error: `Erro de conexão: ${err.message}` };
  }
}

async function deleteUAZAPIInstance(config: ProviderConfig, instanceName: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[UAZAPI] Deleting instance:', instanceName);
  
  try {
    // UAZAPI usa 'admintoken' como header principal
    const response = await fetch(`${baseUrl}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: { 'admintoken': config.adminToken },
    });
    
    if (response.status === 401) {
      // Fallback para 'apikey'
      console.log('[UAZAPI] 401 with admintoken, trying apikey...');
      const retryRes = await fetch(`${baseUrl}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: { 'apikey': config.adminToken },
      });
      
      if (!retryRes.ok) {
        const text = await retryRes.text();
        return { success: false, error: `HTTP ${retryRes.status}: ${text.substring(0, 100)}` };
      }
      return { success: true };
    }
    
    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 100)}` };
    }
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =====================================================
// EVOLUTION API
// =====================================================
async function createEvolutionInstance(config: ProviderConfig, instanceName: string, webhookUrl: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[Evolution] Creating instance:', instanceName, 'at', baseUrl);
  
  const response = await fetch(`${baseUrl}/instance/create`, {
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
        events: ['QRCODE_UPDATED', 'MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'SEND_MESSAGE'],
      },
    }),
  });

  const data = await safeJsonParse(response, 'Evolution Create');

  if (!data.instance) {
    return { success: false, error: data.message || 'Falha ao criar instância' };
  }

  return {
    success: true,
    instanceId: data.instance.instanceName,
    token: data.hash?.apikey,
    qrCode: data.qrcode?.base64,
  };
}

async function getEvolutionQRCode(baseUrl: string, instanceName: string, apiKey: string) {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  console.log('[Evolution] Getting QR code for:', instanceName, 'at', normalizedUrl);
  
  // Check status
  const statusRes = await fetch(`${normalizedUrl}/instance/connectionState/${instanceName}`, {
    headers: { 'apikey': apiKey },
  });
  const statusData = await safeJsonParse(statusRes, 'Evolution Status');

  if (statusData.instance?.state === 'open') {
    return { connected: true };
  }

  // Get QR Code
  const qrRes = await fetch(`${normalizedUrl}/instance/qrcode/${instanceName}`, {
    headers: { 'apikey': apiKey },
  });
  const qrData = await safeJsonParse(qrRes, 'Evolution QR');

  return {
    qrCode: qrData.qrcode?.base64 || qrData.base64,
    connected: false,
  };
}

async function fetchEvolutionInstances(config: ProviderConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[Evolution] Fetching all instances from:', baseUrl);
  
  try {
    const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
      headers: { 'apikey': config.adminToken },
    });
    
    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 100)}` };
    }
    
    const data = await response.json();
    return { success: true, instances: data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function testEvolutionConnection(config: ProviderConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[Evolution] Testing connection to:', baseUrl);
  
  try {
    const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
      headers: { 'apikey': config.adminToken },
    });
    
    if (response.status === 401) {
      return { success: false, error: 'API Key inválida. Verifique a AUTHENTICATION_API_KEY do servidor Evolution.' };
    }
    
    if (response.ok) {
      const data = await response.json();
      return { success: true, message: `Conexão OK! ${Array.isArray(data) ? data.length : 0} instância(s) encontrada(s).` };
    }
    
    const text = await response.text();
    return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 100)}` };
  } catch (err: any) {
    return { success: false, error: `Erro de conexão: ${err.message}` };
  }
}

async function deleteEvolutionInstance(config: ProviderConfig, instanceName: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[Evolution] Deleting instance:', instanceName);
  
  try {
    const response = await fetch(`${baseUrl}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: { 'apikey': config.adminToken },
    });
    
    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 100)}` };
    }
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =====================================================
// GET INSTANCE STATUS (para verificar conexão sem CORS)
// =====================================================
async function getUAZAPIStatus(config: ProviderConfig, instanceName: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[UAZAPI] Getting status for:', instanceName);
  
  try {
    const response = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
      headers: { 'admintoken': config.adminToken },
    });
    
    if (response.status === 401) {
      const retryRes = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
        headers: { 'apikey': config.adminToken },
      });
      
      if (!retryRes.ok) {
        return { success: false, error: 'Falha ao obter status' };
      }
      
      const data = await retryRes.json();
      const state = data.instance?.state || data.state;
      return { 
        success: true, 
        status: state === 'open' ? 'connected' : 'disconnected',
        state,
        ownerJid: data.instance?.owner || data.ownerJid
      };
    }
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const state = data.instance?.state || data.state;
    return { 
      success: true, 
      status: state === 'open' ? 'connected' : 'disconnected',
      state,
      ownerJid: data.instance?.owner || data.ownerJid
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function getEvolutionStatus(config: ProviderConfig, instanceName: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[Evolution] Getting status for:', instanceName);
  
  try {
    const response = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
      headers: { 'apikey': config.adminToken },
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const state = data.instance?.state || data.state;
    return { 
      success: true, 
      status: state === 'open' ? 'connected' : 'disconnected',
      state,
      ownerJid: data.instance?.owner || data.ownerJid
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =====================================================
// MAIN HANDLER
// =====================================================
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: CreateInstanceRequest = await req.json();
    console.log('[WhatsApp Instance] Request:', body);

    const { action, providerCode, instanceName, instanceId, instanceToken, webhookUrl } = body;

    // Get provider config from database
    const { data: provider, error: providerError } = await supabase
      .from('whatsapp_providers')
      .select('*')
      .eq('code', providerCode)
      .single();

    if (providerError || !provider) {
      console.error('[WhatsApp Instance] Provider not found:', providerError);
      return new Response(
        JSON.stringify({ success: false, error: 'Provedor não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!provider.is_configured || !provider.admin_token) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Provedor ${provider.name} não está configurado. Configure as credenciais em Configurações > Integrações.` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const config: ProviderConfig = {
      baseUrl: provider.base_url,
      adminToken: provider.admin_token,
      clientToken: provider.client_token,
    };

    let result;

    if (action === 'create') {
      // Create new instance
      const finalWebhookUrl = webhookUrl || `${supabaseUrl}/functions/v1/whatsapp-webhook?provider=${providerCode}`;
      
      switch (providerCode) {
        case 'zapi':
          result = await createZAPIInstance(config, instanceName!, finalWebhookUrl);
          break;
        case 'uazapi':
          result = await createUAZAPIInstance(config, instanceName!, finalWebhookUrl);
          break;
        case 'evolution':
          result = await createEvolutionInstance(config, instanceName!, finalWebhookUrl);
          break;
        default:
          result = { success: false, error: 'Provedor desconhecido' };
      }
    } else if (action === 'qrcode') {
      // Get QR code
      switch (providerCode) {
        case 'zapi':
          result = await getZAPIQRCode(instanceId!, instanceToken!, config.clientToken);
          break;
        case 'uazapi':
          result = await getUAZAPIQRCode(config.baseUrl, instanceId!, instanceToken!);
          break;
        case 'evolution':
          result = await getEvolutionQRCode(config.baseUrl, instanceId!, config.adminToken);
          break;
        default:
          result = { success: false, error: 'Provedor desconhecido' };
      }
    } else if (action === 'fetchInstances') {
      // Fetch all instances from provider
      switch (providerCode) {
        case 'zapi':
          result = await fetchZAPIInstances(config);
          break;
        case 'uazapi':
          result = await fetchUAZAPIInstances(config);
          break;
        case 'evolution':
          result = await fetchEvolutionInstances(config);
          break;
        default:
          result = { success: false, error: 'Provedor desconhecido' };
      }
    } else if (action === 'testConnection') {
      // Test connection to provider
      switch (providerCode) {
        case 'zapi':
          result = { success: true, message: 'Z-API não suporta teste de conexão. Tente criar uma instância.' };
          break;
        case 'uazapi':
          result = await testUAZAPIConnection(config);
          break;
        case 'evolution':
          result = await testEvolutionConnection(config);
          break;
        default:
          result = { success: false, error: 'Provedor desconhecido' };
      }
    } else if (action === 'deleteInstance') {
      // Delete instance from provider
      switch (providerCode) {
        case 'zapi':
          result = { success: false, error: 'Z-API não suporta exclusão via API' };
          break;
        case 'uazapi':
          result = await deleteUAZAPIInstance(config, instanceId!);
          break;
        case 'evolution':
          result = await deleteEvolutionInstance(config, instanceId!);
          break;
        default:
          result = { success: false, error: 'Provedor desconhecido' };
      }
    } else if (action === 'getStatus') {
      // Get instance connection status
      switch (providerCode) {
        case 'zapi':
          result = { success: false, error: 'Z-API não suporta verificação de status via esta API' };
          break;
        case 'uazapi':
          result = await getUAZAPIStatus(config, instanceId!);
          break;
        case 'evolution':
          result = await getEvolutionStatus(config, instanceId!);
          break;
        default:
          result = { success: false, error: 'Provedor desconhecido' };
      }
    } else {
      result = { success: false, error: 'Ação inválida' };
    }

    console.log('[WhatsApp Instance] Result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[WhatsApp Instance] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
