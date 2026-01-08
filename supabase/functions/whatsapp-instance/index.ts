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
  action: 'create' | 'qrcode' | 'status' | 'fetchInstances' | 'testConnection' | 'deleteInstance' | 'getStatus' | 'send' | 'fetchProfile' | 'setWebhook' | 'fetchWebhook' | 'restartInstance' | 'setSettings' | 'configureChannel' | 'deleteMessage' | 'editMessage' | 'sendReaction' | 'reconfigureWebhook' | 'syncStatus' | 'logoutInstance';
  providerCode?: 'zapi' | 'uazapi' | 'evolution';
  instanceName?: string;
  instanceId?: string;
  instanceToken?: string;
  webhookUrl?: string;
  // For send action
  channelId?: string;
  phone?: string;
  content?: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'document';
  mediaUrl?: string;
  quotedMessageId?: string;
  filename?: string;  // Nome do arquivo para documentos
  // For deleteMessage/editMessage action
  whatsappMessageId?: string;
  remoteJid?: string;
  newText?: string;
  // For sendReaction action
  emoji?: string;
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
// SEND MESSAGE FUNCTIONS
// =====================================================
async function sendEvolutionMessage(
  baseUrl: string,
  instanceName: string,
  apiKey: string,
  phone: string,
  content: string,
  type: string,
  mediaUrl?: string,
  quotedMessageId?: string,
  filename?: string
) {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  const formattedPhone = phone.replace(/\D/g, '') + '@s.whatsapp.net';
  
  console.log('[Evolution] Sending message:', { instanceName, phone: formattedPhone, type, quotedMessageId });
  
  // Helper to build request body
  const buildBody = (includeQuote: boolean) => {
    const quotedContext = (includeQuote && quotedMessageId) ? {
      quoted: {
        key: {
          remoteJid: formattedPhone,
          id: quotedMessageId
        }
      }
    } : {};
    
    if (type === 'text') {
      return {
        number: formattedPhone,
        text: content,
        ...quotedContext,
      };
    } else if (type === 'image') {
      return {
        number: formattedPhone,
        mediatype: 'image',
        media: mediaUrl,
        caption: content || '',
        ...quotedContext,
      };
    } else if (type === 'audio') {
      return {
        number: formattedPhone,
        audio: mediaUrl,
        ...quotedContext,
      };
    } else if (type === 'video') {
      return {
        number: formattedPhone,
        mediatype: 'video',
        media: mediaUrl,
        caption: content || '',
        ...quotedContext,
      };
    } else if (type === 'document') {
      return {
        number: formattedPhone,
        mediatype: 'document',
        media: mediaUrl,
        fileName: filename || content || 'document',
        ...quotedContext,
      };
    }
    return { number: formattedPhone, text: content };
  };
  
  // Build endpoint
  let endpoint = '';
  if (type === 'text') {
    endpoint = `${normalizedUrl}/message/sendText/${instanceName}`;
  } else if (type === 'audio') {
    endpoint = `${normalizedUrl}/message/sendWhatsAppAudio/${instanceName}`;
  } else {
    endpoint = `${normalizedUrl}/message/sendMedia/${instanceName}`;
  }
  
  // Try with quote first, retry without if fails
  const tryWithQuote = !!quotedMessageId;
  let body = buildBody(tryWithQuote);
  
  console.log('[Evolution] Request:', { endpoint, body, tryWithQuote });
  
  let response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify(body),
  });
  
  // If failed with quote, retry without it
  if (!response.ok && tryWithQuote) {
    const errorText = await response.text();
    console.log('[Evolution] Send failed with quote, retrying without:', errorText.substring(0, 200));
    
    body = buildBody(false);
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(body),
    });
  }
  
  const data = await safeJsonParse(response, 'Evolution Send');
  
  return {
    success: true,
    messageId: data.key?.id || data.id,
    data,
  };
}

async function sendUAZAPIMessage(
  baseUrl: string,
  instanceName: string,
  instanceToken: string,
  phone: string,
  content: string,
  type: string,
  mediaUrl?: string,
  quotedMessageId?: string,
  filename?: string
) {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  const formattedPhone = phone.replace(/\D/g, '');
  
  console.log('[UAZAPI V2] Sending message:', { instanceName, phone: formattedPhone, type, quotedMessageId });
  
  let endpoint = '';
  let body: any = {};
  
  // UAZAPI V2 - Endpoints corretos conforme docs.uazapi.com
  // /send/text para texto, /send/media para todos os tipos de mídia
  if (type === 'text') {
    endpoint = `${normalizedUrl}/send/text`;
    body = {
      number: formattedPhone,
      text: content,
      ...(quotedMessageId && { replyid: quotedMessageId }),
    };
  } else {
    // Todos os tipos de mídia usam o mesmo endpoint /send/media
    endpoint = `${normalizedUrl}/send/media`;
    
    // Mapear tipo para o formato UAZAPI V2
    let uazapiType = type;
    if (type === 'audio') uazapiType = 'ptt'; // Mensagem de voz (Push-to-Talk)
    
    body = {
      number: formattedPhone,
      type: uazapiType,
      file: mediaUrl,
      ...(content && type !== 'audio' && { caption: content }),
      ...(filename && { filename: filename }),
      ...(quotedMessageId && { replyid: quotedMessageId }),
    };
  }
  
  console.log('[UAZAPI V2] Request:', { endpoint, body });
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'token': instanceToken,
    },
    body: JSON.stringify(body),
  });
  
  const data = await safeJsonParse(response, 'UAZAPI V2 Send');
  
  // UAZAPI V2 retorna 'messageid' (minúsculo) e status: "Pending" (string)
  return {
    success: !!data.messageid || !!data.messageId || !!data.id || !!data.key?.id || data.status === 'Pending',
    messageId: data.messageid || data.messageId || data.key?.id || data.id,
    data,
  };
}

