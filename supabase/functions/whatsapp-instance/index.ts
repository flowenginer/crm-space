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
  action: 'create' | 'qrcode' | 'status';
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

// =====================================================
// UAZAPI (usa prefixo /manager/ nos endpoints)
// =====================================================
async function createUAZAPIInstance(config: ProviderConfig, instanceName: string, webhookUrl: string) {
  console.log('[UAZAPI] Creating instance:', instanceName, 'at', config.baseUrl);
  console.log('[UAZAPI] Token (primeiros 8 chars):', config.adminToken?.substring(0, 8) + '...');
  
  // UAZAPI usa /manager/ prefix para endpoints de administração
  const url = `${config.baseUrl}/manager/instance/create`;
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
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': config.adminToken,
    },
    body: JSON.stringify(requestBody),
  });

  // If 401, try with Authorization Bearer header
  if (response.status === 401) {
    console.log('[UAZAPI] 401 with apikey header, trying Authorization Bearer...');
    const retryResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.adminToken}`,
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

    const data = await safeJsonParse(retryResponse, 'UAZAPI Create (Bearer)');
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
  console.log('[UAZAPI] Getting QR code for:', instanceName);
  
  // UAZAPI usa /manager/ prefix
  const statusRes = await fetch(`${baseUrl}/manager/instance/connectionState/${instanceName}`, {
    headers: { 'apikey': token },
  });
  const statusData = await safeJsonParse(statusRes, 'UAZAPI Status');

  if (statusData.instance?.state === 'open') {
    return { connected: true };
  }

  // Get QR Code
  const qrRes = await fetch(`${baseUrl}/manager/instance/qrcode/${instanceName}`, {
    headers: { 'apikey': token },
  });
  const qrData = await safeJsonParse(qrRes, 'UAZAPI QR');

  return {
    qrCode: qrData.qrcode?.base64 || qrData.base64,
    connected: false,
  };
}

// =====================================================
// EVOLUTION API
// =====================================================
async function createEvolutionInstance(config: ProviderConfig, instanceName: string, webhookUrl: string) {
  console.log('[Evolution] Creating instance:', instanceName, 'at', config.baseUrl);
  
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
  console.log('[Evolution] Getting QR code for:', instanceName);
  
  // Check status
  const statusRes = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
    headers: { 'apikey': apiKey },
  });
  const statusData = await safeJsonParse(statusRes, 'Evolution Status');

  if (statusData.instance?.state === 'open') {
    return { connected: true };
  }

  // Get QR Code
  const qrRes = await fetch(`${baseUrl}/instance/qrcode/${instanceName}`, {
    headers: { 'apikey': apiKey },
  });
  const qrData = await safeJsonParse(qrRes, 'Evolution QR');

  return {
    qrCode: qrData.qrcode?.base64 || qrData.base64,
    connected: false,
  };
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