async function sendZAPIMessage(
  instanceId: string,
  token: string,
  clientToken: string,
  phone: string,
  content: string,
  type: string,
  mediaUrl?: string,
  quotedMessageId?: string,
  filename?: string
) {
  const formattedPhone = phone.replace(/\D/g, '');
  
  console.log('[Z-API] Sending message:', { instanceId, phone: formattedPhone, type, quotedMessageId });
  
  let endpoint = '';
  let body: any = {};
  
  const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`;
  
  if (type === 'text') {
    endpoint = `${baseUrl}/send-text`;
    body = {
      phone: formattedPhone,
      message: content,
      ...(quotedMessageId && { messageId: quotedMessageId }),
    };
  } else if (type === 'image') {
    endpoint = `${baseUrl}/send-image`;
    body = {
      phone: formattedPhone,
      image: mediaUrl,
      caption: content || '',
      ...(quotedMessageId && { messageId: quotedMessageId }),
    };
  } else if (type === 'audio') {
    endpoint = `${baseUrl}/send-audio`;
    body = {
      phone: formattedPhone,
      audio: mediaUrl,
      ...(quotedMessageId && { messageId: quotedMessageId }),
    };
  } else if (type === 'video') {
    endpoint = `${baseUrl}/send-video`;
    body = {
      phone: formattedPhone,
      video: mediaUrl,
      caption: content || '',
      ...(quotedMessageId && { messageId: quotedMessageId }),
    };
  } else if (type === 'document') {
    endpoint = `${baseUrl}/send-document/${formattedPhone}`;
    body = {
      document: mediaUrl,
      fileName: filename || content || 'document',
      ...(quotedMessageId && { messageId: quotedMessageId }),
    };
  }
  
  console.log('[Z-API] Request:', { endpoint });
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': clientToken || '',
    },
    body: JSON.stringify(body),
  });
  
  const data = await safeJsonParse(response, 'Z-API Send');
  
  return {
    success: true,
    messageId: data.messageId || data.zapiMessageId,
    data,
  };
}

// =====================================================
// DELETE MESSAGE FUNCTIONS
// =====================================================
async function deleteEvolutionMessage(
  baseUrl: string,
  instanceName: string,
  apiKey: string,
  messageId: string,
  remoteJid: string
) {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  
  console.log('[Evolution] Deleting message:', { instanceName, messageId, remoteJid });
  
  const endpoint = `${normalizedUrl}/chat/deleteMessageForEveryone/${instanceName}`;
  const body = {
    id: messageId,
    remoteJid: remoteJid,
    fromMe: true,
  };
  
  console.log('[Evolution] Delete Request:', { endpoint, body });
  
  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify(body),
  });
  
  const data = await safeJsonParse(response, 'Evolution Delete');
  
  return {
    success: true,
    data,
  };
}

async function deleteUAZAPIMessage(
  baseUrl: string,
  instanceName: string,
  instanceToken: string,
  messageId: string,
  remoteJid: string
) {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  const phone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
  
  console.log('[UAZAPI V2] Deleting message:', { instanceName, messageId, phone, remoteJid });
  
  // UAZAPI V2: /message/delete com método POST e header token
  const endpoint = `${normalizedUrl}/message/delete`;
  const body = {
    id: messageId,
    chatid: remoteJid,
    everyone: true,
  };
  
  console.log('[UAZAPI V2] Delete Request:', { endpoint, body });
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'token': instanceToken,
    },
    body: JSON.stringify(body),
  });
  
  const data = await safeJsonParse(response, 'UAZAPI V2 Delete');
  
  return {
    success: true,
    data,
  };
}

async function deleteZAPIMessage(
  instanceId: string,
  token: string,
  clientToken: string,
  messageId: string,
  phone: string
) {
  const formattedPhone = phone.replace(/\D/g, '').replace('@s.whatsapp.net', '');
  
  console.log('[Z-API] Deleting message:', { instanceId, messageId, phone: formattedPhone });
  
  const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`;
  const endpoint = `${baseUrl}/delete-message`;
  
  const body = {
    phone: formattedPhone,
    messageId: messageId,
    deleteEveryone: true,
  };
  
  console.log('[Z-API] Delete Request:', { endpoint, body });
  
  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': clientToken || '',
    },
    body: JSON.stringify(body),
  });
  
  const data = await safeJsonParse(response, 'Z-API Delete');
  
  return {
    success: true,
    data,
  };
}

// =====================================================
// EDIT MESSAGE FUNCTIONS
// =====================================================
async function editEvolutionMessage(
  baseUrl: string,
  instanceName: string,
  apiKey: string,
  messageId: string,
  remoteJid: string,
  newText: string
) {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  
  console.log('[Evolution] Editing message:', { instanceName, messageId, remoteJid, newText });
  
  const endpoint = `${normalizedUrl}/chat/updateMessage/${instanceName}`;
  const body = {
    number: remoteJid.replace('@s.whatsapp.net', ''),
    text: newText,
    key: {
      remoteJid: remoteJid,
      fromMe: true,
      id: messageId,
    },
  };
  
  console.log('[Evolution] Edit Request:', { endpoint, body });
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify(body),
  });
  
  const data = await safeJsonParse(response, 'Evolution Edit');
  
  return {
    success: true,
    data,
  };
}

async function editUAZAPIMessage(
  baseUrl: string,
  instanceName: string,
  instanceToken: string,
  messageId: string,
  remoteJid: string,
  newText: string
) {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  const phone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '');
  
  console.log('[UAZAPI V2] Editing message:', { instanceName, messageId, phone, newText });
  
  // UAZAPI V2: /message/edit com método POST e header token
  const endpoint = `${normalizedUrl}/message/edit`;
  const body = {
    id: messageId,
    chatid: remoteJid,
    text: newText,
  };
  
  console.log('[UAZAPI V2] Edit Request:', { endpoint, body });
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'token': instanceToken,
    },
    body: JSON.stringify(body),
  });
  
  const data = await safeJsonParse(response, 'UAZAPI V2 Edit');
  
  return {
    success: true,
    data,
  };
}

// =====================================================
// SEND REACTION FUNCTIONS
// =====================================================
async function sendEvolutionReaction(
  baseUrl: string,
  instanceName: string,
  apiKey: string,
  messageId: string,
  remoteJid: string,
  emoji: string
) {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  
  console.log('[Evolution] Sending reaction:', { instanceName, messageId, remoteJid, emoji });
  
  const endpoint = `${normalizedUrl}/message/sendReaction/${instanceName}`;
  const body = {
    key: {
      remoteJid: remoteJid,
      fromMe: false, // We're reacting to a message from the contact
      id: messageId,
    },
    reaction: emoji || "" // Empty string to remove reaction
  };
  
  console.log('[Evolution] Reaction Request:', { endpoint, body });
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
    },
    body: JSON.stringify(body),
  });
  
  const data = await safeJsonParse(response, 'Evolution Reaction');
  
  return {
    success: true,
    data,
  };
}

async function sendUAZAPIReaction(
  baseUrl: string,
  instanceName: string,
  adminToken: string,
  messageId: string,
  remoteJid: string,
  emoji: string
) {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  
  console.log('[UAZAPI] Sending reaction:', { instanceName, messageId, remoteJid, emoji });
  
  const endpoint = `${normalizedUrl}/message/sendReaction/${instanceName}`;
  const body = {
    key: {
      remoteJid: remoteJid,
      fromMe: false,
      id: messageId,
    },
    reaction: emoji || ""
  };
  
  console.log('[UAZAPI] Reaction Request:', { endpoint, body });
  
  let response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'admintoken': adminToken,
    },
    body: JSON.stringify(body),
  });
  
  if (response.status === 401) {
    console.log('[UAZAPI] 401 with admintoken, trying apikey...');
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': adminToken,
      },
      body: JSON.stringify(body),
    });
  }
  
  const data = await safeJsonParse(response, 'UAZAPI Reaction');
  
  return {
    success: true,
    data,
  };
}

async function sendZAPIReaction(
  instanceId: string,
  token: string,
  clientToken: string,
  messageId: string,
  phone: string,
  emoji: string
) {
  const formattedPhone = phone.replace(/\D/g, '').replace('@s.whatsapp.net', '');
  
  console.log('[Z-API] Sending reaction:', { instanceId, messageId, phone: formattedPhone, emoji });
  
  const baseUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}`;
  const endpoint = `${baseUrl}/send-reaction`;
  
  const body = {
    phone: formattedPhone,
    messageId: messageId,
    reaction: emoji || "",
  };
  
  console.log('[Z-API] Reaction Request:', { endpoint, body });
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': clientToken || '',
    },
    body: JSON.stringify(body),
  });
  
  const data = await safeJsonParse(response, 'Z-API Reaction');
  
  return {
    success: true,
    data,
  };
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
// UAZAPI - Endpoints corretos conforme docs.uazapi.com
// =====================================================
async function createUAZAPIInstance(config: ProviderConfig, instanceName: string, webhookUrl: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[UAZAPI] Creating instance:', instanceName, 'at', baseUrl);
  console.log('[UAZAPI] Admin Token (primeiros 8 chars):', config.adminToken?.substring(0, 8) + '...');
  
  try {
    // PASSO 1: Criar instância via /instance/init (com admintoken)
    // Docs: https://docs.uazapi.com/endpoint/post/instance~init
    const initUrl = `${baseUrl}/instance/init`;
    console.log('[UAZAPI] Step 1 - Init instance:', initUrl);
    
    const initResponse = await fetch(initUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'admintoken': config.adminToken,
      },
      body: JSON.stringify({ name: instanceName }),
    });
    
    const initData = await safeJsonParse(initResponse, 'UAZAPI Init');
    console.log('[UAZAPI] Init response:', initData);
    
    // O init retorna o token da instância específica
    const instanceToken = initData.token || initData.instance?.token;
    if (!instanceToken) {
      return { success: false, error: 'Token da instância não retornado pelo servidor' };
    }
    
    // PASSO 2: Conectar instância para gerar QRCode via /instance/connect (com token da instância)
    // Docs: https://docs.uazapi.com/endpoint/post/instance~connect
    const connectUrl = `${baseUrl}/instance/connect`;
    console.log('[UAZAPI] Step 2 - Connect instance:', connectUrl);
    
    const connectResponse = await fetch(connectUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instanceToken,
      },
      body: JSON.stringify({}), // Body vazio gera QRCode
    });
    
    const connectData = await safeJsonParse(connectResponse, 'UAZAPI Connect');
    console.log('[UAZAPI] Connect response:', connectData);
    
    // PASSO 3: Configurar webhook via PUT /webhook (endpoint correto da UAZAPI)
    // Tentar múltiplos endpoints pois a API pode variar
    const webhookEndpoints = [
      { url: `${baseUrl}/webhook`, method: 'PUT' },
      { url: `${baseUrl}/webhook`, method: 'POST' },
      { url: `${baseUrl}/webhooks`, method: 'PUT' },
      { url: `${baseUrl}/webhooks/url`, method: 'PUT' },
    ];
    
    let webhookConfigured = false;
    for (const endpoint of webhookEndpoints) {
      try {
        console.log(`[UAZAPI] Step 3 - Trying webhook: ${endpoint.method} ${endpoint.url}`);
        
        const webhookResponse = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: {
            'Content-Type': 'application/json',
            'token': instanceToken,
          },
          body: JSON.stringify({ 
            url: webhookUrl, 
            webhook: webhookUrl,
            enabled: true,
            // UAZAPI V2: eventos expandidos para ACK e conexão
            events: [
              'messages', 'messages_ack', 'message_ack', 'ack', 
              'status', 'connection', 'connection.update', 'connection_update',
              'instance.status', 'status.instance', 'status.update',
              'presence', 'calls'
            ]
          }),
        });
        
        if (webhookResponse.ok) {
          const webhookData = await webhookResponse.json();
          console.log('[UAZAPI] Webhook configured successfully:', webhookData);
          webhookConfigured = true;
          break;
        }
      } catch (e) {
        console.log(`[UAZAPI] Webhook endpoint ${endpoint.url} failed, trying next...`);
      }
    }
    
    if (!webhookConfigured) {
      console.warn('[UAZAPI] Could not configure webhook automatically. Instance created but webhook may need manual config.');
    }
    
    // Extrair QR code - pode estar em diferentes locais da resposta
    const qrCode = connectData.instance?.qrcode || connectData.qrcode || connectData.qr || connectData.base64;
    console.log('[UAZAPI] QR Code extracted:', qrCode ? 'Yes (length: ' + qrCode.length + ')' : 'No');
    
    return {
      success: true,
      instanceId: instanceName,
      token: instanceToken,
      qrCode: qrCode,
    };
  } catch (err: any) {
    console.error('[UAZAPI] Create error:', err);
    return { success: false, error: err.message };
  }
}

// Função para fazer logout de instância UAZAPI (resetar estado travado)
async function logoutUAZAPIInstance(baseUrl: string, instanceToken: string) {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  console.log('[UAZAPI] Logging out instance to reset stuck state');
  
  try {
    const response = await fetch(`${normalizedUrl}/instance/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instanceToken,
      },
      body: JSON.stringify({}),
    });
    
    const text = await response.text();
    console.log('[UAZAPI Logout] Response:', response.status, text);
    
    return { success: response.ok, message: 'Logout realizado' };
  } catch (err: any) {
    console.error('[UAZAPI Logout] Error:', err);
    return { success: false, error: err.message };
  }
}

// Função para fazer logout de instância Evolution
async function logoutEvolutionInstance(config: ProviderConfig, instanceName: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[Evolution] Logging out instance:', instanceName);
  
  try {
    const response = await fetch(`${baseUrl}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: {
        'apikey': config.adminToken,
      },
    });
    
    const text = await response.text();
    console.log('[Evolution Logout] Response:', response.status, text);
    
    return { success: response.ok, message: 'Logout realizado' };
  } catch (err: any) {
    console.error('[Evolution Logout] Error:', err);
    return { success: false, error: err.message };
  }
}

async function getUAZAPIQRCode(baseUrl: string, instanceName: string, instanceToken: string) {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  console.log('[UAZAPI] Getting QR code for:', instanceName, 'at', normalizedUrl);
  
  if (!instanceToken) {
    return { success: false, error: 'Token da instância não fornecido' };
  }
  
  try {
    // Verificar status atual via /instance/status (com token da instância)
    // Docs: https://docs.uazapi.com/endpoint/get/instance~status
    const statusUrl = `${normalizedUrl}/instance/status`;
    console.log('[UAZAPI] Checking status:', statusUrl);
    
    const statusResponse = await fetch(statusUrl, {
      headers: { 'token': instanceToken },
    });
    
    const statusData = await safeJsonParse(statusResponse, 'UAZAPI Status');
    console.log('[UAZAPI] Status response:', statusData);
    
    // Se já conectado, retornar
    if (statusData.state === 'connected' || statusData.state === 'open') {
      return { connected: true, ownerJid: statusData.owner };
    }
    
    // NOVO: Detectar instância travada em "connecting" sem QR Code
    // Se está em "connecting" mas não tem QR Code, provavelmente está travada
    if (statusData.state === 'connecting' && !statusData.qrcode && !statusData.qr && !statusData.instance?.qrcode) {
      console.log('[UAZAPI] Instance stuck in "connecting" state without QR, performing logout...');
      
      // Fazer logout para resetar estado
      const logoutResult = await logoutUAZAPIInstance(normalizedUrl, instanceToken);
      console.log('[UAZAPI] Logout result:', logoutResult);
      
      // Aguardar para o logout processar
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Se tem QRCode no status, retornar (pode estar na raiz ou em instance)
    if (statusData.qrcode || statusData.qr || statusData.instance?.qrcode) {
      return {
        qrCode: statusData.qrcode || statusData.qr || statusData.instance?.qrcode,
        connected: false,
      };
    }
    
    // Se desconectado ou após logout, chamar /instance/connect para gerar novo QRCode
    // Docs: https://docs.uazapi.com/endpoint/post/instance~connect
    const connectUrl = `${normalizedUrl}/instance/connect`;
    console.log('[UAZAPI] Reconnecting to get new QR:', connectUrl);
    
    const connectResponse = await fetch(connectUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instanceToken,
      },
      body: JSON.stringify({}),
    });
    
    const connectData = await safeJsonParse(connectResponse, 'UAZAPI Reconnect');
    console.log('[UAZAPI] Reconnect response:', connectData);
    
    // QR Code pode estar na raiz ou dentro de instance
    return {
      qrCode: connectData.qrcode || connectData.qr || connectData.base64 || 
              connectData.instance?.qrcode || connectData.instance?.qr,
      connected: false,
    };
  } catch (err: any) {
    console.error('[UAZAPI] GetQRCode error:', err);
    return { success: false, error: err.message };
  }
}

async function fetchUAZAPIInstances(config: ProviderConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[UAZAPI] Fetching all instances from:', baseUrl);
  
  try {
    // GET /admin/list com admintoken
    // Docs: https://docs.uazapi.com/endpoint/get/admin~list
    const url = `${baseUrl}/admin/list`;
    console.log('[UAZAPI] Fetching instances:', url);
    
    const response = await fetch(url, {
      headers: { 'admintoken': config.adminToken },
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.log('[UAZAPI] Fetch instances error:', response.status, text);
      return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 100)}` };
    }
    
    const data = await response.json();
    console.log('[UAZAPI] Instances found:', data);
    return { success: true, instances: data };
  } catch (err: any) {
    console.error('[UAZAPI] FetchInstances error:', err);
    return { success: false, error: err.message };
  }
}

async function testUAZAPIConnection(config: ProviderConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[UAZAPI] Testing connection to:', baseUrl);
  
  try {
    // Testar conexão com /admin/list (requer admintoken válido)
    const url = `${baseUrl}/admin/list`;
    console.log('[UAZAPI] Test URL:', url);
    
    const response = await fetch(url, {
      headers: { 'admintoken': config.adminToken },
    });
    
    console.log('[UAZAPI] Test response status:', response.status);
    
    if (response.status === 401 || response.status === 403) {
      return { 
        success: false, 
        error: 'Admin Token inválido. Verifique se você está usando o Admin Token correto da sua conta UAZAPI.' 
      };
    }
    
    if (response.ok) {
      const data = await response.json();
      const count = Array.isArray(data) ? data.length : 0;
      return { success: true, message: `Conexão OK! ${count} instância(s) encontrada(s).` };
    }
    
    const text = await response.text();
    return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 100)}` };
  } catch (err: any) {
    console.error('[UAZAPI] TestConnection error:', err);
    return { success: false, error: `Erro de conexão: ${err.message}` };
  }
}

async function deleteUAZAPIInstance(config: ProviderConfig, instanceName: string, instanceToken?: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[UAZAPI] Deleting instance:', instanceName);
  
  try {
    // DELETE /instance/delete com token da instância
    // Docs: https://docs.uazapi.com/endpoint/delete/instance~delete
    const url = `${baseUrl}/instance/delete`;
    console.log('[UAZAPI] Delete URL:', url);
    
    // Priorizar token da instância, fallback para admintoken
    const authToken = instanceToken || config.adminToken;
    const headerName = instanceToken ? 'token' : 'admintoken';
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { [headerName]: authToken },
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.log('[UAZAPI] Delete error:', response.status, text);
      return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 100)}` };
    }
    
    return { success: true };
  } catch (err: any) {
    console.error('[UAZAPI] DeleteInstance error:', err);
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
        events: ['QRCODE_UPDATED', 'MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'SEND_MESSAGE', 'PRESENCE_UPDATE'],
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

  // Get QR Code - Evolution API v2 uses /instance/connect endpoint
  const qrRes = await fetch(`${normalizedUrl}/instance/connect/${instanceName}`, {
    headers: { 'apikey': apiKey },
  });
  const qrData = await safeJsonParse(qrRes, 'Evolution QR');

  return {
    qrCode: qrData.qrcode?.base64 || qrData.base64 || qrData.code,
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
async function getUAZAPIStatus(config: ProviderConfig, instanceName: string, instanceToken?: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[UAZAPI] Getting status for:', instanceName);
  
  // Priorizar token da instância se disponível
  const authToken = instanceToken || config.adminToken;
  
  if (!authToken) {
    return { success: false, error: 'Token não fornecido' };
  }
  
  try {
    // GET /instance/status com token da instância
    // Docs: https://docs.uazapi.com/endpoint/get/instance~status
    const url = `${baseUrl}/instance/status`;
    console.log('[UAZAPI] Status URL:', url);
    
    const response = await fetch(url, {
      headers: { 'token': authToken },
    });
    
    if (!response.ok) {
      const text = await response.text();
      console.log('[UAZAPI] Status error:', response.status, text);
      return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 100)}` };
    }
    
    const data = await response.json();
    console.log('[UAZAPI] Status response:', data);
    
    // Mapear estados da UAZAPI
    const state = data.state || data.status || 'disconnected';
    const isConnected = state === 'connected' || state === 'open';
    
    return { 
      success: true, 
      status: isConnected ? 'connected' : 'disconnected',
      state,
      ownerJid: data.owner || data.ownerJid,
      qrcode: data.qrcode || data.qr,
    };
  } catch (err: any) {
    console.error('[UAZAPI] GetStatus error:', err);
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
// SET WEBHOOK - Reconfigurar webhook de instância existente
// CORRIGIDO: Formato do body conforme documentação oficial Evolution API
// =====================================================
async function setEvolutionWebhook(config: ProviderConfig, instanceName: string, webhookUrl: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[Evolution] Setting webhook for:', instanceName, 'URL:', webhookUrl);
  
  try {
    // FORMATO CORRETO Evolution API v2 - propriedades dentro de objeto "webhook"
    const webhookBody = {
      webhook: {
        enabled: true,
        url: webhookUrl,
        webhookByEvents: false,
        webhookBase64: true,
        events: [
          'QRCODE_UPDATED',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE', 
          'CONNECTION_UPDATE',
          'SEND_MESSAGE',
          'PRESENCE_UPDATE'
        ]
      }
    };
    
    console.log('[Evolution SetWebhook] Request body:', JSON.stringify(webhookBody));
    
    const response = await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.adminToken,
      },
      body: JSON.stringify(webhookBody),
    });
    
    const text = await response.text();
    console.log('[Evolution SetWebhook] Response:', response.status, text);
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 200)}` };
    }
    
    return { success: true, message: 'Webhook configurado com sucesso!', data: JSON.parse(text) };
  } catch (err: any) {
    console.error('[Evolution SetWebhook] Error:', err);
    return { success: false, error: err.message };
  }
}

// =====================================================
// FETCH WEBHOOK - Verificar configuração atual do webhook
// =====================================================
async function fetchEvolutionWebhook(config: ProviderConfig, instanceName: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[Evolution] Fetching webhook config for:', instanceName);
  
  try {
    const response = await fetch(`${baseUrl}/webhook/find/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': config.adminToken,
      },
    });
    
    const text = await response.text();
    console.log('[Evolution FetchWebhook] Response:', response.status, text);
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 200)}` };
    }
    
    const data = JSON.parse(text);
    return { 
      success: true, 
      webhook: data,
      enabled: data.enabled,
      url: data.url,
      events: data.events || []
    };
  } catch (err: any) {
    console.error('[Evolution FetchWebhook] Error:', err);
    return { success: false, error: err.message };
  }
}

// =====================================================
// RESTART INSTANCE - Reiniciar instância para aplicar configs
// =====================================================
async function restartEvolutionInstance(config: ProviderConfig, instanceName: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[Evolution] Restarting instance:', instanceName);
  
  try {
    const response = await fetch(`${baseUrl}/instance/restart/${instanceName}`, {
      method: 'PUT',
      headers: {
        'apikey': config.adminToken,
      },
    });
    
    const text = await response.text();
    console.log('[Evolution Restart] Response:', response.status, text);
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 200)}` };
    }
    
    return { success: true, message: 'Instância reiniciada com sucesso!' };
  } catch (err: any) {
    console.error('[Evolution Restart] Error:', err);
    return { success: false, error: err.message };
  }
}

// =====================================================
// SET SETTINGS - Configurar settings da instância
// =====================================================
async function setEvolutionSettings(config: ProviderConfig, instanceName: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[Evolution] Setting settings for:', instanceName);
  
  try {
    const settingsBody = {
      rejectCall: true,
      msgCall: 'No momento não podemos atender ligações.',
      groupsIgnore: true,  // Ignorar grupos conforme preferência do usuário
      alwaysOnline: false,
      readMessages: false,
      readStatus: true,
      syncFullHistory: false
    };
    
    console.log('[Evolution SetSettings] Request body:', JSON.stringify(settingsBody));
    
    const response = await fetch(`${baseUrl}/settings/set/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': config.adminToken,
      },
      body: JSON.stringify(settingsBody),
    });
    
    const text = await response.text();
    console.log('[Evolution SetSettings] Response:', response.status, text);
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${text.substring(0, 200)}` };
    }
    
    return { success: true, message: 'Settings configurados com sucesso!' };
  } catch (err: any) {
    console.error('[Evolution SetSettings] Error:', err);
    return { success: false, error: err.message };
  }
}

async function setUAZAPIWebhook(config: ProviderConfig, instanceName: string, webhookUrl: string, instanceToken?: string) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  console.log('[UAZAPI] Setting webhook for:', instanceName, 'URL:', webhookUrl);
  
  // Priorizar token da instância se disponível
  const authToken = instanceToken || config.adminToken;
  
  if (!authToken) {
    return { success: false, error: 'Token não fornecido' };
  }
  
  // Tentar múltiplos endpoints com método PUT (igual createUAZAPIInstance)
  const webhookEndpoints = [
    { path: '/webhook', method: 'PUT' },
    { path: '/webhooks', method: 'PUT' },
    { path: '/webhooks/url', method: 'PUT' },
    { path: '/webhook', method: 'POST' },
    { path: '/webhooks/url', method: 'POST' },
  ];
  
  const webhookPayload = { 
    url: webhookUrl,
    enabled: true,
    // UAZAPI V2: eventos expandidos para ACK e conexão
    events: [
      'messages', 'messages_ack', 'message_ack', 'ack', 
      'status', 'connection', 'connection.update', 'connection_update',
      'instance.status', 'status.instance', 'status.update',
      'presence', 'calls'
    ]
  };
  
  let lastError = '';
  
  for (const endpoint of webhookEndpoints) {
    try {
      const url = `${baseUrl}${endpoint.path}`;
      console.log(`[UAZAPI] Tentando ${endpoint.method} ${url}`);
      
      const response = await fetch(url, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'token': authToken,
        },
        body: JSON.stringify(webhookPayload),
      });
      
      const text = await response.text();
      console.log(`[UAZAPI SetWebhook] ${endpoint.method} ${endpoint.path} Response:`, response.status, text);
      
      if (response.ok) {
        console.log(`[UAZAPI] Webhook configurado com sucesso via ${endpoint.method} ${endpoint.path}`);
        return { success: true, message: 'Webhook configurado com sucesso!' };
      }
      
      // Se for 404 ou 405, tentar próximo endpoint
      if (response.status === 404 || response.status === 405) {
        lastError = `${endpoint.method} ${endpoint.path}: HTTP ${response.status}`;
        continue;
      }
      
      // Outros erros, guardar e continuar tentando
      lastError = `${endpoint.method} ${endpoint.path}: HTTP ${response.status}: ${text.substring(0, 100)}`;
    } catch (err: any) {
      console.error(`[UAZAPI SetWebhook] Error with ${endpoint.method} ${endpoint.path}:`, err);
      lastError = `${endpoint.method} ${endpoint.path}: ${err.message}`;
    }
  }
  
  console.error('[UAZAPI SetWebhook] Todos os endpoints falharam. Último erro:', lastError);
  return { success: false, error: `Falha ao configurar webhook: ${lastError}` };
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

    const { action, providerCode, instanceName, instanceId, instanceToken, webhookUrl, channelId, phone, content, type, mediaUrl, quotedMessageId, filename } = body;

    // =====================================================
    // SEND ACTION - Rota especial que busca dados do canal
    // =====================================================
    if (action === 'send') {
      // Allow empty content for media messages (audio, video, image)
      if (!channelId || !phone || (!content && !mediaUrl)) {
        return new Response(
          JSON.stringify({ success: false, error: 'channelId, phone e (content ou mediaUrl) são obrigatórios' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Buscar dados do canal
      const { data: channel, error: channelError } = await supabase
        .from('whatsapp_channels')
        .select(`
          id,
          instance_id,
          instance_token,
          provider:whatsapp_providers(
            code,
            base_url,
            admin_token,
            client_token
          )
        `)
        .eq('id', channelId)
        .eq('is_deleted', false)
        .single();

      if (channelError || !channel) {
        console.error('[WhatsApp Send] Channel not found:', channelError);
        return new Response(
          JSON.stringify({ success: false, error: 'Canal não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      const provider = channel.provider as any;
      if (!provider) {
        return new Response(
          JSON.stringify({ success: false, error: 'Provedor não configurado para este canal' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      console.log('[WhatsApp Send] Channel:', { 
        instanceId: channel.instance_id, 
        provider: provider.code 
      });

      let result;
      const messageType = type || 'text';

      try {
        switch (provider.code) {
          case 'evolution':
            result = await sendEvolutionMessage(
              provider.base_url,
              channel.instance_id!,
              provider.admin_token,
              phone,
              content || '',
              messageType,
              mediaUrl,
              quotedMessageId,
              filename
            );
            break;
          case 'uazapi':
            result = await sendUAZAPIMessage(
              provider.base_url,
              channel.instance_id!,
              channel.instance_token || provider.admin_token,
              phone,
              content || '',
              messageType,
              mediaUrl,
              quotedMessageId,
              filename
            );
            break;
          case 'zapi':
            result = await sendZAPIMessage(
              channel.instance_id!,
              channel.instance_token!,
              provider.client_token || '',
              phone,
              content || '',
              messageType,
              mediaUrl,
              quotedMessageId,
              filename
            );
            break;
          default:
            result = { success: false, error: 'Provedor desconhecido' };
        }
      } catch (sendError: any) {
        console.error('[WhatsApp Send] Error:', sendError);
        result = { success: false, error: sendError.message };
      }

      // Atualizar estatísticas do canal
      if (result.success) {
        await supabase
          .from('whatsapp_channels')
          .update({
            messages_sent: (channel as any).messages_sent + 1 || 1,
            messages_sent_today: (channel as any).messages_sent_today + 1 || 1,
            last_sync_at: new Date().toISOString(),
          })
          .eq('id', channelId);
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // FETCH PROFILE ACTION - Rota especial que busca dados do canal
    // =====================================================
    if (action === 'fetchProfile') {
      if (!channelId || !phone) {
        return new Response(
          JSON.stringify({ success: false, error: 'channelId e phone são obrigatórios' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      // Get channel data
      const { data: channel, error: channelError } = await supabase
        .from('whatsapp_channels')
        .select('*, provider:whatsapp_providers(*)')
        .eq('id', channelId)
        .single();
      
      if (channelError || !channel) {
        return new Response(
          JSON.stringify({ success: false, error: 'Canal não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      
      const channelProvider = channel.provider as any;
      if (!channelProvider) {
        return new Response(
          JSON.stringify({ success: false, error: 'Provedor do canal não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      const normalizedUrl = normalizeBaseUrl(channelProvider.base_url);
      const formattedPhone = phone.replace(/\D/g, '');
      const providerCode = channelProvider.code;
      
      console.log('[FetchProfile] Fetching profile for:', formattedPhone, 'Provider:', providerCode);
      
      try {
        let profilePictureUrl: string | null = null;
        let name: string | null = null;
        let numberExists = true;
        
        if (providerCode === 'evolution') {
          // Evolution API
          const profileRes = await fetch(`${normalizedUrl}/chat/fetchProfile/${channel.instance_id}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': channelProvider.admin_token,
            },
            body: JSON.stringify({ number: formattedPhone }),
          });
          
          const rawText = await profileRes.text();
          console.log(`[Evolution FetchProfile] Raw response (${profileRes.status}):`, rawText);
          
          // Handle case where number doesn't exist on WhatsApp
          if (profileRes.status === 400) {
            try {
              const errorData = JSON.parse(rawText);
              if (errorData.response?.message?.[0]?.exists === false) {
                console.log('[FetchProfile] Number does not exist on WhatsApp');
                numberExists = false;
              }
            } catch (e) {
              // Fall through
            }
          }
          
          if (profileRes.ok) {
            const profileData = JSON.parse(rawText);
            profilePictureUrl = profileData.profilePictureUrl || profileData.picture || null;
            name = profileData.name || profileData.pushName || null;
            numberExists = profileData.numberExists !== false;
          }
        } else if (providerCode === 'uazapi') {
          // UAZAPI V2 - Usar endpoint /contact/profile
          const profileRes = await fetch(`${normalizedUrl}/contact/profile`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'token': channel.instance_token || channelProvider.admin_token,
            },
            body: JSON.stringify({ number: formattedPhone }),
          });
          
          const rawText = await profileRes.text();
          console.log(`[UAZAPI FetchProfile] Raw response (${profileRes.status}):`, rawText);
          
          if (profileRes.ok) {
            try {
              const profileData = JSON.parse(rawText);
              // UAZAPI pode retornar campos como ProfilePicURL, Picture, Name, PushName
              profilePictureUrl = profileData.ProfilePicURL || profileData.profilePicURL || 
                                  profileData.picture || profileData.Picture || 
                                  profileData.imgUrl || null;
              name = profileData.Name || profileData.name || 
                     profileData.PushName || profileData.pushName || null;
              numberExists = profileData.exists !== false && profileData.Exists !== false;
            } catch (e) {
              console.log('[UAZAPI FetchProfile] Parse error:', e);
            }
          } else if (profileRes.status === 404 || profileRes.status === 400) {
            numberExists = false;
          }
        } else if (providerCode === 'zapi') {
          // Z-API - Não suporta fetchProfile, retornar vazio sem erro
          console.log('[Z-API FetchProfile] Not supported, returning empty');
        }
        
        console.log('[FetchProfile] Result:', { profilePictureUrl, name, numberExists });
        
        return new Response(
          JSON.stringify({
            success: true,
            profilePictureUrl,
            name,
            numberExists,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (profileError: any) {
        console.error('[FetchProfile] Error:', profileError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: profileError.message,
            profilePictureUrl: null,
            name: null,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // =====================================================
    // DELETE MESSAGE ACTION - Apagar mensagem no WhatsApp
    // =====================================================
    if (action === 'deleteMessage') {
      const { channelId, whatsappMessageId, remoteJid, phone } = body as CreateInstanceRequest & { phone?: string };
      
      if (!channelId || !whatsappMessageId) {
        return new Response(
          JSON.stringify({ success: false, error: 'channelId e whatsappMessageId são obrigatórios' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      console.log('[WhatsApp Instance] Delete message request:', { channelId, whatsappMessageId, remoteJid });
      
      // Get channel data with provider
      const { data: channel, error: channelError } = await supabase
        .from('whatsapp_channels')
        .select('*, provider:whatsapp_providers(*)')
        .eq('id', channelId)
        .single();
      
      if (channelError || !channel) {
        return new Response(
          JSON.stringify({ success: false, error: 'Canal não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      
      const channelProvider = channel.provider as any;
      if (!channelProvider) {
        return new Response(
          JSON.stringify({ success: false, error: 'Provedor do canal não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      console.log('[WhatsApp Delete] Channel:', { instanceId: channel.instance_id, provider: channelProvider.code });
      
      let result;
      
      try {
        switch (channelProvider.code) {
          case 'evolution':
            if (!remoteJid) {
              result = { success: false, error: 'remoteJid é obrigatório para Evolution API' };
            } else {
              result = await deleteEvolutionMessage(
                channelProvider.base_url,
                channel.instance_id!,
                channelProvider.admin_token,
                whatsappMessageId,
                remoteJid
              );
            }
            break;
          case 'uazapi':
            if (!remoteJid) {
              result = { success: false, error: 'remoteJid é obrigatório para UAZAPI' };
            } else {
              // UAZAPI V2 usa instance_token no header, não admin_token
              result = await deleteUAZAPIMessage(
                channelProvider.base_url,
                channel.instance_id!,
                channel.instance_token || channelProvider.admin_token,
                whatsappMessageId,
                remoteJid
              );
            }
            break;
          case 'zapi':
            result = await deleteZAPIMessage(
              channel.instance_id!,
              channel.instance_token!,
              channelProvider.client_token,
              whatsappMessageId,
              phone || remoteJid || ''
            );
            break;
          default:
            result = { success: false, error: 'Provedor desconhecido' };
        }
      } catch (deleteError: any) {
        console.error('[WhatsApp Delete] Error:', deleteError);
        result = { success: false, error: deleteError.message };
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // EDIT MESSAGE ACTION - Editar mensagem no WhatsApp
    // =====================================================
    if (action === 'editMessage') {
      const { channelId, whatsappMessageId, remoteJid, phone, newText } = body as CreateInstanceRequest & { phone?: string; newText?: string };
      
      if (!channelId || !whatsappMessageId || !newText) {
        return new Response(
          JSON.stringify({ success: false, error: 'channelId, whatsappMessageId e newText são obrigatórios' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      console.log('[WhatsApp Instance] Edit message request:', { channelId, whatsappMessageId, remoteJid, newText });
      
      // Get channel data with provider
      const { data: channel, error: channelError } = await supabase
        .from('whatsapp_channels')
        .select('*, provider:whatsapp_providers(*)')
        .eq('id', channelId)
        .single();
      
      if (channelError || !channel) {
        return new Response(
          JSON.stringify({ success: false, error: 'Canal não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      
      const channelProvider = channel.provider as any;
      if (!channelProvider) {
        return new Response(
          JSON.stringify({ success: false, error: 'Provedor do canal não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      console.log('[WhatsApp Edit] Channel:', { instanceId: channel.instance_id, provider: channelProvider.code });
      
      let result;
      
      try {
        switch (channelProvider.code) {
          case 'evolution':
            if (!remoteJid && !phone) {
              result = { success: false, error: 'remoteJid ou phone é obrigatório para Evolution API' };
            } else {
              const jid = remoteJid || (phone?.replace(/\D/g, '') + '@s.whatsapp.net');
              result = await editEvolutionMessage(
                channelProvider.base_url,
                channel.instance_id!,
                channelProvider.admin_token,
                whatsappMessageId,
                jid,
                newText
              );
            }
            break;
          case 'uazapi':
            if (!remoteJid && !phone) {
              result = { success: false, error: 'remoteJid ou phone é obrigatório para UAZAPI' };
            } else {
              const jid = remoteJid || (phone?.replace(/\D/g, '') + '@s.whatsapp.net');
              // UAZAPI V2 usa instance_token no header, não admin_token
              result = await editUAZAPIMessage(
                channelProvider.base_url,
                channel.instance_id!,
                channel.instance_token || channelProvider.admin_token,
                whatsappMessageId,
                jid,
                newText
              );
            }
            break;
          case 'zapi':
            // Z-API doesn't support message editing
            result = { success: false, error: 'Z-API não suporta edição de mensagens' };
            break;
          default:
            result = { success: false, error: 'Provedor desconhecido' };
        }
      } catch (editError: any) {
        console.error('[WhatsApp Edit] Error:', editError);
        result = { success: false, error: editError.message };
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // SEND REACTION ACTION - Reagir a mensagem no WhatsApp
    // =====================================================
    if (action === 'sendReaction') {
      const { channelId, whatsappMessageId, remoteJid, phone, emoji } = body as CreateInstanceRequest & { phone?: string; emoji?: string };
      
      if (!channelId || !whatsappMessageId) {
        return new Response(
          JSON.stringify({ success: false, error: 'channelId e whatsappMessageId são obrigatórios' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      console.log('[WhatsApp Instance] Send reaction request:', { channelId, whatsappMessageId, remoteJid, emoji });
      
      // Get channel data with provider
      const { data: channel, error: channelError } = await supabase
        .from('whatsapp_channels')
        .select('*, provider:whatsapp_providers(*)')
        .eq('id', channelId)
        .single();
      
      if (channelError || !channel) {
        return new Response(
          JSON.stringify({ success: false, error: 'Canal não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      
      const channelProvider = channel.provider as any;
      if (!channelProvider) {
        return new Response(
          JSON.stringify({ success: false, error: 'Provedor do canal não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      
      console.log('[WhatsApp Reaction] Channel:', { instanceId: channel.instance_id, provider: channelProvider.code });
      
      let result;
      
      try {
        switch (channelProvider.code) {
          case 'evolution':
            if (!remoteJid && !phone) {
              result = { success: false, error: 'remoteJid ou phone é obrigatório para Evolution API' };
            } else {
              const jid = remoteJid || (phone?.replace(/\D/g, '') + '@s.whatsapp.net');
              result = await sendEvolutionReaction(
                channelProvider.base_url,
                channel.instance_id!,
                channelProvider.admin_token,
                whatsappMessageId,
                jid,
                emoji || ""
              );
            }
            break;
          case 'uazapi':
            if (!remoteJid && !phone) {
              result = { success: false, error: 'remoteJid ou phone é obrigatório para UAZAPI' };
            } else {
              const jid = remoteJid || (phone?.replace(/\D/g, '') + '@s.whatsapp.net');
              result = await sendUAZAPIReaction(
                channelProvider.base_url,
                channel.instance_id!,
                channelProvider.admin_token,
                whatsappMessageId,
                jid,
                emoji || ""
              );
            }
            break;
          case 'zapi':
            result = await sendZAPIReaction(
              channel.instance_id!,
              channel.instance_token!,
              channelProvider.client_token,
              whatsappMessageId,
              phone || remoteJid || '',
              emoji || ""
            );
            break;
          default:
            result = { success: false, error: 'Provedor desconhecido' };
        }
      } catch (reactionError: any) {
        console.error('[WhatsApp Reaction] Error:', reactionError);
        result = { success: false, error: reactionError.message };
      }

      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // RECONFIGURE WEBHOOK - Não requer providerCode (busca do banco)
    // =====================================================
    if (action === 'reconfigureWebhook') {
      if (!channelId) {
        return new Response(
          JSON.stringify({ success: false, error: 'channelId é obrigatório' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      console.log('[WhatsApp Instance] Reconfiguring webhook for channel:', channelId);

      // Buscar dados do canal
      const { data: channelData, error: channelError } = await supabase
        .from('whatsapp_channels')
        .select(`
          id,
          instance_id,
          instance_token,
          provider:whatsapp_providers(
            id,
            code,
            base_url,
            admin_token,
            client_token,
            is_configured,
            name
          )
        `)
        .eq('id', channelId)
        .eq('is_deleted', false)
        .single();

      if (channelError || !channelData) {
        console.error('[WhatsApp Instance] Channel not found:', channelError);
        return new Response(
          JSON.stringify({ success: false, error: 'Canal não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      const channelProvider = channelData.provider as any;
      if (!channelProvider || !channelProvider.is_configured) {
        return new Response(
          JSON.stringify({ success: false, error: 'Provedor não configurado para este canal' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      if (!channelData.instance_id) {
        return new Response(
          JSON.stringify({ success: false, error: 'Canal sem instance_id configurado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      const channelConfig: ProviderConfig = {
        baseUrl: channelProvider.base_url,
        adminToken: channelProvider.admin_token,
        clientToken: channelProvider.client_token,
      };

      const finalWebhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?provider=${channelProvider.code}`;
      console.log('[WhatsApp Instance] Reconfiguring webhook URL:', finalWebhookUrl);

      let webhookResult;
      switch (channelProvider.code) {
        case 'zapi':
          webhookResult = { success: false, error: 'Z-API não suporta reconfiguração de webhook via API' };
          break;
        case 'uazapi':
          webhookResult = await setUAZAPIWebhook(channelConfig, channelData.instance_id, finalWebhookUrl, channelData.instance_token);
          break;
        case 'evolution':
          webhookResult = await setEvolutionWebhook(channelConfig, channelData.instance_id, finalWebhookUrl);
          break;
        default:
          webhookResult = { success: false, error: 'Provedor desconhecido' };
      }

      if (webhookResult.success) {
        // Atualizar webhook_url no banco de dados
        const { error: updateError } = await supabase
          .from('whatsapp_channels')
          .update({ 
            webhook_url: finalWebhookUrl,
            updated_at: new Date().toISOString()
          })
          .eq('id', channelId);

        if (updateError) {
          console.error('[WhatsApp Instance] Error updating webhook_url:', updateError);
        } else {
          console.log('[WhatsApp Instance] webhook_url updated in database');
        }
      }

      return new Response(
        JSON.stringify({
          success: webhookResult.success,
          message: webhookResult.success 
            ? 'Webhook reconfigurado com sucesso! O canal agora receberá eventos de conexão e mensagens.'
            : webhookResult.error,
          webhookUrl: finalWebhookUrl,
          provider: channelProvider.code,
          instanceId: channelData.instance_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // SYNC STATUS - Sincroniza status do provedor para o banco
    // =====================================================
    if (action === 'syncStatus') {
      const syncChannelId = body.channelId as string;
      console.log('[WhatsApp Instance] Syncing status for channel:', syncChannelId);
      
      if (!syncChannelId) {
        return new Response(
          JSON.stringify({ success: false, error: 'channelId é obrigatório' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Fetch channel from database
      const { data: syncChannel, error: syncChannelError } = await supabase
        .from('whatsapp_channels')
        .select('*, provider:whatsapp_providers(*)')
        .eq('id', syncChannelId)
        .single();
      
      if (syncChannelError || !syncChannel) {
        return new Response(
          JSON.stringify({ success: false, error: 'Canal não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      const syncProvider = syncChannel.provider as any;
      const syncConfig: ProviderConfig = {
        baseUrl: normalizeBaseUrl(syncProvider?.base_url || ''),
        adminToken: syncProvider?.admin_token || '',
        clientToken: syncProvider?.client_token || '',
      };
      
      let statusResult: any;
      
      // Get status from provider
      switch (syncProvider?.code) {
        case 'uazapi':
          statusResult = await getUAZAPIStatus(syncConfig, syncChannel.instance_id!, syncChannel.instance_token);
          break;
        case 'evolution':
          statusResult = await getEvolutionStatus(syncConfig, syncChannel.instance_id!);
          break;
        default:
          statusResult = { success: false, error: 'Provedor não suporta sincronização' };
      }
      
      console.log('[WhatsApp Instance] Status result:', statusResult);
      
      if (statusResult.success) {
        // Determine new status and phone
        // FIX: UAZAPI/Evolution podem retornar `state` como objeto ({ connected, loggedIn, jid })
        // ou como string ("open"/"connected"). Precisamos suportar ambos.
        let newStatus = 'disconnected';
        let phone = syncChannel.phone || '';
        
        const statusStr = statusResult.status;
        const state = statusResult.state as any;
        
        const stateIsObject = !!state && typeof state === 'object';
        const stateConnected = stateIsObject && (state.connected === true || state.loggedIn === true);
        const stateStr = typeof state === 'string' ? (state as string) : undefined;
        
        const isConnected =
          statusStr === 'connected' ||
          stateConnected ||
          stateStr === 'open' ||
          stateStr === 'connected';
        
        if (isConnected) {
          newStatus = 'connected';
        }
        
        // Extract phone from ownerJid (preferred) or from state.jid fallback
        const candidateJid: string | undefined =
          (statusResult.ownerJid as string | undefined) ||
          (stateIsObject && typeof state.jid === 'string' ? state.jid : undefined);
        
        if (candidateJid) {
          const jidPhone = candidateJid.split(':')[0].split('@')[0];
          if (jidPhone && jidPhone.length >= 10) {
            phone = jidPhone;
          }
        }
        
        console.log('[syncStatus] Resultado:', { stateStr, statusStr, isConnected, newStatus, phone });
        
        // Update channel in database
        const { error: updateError } = await supabase
          .from('whatsapp_channels')
          .update({
            status: newStatus,
            phone: phone,
            last_sync_at: new Date().toISOString(),
          })
          .eq('id', syncChannelId);
        
        if (updateError) {
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao atualizar banco: ' + updateError.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            status: newStatus,
            phone: phone,
            providerState: stateStr,
            message: newStatus === 'connected' ? 'Canal conectado e sincronizado!' : 'Status sincronizado'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ success: false, error: statusResult.error || 'Erro ao obter status do provedor' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // =====================================================
    // LOGOUT INSTANCE - Desconectar instância (resetar estado travado)
    // =====================================================
    if (action === 'logoutInstance') {
      const logoutChannelId = body.channelId as string;
      console.log('[WhatsApp Instance] Logout instance for channel:', logoutChannelId);
      
      if (!logoutChannelId) {
        return new Response(
          JSON.stringify({ success: false, error: 'channelId é obrigatório' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }

      // Fetch channel from database
      const { data: logoutChannel, error: logoutChannelError } = await supabase
        .from('whatsapp_channels')
        .select('*, provider:whatsapp_providers(*)')
        .eq('id', logoutChannelId)
        .single();
      
      if (logoutChannelError || !logoutChannel) {
        return new Response(
          JSON.stringify({ success: false, error: 'Canal não encontrado' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }

      const logoutProvider = logoutChannel.provider as any;
      const logoutConfig: ProviderConfig = {
        baseUrl: normalizeBaseUrl(logoutProvider?.base_url || ''),
        adminToken: logoutProvider?.admin_token || '',
        clientToken: logoutProvider?.client_token || '',
      };
      
      let logoutResult: any;
      
      switch (logoutProvider?.code) {
        case 'uazapi':
          logoutResult = await logoutUAZAPIInstance(logoutConfig.baseUrl, logoutChannel.instance_token || '');
          break;
        case 'evolution':
          logoutResult = await logoutEvolutionInstance(logoutConfig, logoutChannel.instance_id!);
          break;
        case 'zapi':
          logoutResult = { success: false, error: 'Z-API não suporta logout via API' };
          break;
        default:
          logoutResult = { success: false, error: 'Provedor desconhecido' };
      }
      
      console.log('[WhatsApp Instance] Logout result:', logoutResult);
      
      if (logoutResult.success) {
        // Atualizar status para disconnected
        await supabase
          .from('whatsapp_channels')
          .update({ status: 'disconnected', updated_at: new Date().toISOString() })
          .eq('id', logoutChannelId);
      }
      
      return new Response(
        JSON.stringify(logoutResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =====================================================
    // OUTRAS AÇÕES - Requerem providerCode
    // =====================================================
    if (!providerCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'providerCode é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

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

    // Sempre usar admin_token do banco de dados (mais confiável)
    const adminToken = provider.admin_token;
    console.log(`[WhatsApp Instance] Using provider ${provider.name} (is_shared: ${provider.is_shared}), admin_token from DB`);

    if (!provider.is_configured && !adminToken) {
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
      adminToken: adminToken || '',
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
          result = await deleteUAZAPIInstance(config, instanceId!, instanceToken);
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
          result = await getUAZAPIStatus(config, instanceId!, instanceToken);
          break;
        case 'evolution':
          result = await getEvolutionStatus(config, instanceId!);
          break;
        default:
          result = { success: false, error: 'Provedor desconhecido' };
      }
    } else if (action === 'setWebhook') {
      // Reconfigure webhook for existing instance
      const finalWebhookUrl = webhookUrl || `${supabaseUrl}/functions/v1/whatsapp-webhook?provider=${providerCode}`;
      console.log('[WhatsApp Instance] Setting webhook for:', instanceId, 'URL:', finalWebhookUrl);
      
      switch (providerCode) {
        case 'zapi':
          result = { success: false, error: 'Z-API não suporta reconfiguração de webhook via esta API' };
          break;
        case 'uazapi':
          result = await setUAZAPIWebhook(config, instanceId!, finalWebhookUrl, instanceToken);
          break;
        case 'evolution':
          result = await setEvolutionWebhook(config, instanceId!, finalWebhookUrl);
          break;
        default:
          result = { success: false, error: 'Provedor desconhecido' };
      }
    } else if (action === 'fetchWebhook') {
      // Fetch current webhook configuration
      console.log('[WhatsApp Instance] Fetching webhook config for:', instanceId);
      
      switch (providerCode) {
        case 'zapi':
          result = { success: false, error: 'Z-API não suporta consulta de webhook' };
          break;
        case 'uazapi':
          result = { success: false, error: 'UAZAPI não suporta consulta de webhook' };
          break;
        case 'evolution':
          result = await fetchEvolutionWebhook(config, instanceId!);
          break;
        default:
          result = { success: false, error: 'Provedor desconhecido' };
      }
    } else if (action === 'restartInstance') {
      // Restart instance to apply configurations
      console.log('[WhatsApp Instance] Restarting instance:', instanceId);
      
      switch (providerCode) {
        case 'zapi':
          result = { success: false, error: 'Z-API não suporta reinício de instância' };
          break;
        case 'uazapi':
          result = { success: false, error: 'UAZAPI não suporta reinício de instância' };
          break;
        case 'evolution':
          result = await restartEvolutionInstance(config, instanceId!);
          break;
        default:
          result = { success: false, error: 'Provedor desconhecido' };
      }
    } else if (action === 'setSettings') {
      // Configure instance settings
      console.log('[WhatsApp Instance] Setting settings for:', instanceId);
      
      switch (providerCode) {
        case 'zapi':
          result = { success: false, error: 'Z-API não suporta configuração de settings' };
          break;
        case 'uazapi':
          result = { success: false, error: 'UAZAPI não suporta configuração de settings' };
          break;
        case 'evolution':
          result = await setEvolutionSettings(config, instanceId!);
          break;
        default:
          result = { success: false, error: 'Provedor desconhecido' };
      }
  } else if (action === 'configureChannel') {
      // Full channel configuration: settings + webhook + restart + verify
      console.log('[WhatsApp Instance] Full channel configuration for:', instanceId);
      const finalWebhookUrl = webhookUrl || `${supabaseUrl}/functions/v1/whatsapp-webhook?provider=${providerCode}`;
      
      if (providerCode !== 'evolution') {
        result = { success: false, error: 'Configuração completa disponível apenas para Evolution API' };
      } else {
        const steps: any[] = [];
        
        // Step 1: Set Settings
        const settingsResult = await setEvolutionSettings(config, instanceId!);
        steps.push({ step: 'settings', ...settingsResult });
        
        // Step 2: Set Webhook
        const webhookResult = await setEvolutionWebhook(config, instanceId!, finalWebhookUrl);
        steps.push({ step: 'webhook', ...webhookResult });
        
        // Step 3: Restart Instance
        const restartResult = await restartEvolutionInstance(config, instanceId!);
        steps.push({ step: 'restart', ...restartResult });
        
        // Wait a bit for restart to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 4: Fetch Webhook to verify
        const verifyResult = await fetchEvolutionWebhook(config, instanceId!);
        steps.push({ step: 'verify', ...verifyResult });
        
        const allSuccess = steps.every(s => s.success);
        const hasMessagesUpsert = verifyResult.events?.includes('MESSAGES_UPSERT');
        
        result = {
          success: allSuccess,
          message: allSuccess 
            ? `Canal configurado com sucesso! MESSAGES_UPSERT: ${hasMessagesUpsert ? 'ATIVO' : 'INATIVO'}`
            : 'Algumas etapas falharam',
          steps,
          webhookEnabled: verifyResult.enabled,
          webhookUrl: verifyResult.url,
          webhookEvents: verifyResult.events,
          messagesUpsertActive: hasMessagesUpsert
        };
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
