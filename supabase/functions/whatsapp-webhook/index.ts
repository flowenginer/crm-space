import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://esm.sh/base64-arraybuffer@1.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type WhatsAppProvider = "zapi" | "uazapi" | "evolution";
type MessageType = "text" | "image" | "audio" | "video" | "document" | "sticker" | "location" | "contact";

// =====================================================
// REFERRAL DATA - Meta Ads / Click-to-WhatsApp
// =====================================================
interface ReferralData {
  ctwaClid?: string;        // Click-to-WhatsApp Click ID
  sourceId?: string;        // ID do anúncio/post
  sourceType?: string;      // 'ad' | 'post'
  sourceUrl?: string;       // URL do anúncio
  headline?: string;        // Título do anúncio
  body?: string;            // Texto do anúncio
  mediaType?: string;       // 'image' | 'video'
  imageUrl?: string;        // URL da imagem
  videoUrl?: string;        // URL do vídeo
  thumbnailUrl?: string;    // URL da thumbnail
  showAdAttribution?: boolean;
  adName?: string;          // Nome do anúncio
  campaignName?: string;    // Nome da campanha
}

interface NormalizedMessage {
  id: string;
  provider: WhatsAppProvider;
  instanceId: string;
  from: string;
  fromName?: string;
  isFromMe: boolean;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  mediaBase64?: string;
  mediaMimeType?: string;
  caption?: string;
  timestamp: Date;
  quotedMessageId?: string;
  status: string;
  originalId: string;
  referralData?: ReferralData;
}

// =====================================================
// PHONE VALIDATION FUNCTIONS
// =====================================================

/**
 * Validates if a phone number is a valid Brazilian phone
 * Brazilian phones: start with 55, have 12-13 digits total
 * This filters out LID (Linked IDs) from Evolution API
 */
function isValidBrazilianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  
  // Must start with 55 (Brazil country code)
  if (!digits.startsWith('55')) {
    return false;
  }
  
  // Must have 12-13 digits (55 + 10-11 local digits)
  if (digits.length < 12 || digits.length > 13) {
    return false;
  }
  
  return true;
}

/**
 * Attempts to extract a valid Brazilian phone from various payload locations
 * Returns the phone number or null if no valid phone found
 */
function extractValidPhoneFromPayload(msg: any, rawRemoteJid: string): string | null {
  // Priority 1: remoteJidAlt (real number when LID is used)
  if (msg.key?.remoteJidAlt) {
    const altPhone = msg.key.remoteJidAlt
      .replace("@s.whatsapp.net", "")
      .replace("@c.us", "")
      .replace(/\D/g, "");
    
    if (isValidBrazilianPhone(altPhone)) {
      console.log(`[Webhook] Found valid phone in remoteJidAlt: ${altPhone}`);
      return altPhone;
    }
  }
  
  // Priority 2: Main remoteJid
  const mainPhone = rawRemoteJid
    .replace("@s.whatsapp.net", "")
    .replace("@c.us", "")
    .replace("@lid", "")
    .replace(/\D/g, "");
  
  if (isValidBrazilianPhone(mainPhone)) {
    return mainPhone;
  }
  
  // Priority 3: Check referral data for phone (Meta Ads sometimes includes it)
  if (msg.contextInfo?.referral?.phone) {
    const referralPhone = msg.contextInfo.referral.phone.replace(/\D/g, "");
    if (isValidBrazilianPhone(referralPhone)) {
      console.log(`[Webhook] Found valid phone in referral data: ${referralPhone}`);
      return referralPhone;
    }
  }
  
  // No valid phone found
  return null;
}

// =====================================================
// MEDIA UPLOAD FUNCTIONS
// =====================================================

function getExtensionFromMimetype(mimetype: string): string {
  const mimeMap: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/ogg; codecs=opus': 'ogg',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/3gpp': '3gp',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  };
  
  // Clean mimetype (remove params like "; codecs=opus")
  const cleanMime = mimetype.split(';')[0].trim();
  return mimeMap[mimetype] || mimeMap[cleanMime] || 'bin';
}

async function uploadMediaToStorage(
  supabase: any,
  base64Data: string,
  mimetype: string,
  conversationId: string
): Promise<string | null> {
  try {
    console.log(`[Webhook] Uploading media to storage - Mimetype: ${mimetype}, ConversationId: ${conversationId}`);
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const extension = getExtensionFromMimetype(mimetype);
    const fileName = `${timestamp}_${randomId}.${extension}`;
    const filePath = `${conversationId}/${fileName}`;
    
    // Decode base64 to ArrayBuffer
    const buffer = decode(base64Data);
    
    console.log(`[Webhook] Decoded base64, size: ${buffer.byteLength} bytes`);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('conversation-attachments')
      .upload(filePath, buffer, {
        contentType: mimetype.split(';')[0].trim(), // Clean mimetype
        upsert: false
      });
    
    if (error) {
      console.error('[Webhook] Storage upload error:', error);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('conversation-attachments')
      .getPublicUrl(filePath);
    
    console.log(`[Webhook] Media uploaded successfully: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  } catch (error) {
    console.error('[Webhook] Error uploading media:', error);
    return null;
  }
}

// =====================================================
// FETCH MEDIA FROM EVOLUTION API
// =====================================================

async function fetchMediaBase64FromEvolution(
  baseUrl: string,
  apiKey: string,
  instanceName: string,
  messageKey: { id: string; remoteJid: string; fromMe: boolean }
): Promise<{ base64: string | null; mimetype: string | null }> {
  try {
    console.log(`[Webhook] Fetching media base64 from Evolution API for message: ${messageKey.id}`);
    
    // Normalize base URL
    let normalizedUrl = baseUrl.replace(/\/+$/, '');
    if (normalizedUrl.endsWith('/manager')) {
      normalizedUrl = normalizedUrl.replace(/\/manager$/, '');
    }
    
    const response = await fetch(`${normalizedUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        message: {
          key: messageKey
        },
        convertToMp4: false  // Keep original format (ogg) which is supported by Storage
      })
    });
    
    if (!response.ok) {
      console.error(`[Webhook] Failed to fetch media from Evolution: ${response.status} ${response.statusText}`);
      return { base64: null, mimetype: null };
    }
    
    const data = await response.json();
    console.log(`[Webhook] Media fetched successfully, base64 length: ${data.base64?.length || 0}`);
    
    return {
      base64: data.base64 || null,
      mimetype: data.mimetype || null
    };
  } catch (error) {
    console.error('[Webhook] Error fetching media from Evolution:', error);
    return { base64: null, mimetype: null };
  }
}

function extractEvolutionMediaBase64(msg: any): { base64: string | null; mimetype: string | null } {
  const message = msg.message;
  if (!message) return { base64: null, mimetype: null };
  
  // Check each media type for base64 data
  if (message.audioMessage?.base64) {
    console.log(`[Webhook] Found audio base64, length: ${message.audioMessage.base64.length}`);
    return { 
      base64: message.audioMessage.base64, 
      mimetype: message.audioMessage.mimetype || 'audio/ogg; codecs=opus' 
    };
  }
  if (message.imageMessage?.base64) {
    console.log(`[Webhook] Found image base64, length: ${message.imageMessage.base64.length}`);
    return { 
      base64: message.imageMessage.base64, 
      mimetype: message.imageMessage.mimetype || 'image/jpeg' 
    };
  }
  if (message.videoMessage?.base64) {
    console.log(`[Webhook] Found video base64, length: ${message.videoMessage.base64.length}`);
    return { 
      base64: message.videoMessage.base64, 
      mimetype: message.videoMessage.mimetype || 'video/mp4' 
    };
  }
  if (message.documentMessage?.base64) {
    console.log(`[Webhook] Found document base64, length: ${message.documentMessage.base64.length}`);
    return { 
      base64: message.documentMessage.base64, 
      mimetype: message.documentMessage.mimetype || 'application/octet-stream' 
    };
  }
  if (message.stickerMessage?.base64) {
    console.log(`[Webhook] Found sticker base64, length: ${message.stickerMessage.base64.length}`);
    return { 
      base64: message.stickerMessage.base64, 
      mimetype: message.stickerMessage.mimetype || 'image/webp' 
    };
  }
  
  return { base64: null, mimetype: null };
}

// =====================================================
// EXTRACT REFERRAL DATA - Click-to-WhatsApp / Meta Ads
// =====================================================
function extractReferralData(msg: any): ReferralData | null {
  const message = msg.message;
  if (!message) return null;
  
  // Log para debug - ver estrutura completa do contextInfo
  console.log(`[Webhook] Checking for referral data in message...`);
  
  // Tentar encontrar contextInfo em diferentes locais
  const contextInfo = 
    msg.contextInfo ||
    message.contextInfo ||
    message.extendedTextMessage?.contextInfo ||
    message.messageContextInfo ||
    message.imageMessage?.contextInfo ||
    message.videoMessage?.contextInfo ||
    message.documentMessage?.contextInfo;
  
  if (!contextInfo) return null;
  
  // Log detalhado do contextInfo para debug
  console.log(`[Webhook] contextInfo found:`, JSON.stringify(contextInfo).substring(0, 1000));
  
  // Verificar se há dados de anúncio
  const hasAdData = contextInfo.showAdAttribution || 
                    contextInfo.entryPointConversionSource || 
                    contextInfo.adReplyInfo ||
                    contextInfo.externalAdReply ||
                    contextInfo.ctwaClid;
  
  if (!hasAdData) return null;
  
  // Extrair dados de diferentes formatos do Evolution API
  const entryPoint = contextInfo.entryPointConversionSource || {};
  const adReply = contextInfo.adReplyInfo || contextInfo.externalAdReply || {};
  
  // Log para debug
  console.log(`[Webhook] entryPoint:`, JSON.stringify(entryPoint).substring(0, 500));
  console.log(`[Webhook] adReply:`, JSON.stringify(adReply).substring(0, 500));
  
  // Função auxiliar para validar e extrair URLs (detecta e ignora bytes/objetos binários)
  const extractValidUrl = (...sources: any[]): string | undefined => {
    for (const source of sources) {
      // Verificar se é string válida iniciando com http
      if (typeof source === 'string' && source.startsWith('http')) {
        return source;
      }
      
      // Se for objeto, verificar se é dados binários (bytes) e ignorar
      if (source && typeof source === 'object' && !Array.isArray(source)) {
        const keys = Object.keys(source);
        // Detectar padrão de bytes: objeto com chaves numéricas (0, 1, 2, 3...)
        if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
          console.log(`[Webhook] ⚠️ Ignorando dados binários (bytes) como URL - ${keys.length} bytes detectados`);
          continue;
        }
        
        // Tentar extrair URL de propriedades conhecidas do objeto
        if (typeof source.url === 'string' && source.url.startsWith('http')) {
          return source.url;
        }
      }
    }
    return undefined;
  };
  
  // Função para extrair texto (evitar bytes/objetos)
  const extractText = (...sources: any[]): string | undefined => {
    for (const source of sources) {
      if (typeof source === 'string' && source.length > 0 && source.length < 5000) {
        return source;
      }
    }
    return undefined;
  };
  
  const referralData: ReferralData = {
    ctwaClid: extractText(contextInfo.ctwaClid, entryPoint.ctwaClid),
    sourceId: extractText(entryPoint.sourceId, adReply.sourceId),
    sourceType: extractText(entryPoint.sourceType, adReply.sourceType) || (contextInfo.showAdAttribution ? 'ad' : undefined),
    sourceUrl: extractValidUrl(entryPoint.sourceUrl, adReply.sourceUrl, adReply.url),
    headline: extractText(adReply.headline, adReply.title),
    body: extractText(adReply.body, adReply.description, adReply.text),
    mediaType: extractText(adReply.mediaType),
    // Validar URLs de imagem (evitar salvar bytes como base64)
    imageUrl: extractValidUrl(adReply.thumbnail, adReply.thumbnailUrl, adReply.imageUrl, adReply.previewUrl),
    videoUrl: extractValidUrl(adReply.videoUrl),
    thumbnailUrl: extractValidUrl(adReply.thumbnail, adReply.thumbnailUrl, adReply.previewUrl),
    showAdAttribution: contextInfo.showAdAttribution === true,
    adName: extractText(adReply.adName, adReply.title, adReply.name),
    campaignName: extractText(adReply.campaignName, adReply.campaign),
  };
  
  // Limpar campos undefined
  Object.keys(referralData).forEach(key => {
    if (referralData[key as keyof ReferralData] === undefined) {
      delete referralData[key as keyof ReferralData];
    }
  });
  
  // Verificar se temos pelo menos um dado útil
  if (Object.keys(referralData).length === 0 || 
      (Object.keys(referralData).length === 1 && referralData.showAdAttribution === false)) {
    return null;
  }
  
  console.log(`[Webhook] 📣 REFERRAL DATA EXTRACTED (Meta Ads):`, JSON.stringify(referralData));
  
  return referralData;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") as WhatsAppProvider || "evolution";

    const payload = await req.json();
    
    // === DEBUG LOGGING ===
    console.log(`[Webhook] Received from ${provider}:`, JSON.stringify(payload).substring(0, 800));
    
    // Audio detection debug
    const hasAudio = 
      payload.audio ||
      payload.message?.audioMessage ||
      payload.data?.message?.audioMessage ||
      payload.data?.audio ||
      payload.type === 'audio' ||
      payload.type === 'ptt' ||
      payload.messageType === 'audio';
    
    if (hasAudio) {
      console.log('🎵 [Webhook] AUDIO DETECTED!');
      const audioData = payload.audio || payload.data?.message?.audioMessage || payload.message?.audioMessage;
      console.log('🎵 [Webhook] Has base64:', !!audioData?.base64);
      console.log('🎵 [Webhook] Audio URL:', audioData?.url);
      console.log('🎵 [Webhook] Mimetype:', audioData?.mimetype);
    }

    // Extract instance ID
    const instanceId = extractInstanceId(provider, payload);
    
    // Determine event type
    const eventType = getEventType(provider, payload);
    
    // =====================================================
    // OTIMIZAÇÃO CRÍTICA: Filtrar eventos que sobrecarregam o banco
    // Lista expandida baseada em análise de logs (32k+ eventos/dia)
    // =====================================================
    const normalizedEventType = eventType?.toLowerCase().replace(/_/g, '.') || '';
    
    // Eventos que NUNCA devem ser logados (alta frequência, baixo valor)
    const neverLogPatterns = [
      'presence', 'typing', 'composing', 'recording', 'available', 'unavailable',
      'qrcode', 'connection', 'connecting', 'close', 'open',
      'chats.set', 'chats.upsert', 'chats.update', 'chats.delete',
      'contacts.set', 'contacts.upsert', 'contacts.update',
      'groups.upsert', 'groups.update', 'group.participants',
      'labels.edit', 'labels.association',
      'call', 'blocklist'
    ];
    
    // Verificar se deve pular o log
    const shouldSkipLog = neverLogPatterns.some(pattern => 
      normalizedEventType.includes(pattern)
    );
    
    // messages.update só deve ser logado se for status importante (delivered, read, failed)
    // Não logar status intermediários que geram muito volume
    const isMessageUpdate = normalizedEventType.includes('messages.update');
    const isImportantStatus = isMessageUpdate && payload.data?.some?.((item: any) => 
      ['READ', 'DELIVERY_ACK', 'PLAYED', 'FAILED', 'ERROR'].includes(item?.update?.status)
    );
    
    // Só logar eventos de mensagem importantes
    const isImportantMessageEvent = 
      normalizedEventType.includes('messages.upsert') || 
      normalizedEventType.includes('send.message');
    
    const shouldLog = !shouldSkipLog && (isImportantMessageEvent || isImportantStatus);
    
    if (shouldLog) {
      // Log webhook apenas para eventos importantes (reduz ~95% do volume)
      await supabase.from("webhook_logs").insert({
        provider,
        event_type: eventType,
        instance_id: instanceId,
        payload: { 
          // Resumir payload para economizar espaço
          event: eventType,
          from: payload.data?.[0]?.key?.remoteJid || payload.data?.key?.remoteJid,
          isFromMe: payload.data?.[0]?.key?.fromMe || payload.data?.key?.fromMe,
          type: payload.data?.[0]?.message ? Object.keys(payload.data[0].message)[0] : 'unknown'
        },
      });
    }

    // Handle connection status updates
    if (isConnectionEvent(provider, payload)) {
      console.log(`[Webhook] Processing connection event for instance: ${instanceId}`);
      await handleConnectionEvent(supabase, provider, instanceId, payload);
      return new Response(JSON.stringify({ success: true, message: "Connection event processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle presence updates (online/offline status)
    if (isPresenceEvent(provider, payload)) {
      console.log(`[Webhook] Processing presence event`);
      await handlePresenceEvent(supabase, provider, payload);
      return new Response(JSON.stringify({ success: true, message: "Presence event processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle message status updates (ACK events - delivered, read)
    if (isMessageStatusEvent(provider, payload)) {
      console.log(`[Webhook] Processing message status event`);
      await handleMessageStatusEvent(supabase, provider, payload);
      return new Response(JSON.stringify({ success: true, message: "Status event processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this is a message event
    if (!isMessageEvent(provider, payload)) {
      console.log(`[Webhook] Not a message event, skipping`);
      return new Response(JSON.stringify({ success: true, message: "Event logged" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find channel by instance ID
    if (!instanceId) {
      console.log(`[Webhook] No instance ID found`);
      return new Response(JSON.stringify({ success: false, error: "No instance ID" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const { data: channel, error: channelError } = await supabase
      .from("whatsapp_channels")
      .select(`
        id, name, instance_id, department_id,
        provider:whatsapp_providers!inner(code, base_url, admin_token)
      `)
      .eq("instance_id", instanceId)
      .eq("is_deleted", false)
      .single();

    if (channelError || !channel) {
      console.log(`[Webhook] Channel not found for instance: ${instanceId}`);
      return new Response(JSON.stringify({ success: false, error: "Channel not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    // Normalize message
    const normalizedMessage = normalizeMessage(provider, payload);
    if (!normalizedMessage) {
      console.log(`[Webhook] Could not normalize message`);
      return new Response(JSON.stringify({ success: true, message: "Could not normalize" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================================
    // PROCESSAR MENSAGENS - TANTO RECEBIDAS QUANTO ENVIADAS (fromMe)
    // =====================================================
    
    if (normalizedMessage.isFromMe) {
      // Mensagem enviada pelo celular/outro dispositivo - salvar no sistema
      console.log(`[Webhook] Processing fromMe message to: ${normalizedMessage.from}`);
      
      // Para mensagens fromMe, o "from" é o destinatário (remoteJid)
      let recipientPhone = normalizedMessage.from;
      
      // =====================================================
      // CORREÇÃO LID: Se o telefone parece ser um LID (não é um número válido),
      // buscar a conversa mais recente do canal para encontrar o contato real
      // =====================================================
      let contact = null;
      let conversation = null;
      
      // Tentar buscar contato pelo telefone diretamente
      const { data: directContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("phone", recipientPhone)
        .single();
      
      if (directContact) {
        contact = directContact;
        // Buscar conversa existente com esse contato
        const { data: conv } = await supabase
          .from("conversations")
          .select("id")
          .eq("contact_id", contact.id)
          .eq("channel_id", channel.id)
          .in("status", ["open", "pending"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        conversation = conv;
      } else {
        // Contato não encontrado pelo telefone
        // IMPORTANTE: NÃO usar fallback de "conversa mais recente" para fromMe
        // pois isso causa mensagens indo para a conversa errada!
        // 
        // Se o telefone é um LID (não começa com 55 ou tem formato estranho),
        // logamos e pulamos - o contato será criado quando recebermos resposta
        
        const isLikelyLID = !recipientPhone.startsWith('55') || recipientPhone.length > 13;
        
        if (isLikelyLID) {
          console.log(`[Webhook] ⚠️ Phone ${recipientPhone} looks like a LID, skipping fromMe message to avoid wrong conversation`);
          return new Response(JSON.stringify({ success: true, message: "LID phone for fromMe, skipping" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        
        // Se é um telefone válido que não existe, será criado abaixo
        console.log(`[Webhook] Contact not found for valid phone ${recipientPhone}, will create new contact`);
      }

      // =====================================================
      // CRIAR CONTATO E CONVERSA SE NÃO EXISTIREM
      // Resolve race condition com sistemas externos como Jet Sales
      // =====================================================
      if (!contact) {
        console.log(`[Webhook] 🆕 Creating contact for fromMe message (external system): ${recipientPhone}`);
        
        const contactName = normalizedMessage.fromName || `WhatsApp ${recipientPhone}`;
        
        const { data: newContact, error: contactError } = await supabase
          .from("contacts")
          .insert({
            phone: recipientPhone,
            full_name: contactName,
            first_contact_at: new Date().toISOString(),
            origin: "whatsapp",
          })
          .select("id")
          .single();
        
        if (contactError) {
          // Se erro de duplicata (race condition), buscar o existente
          if (contactError.code === '23505') {
            console.log(`[Webhook] Contact already exists (race condition), fetching...`);
            const { data: existingContact } = await supabase
              .from("contacts")
              .select("id")
              .eq("phone", recipientPhone)
              .single();
            contact = existingContact;
          } else {
            console.error(`[Webhook] Error creating contact:`, contactError);
            throw contactError;
          }
        } else {
          contact = newContact;
          console.log(`[Webhook] ✅ Contact created: ${contact.id}`);
        }
      }

      if (!contact) {
        console.log(`[Webhook] Still no contact after creation attempt, skipping`);
        return new Response(JSON.stringify({ success: true, message: "Contact not found for fromMe" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!conversation) {
        console.log(`[Webhook] 🆕 Creating conversation for fromMe message (external system)`);
        
        const { data: newConv, error: convError } = await supabase
          .from("conversations")
          .insert({
            contact_id: contact.id,
            channel_id: channel.id,
            status: "open",
            is_unread: false, // Mensagem enviada por nós, não é unread
            unread_count: 0,
            last_message_at: new Date().toISOString(),
            last_message_preview: normalizedMessage.content?.substring(0, 100) || "[Mídia]",
          })
          .select("id")
          .single();
        
        if (convError) {
          // Se erro de duplicata (race condition), buscar existente
          if (convError.code === '23505') {
            console.log(`[Webhook] Conversation already exists (race condition), fetching...`);
            const { data: existingConv } = await supabase
              .from("conversations")
              .select("id")
              .eq("contact_id", contact.id)
              .eq("channel_id", channel.id)
              .in("status", ["open", "pending"])
              .order("created_at", { ascending: false })
              .limit(1)
              .single();
            conversation = existingConv;
          } else {
            console.error(`[Webhook] Error creating conversation:`, convError);
            throw convError;
          }
        } else {
          conversation = newConv;
          console.log(`[Webhook] ✅ Conversation created: ${conversation.id}`);
        }
      }

      if (!conversation) {
        console.log(`[Webhook] Still no conversation after creation attempt, skipping`);
        return new Response(JSON.stringify({ success: true, message: "No conversation for fromMe" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // =====================================================
      // PARA MENSAGENS fromMe: NÃO INSERIR - APENAS ATUALIZAR
      // O frontend já insere a mensagem otimisticamente
      // O webhook deve apenas atualizar com o whatsapp_message_id se necessário
      // =====================================================
      
      // Primeiro, verificar se já existe uma mensagem com esse whatsapp_message_id
      const { data: existingByWhatsappId } = await supabase
        .from("messages")
        .select("id")
        .eq("whatsapp_message_id", normalizedMessage.originalId)
        .maybeSingle();

      if (existingByWhatsappId) {
        console.log(`[Webhook] FromMe message already has whatsapp_message_id, skipping: ${normalizedMessage.originalId}`);
        return new Response(JSON.stringify({ success: true, message: "Message already exists" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Buscar mensagem recente do frontend que ainda não tem whatsapp_message_id
      // Procurar por mensagem do mesmo tipo, na mesma conversa, criada nos últimos 30 segundos
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      
      const { data: pendingMessages } = await supabase
        .from("messages")
        .select("id, content, message_type, media_url, whatsapp_message_id")
        .eq("conversation_id", conversation.id)
        .eq("is_from_me", true)
        .eq("message_type", normalizedMessage.type)
        .is("whatsapp_message_id", null)
        .gte("created_at", thirtySecondsAgo)
        .order("created_at", { ascending: false })
        .limit(5);

      if (pendingMessages && pendingMessages.length > 0) {
        // Encontrar a mensagem que mais se parece (mesmo conteúdo ou mídia similar)
        let matchedMessage = null;
        
        for (const msg of pendingMessages) {
          // Para mídia, qualquer mensagem pendente do mesmo tipo serve
          if (normalizedMessage.type !== 'text' && msg.message_type === normalizedMessage.type) {
            matchedMessage = msg;
            console.log(`[Webhook] Matched media message by type: ${normalizedMessage.type}`);
            break;
          }
          
          // Para texto, comparar conteúdo com múltiplas estratégias
          if (normalizedMessage.type === 'text' && msg.content && normalizedMessage.content) {
            const msgContent = msg.content.trim();
            const webhookContent = normalizedMessage.content.trim();
            
            // 1. Correspondência exata
            if (msgContent === webhookContent) {
              matchedMessage = msg;
              console.log(`[Webhook] Exact content match found`);
              break;
            }
            
            // 2. Webhook contém o conteúdo do frontend (assinatura "*Nome*:\n" foi adicionada)
            if (webhookContent.includes(msgContent) && msgContent.length > 0) {
              matchedMessage = msg;
              console.log(`[Webhook] Webhook content contains frontend content (signature added)`);
              break;
            }
            
            // 3. Frontend contém conteúdo do webhook
            if (msgContent.includes(webhookContent) && webhookContent.length > 0) {
              matchedMessage = msg;
              console.log(`[Webhook] Frontend content contains webhook content`);
              break;
            }
            
            // 4. Remover assinatura do padrão "*Nome*:\n" do webhook e comparar
            const contentWithoutSignature = webhookContent.replace(/^\*[^*]+\*:\n/, '');
            if (msgContent === contentWithoutSignature) {
              matchedMessage = msg;
              console.log(`[Webhook] Match after removing signature pattern`);
              break;
            }
            
            // 5. Comparar apenas a parte final do webhook (após última quebra de linha de assinatura)
            const lastLineBreakIdx = webhookContent.lastIndexOf('\n');
            if (lastLineBreakIdx > 0) {
              const afterSignature = webhookContent.substring(lastLineBreakIdx + 1).trim();
              if (msgContent === afterSignature || afterSignature.includes(msgContent)) {
                matchedMessage = msg;
                console.log(`[Webhook] Match after extracting content after signature`);
                break;
              }
            }
          }
        }

        if (matchedMessage) {
          console.log(`[Webhook] Found pending frontend message (id: ${matchedMessage.id}), updating with whatsapp_message_id: ${normalizedMessage.originalId}`);
          
          // Atualizar a mensagem existente com o whatsapp_message_id
          const updateData: any = {
            whatsapp_message_id: normalizedMessage.originalId,
            status: "sent",
          };

          // Se for mídia e tivermos base64, fazer upload e atualizar URL
          if (normalizedMessage.mediaUrl && !normalizedMessage.mediaBase64 && normalizedMessage.type !== 'text') {
            console.log(`[Webhook] FromMe media without base64, fetching from Evolution API...`);
            const provider = (channel as any).provider;
            if (provider?.code === 'evolution' && provider?.base_url && provider?.admin_token) {
              const mediaData = await fetchMediaBase64FromEvolution(
                provider.base_url,
                provider.admin_token,
                channel.instance_id || '',
                {
                  id: normalizedMessage.originalId,
                  remoteJid: normalizedMessage.from + '@s.whatsapp.net',
                  fromMe: normalizedMessage.isFromMe
                }
              );
              if (mediaData.base64) {
                normalizedMessage.mediaBase64 = mediaData.base64;
                normalizedMessage.mediaMimeType = mediaData.mimetype || normalizedMessage.mediaMimeType;
              }
            }
          }

          // Upload media if we have base64
          if (normalizedMessage.mediaBase64 && normalizedMessage.mediaMimeType) {
            console.log(`[Webhook] Uploading media for fromMe message update...`);
            const uploadedUrl = await uploadMediaToStorage(
              supabase,
              normalizedMessage.mediaBase64,
              normalizedMessage.mediaMimeType,
              conversation.id
            );
            if (uploadedUrl) {
              updateData.media_url = uploadedUrl;
              console.log(`[Webhook] FromMe media uploaded, updating URL`);
            }
          }

          await supabase
            .from("messages")
            .update(updateData)
            .eq("id", matchedMessage.id);

          console.log(`[Webhook] Updated frontend message with whatsapp_message_id`);
          return new Response(JSON.stringify({ success: true, message: "Frontend message updated" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Se não encontrou mensagem pendente, pode ser que o frontend não inseriu ainda
      // ou é uma mensagem enviada de outro dispositivo - nesse caso, inserir
      console.log(`[Webhook] No pending frontend message found, checking if sent from another device...`);
      
      // Verificar novamente se já existe (pode ter sido inserido enquanto processávamos)
      const { data: existingNow } = await supabase
        .from("messages")
        .select("id")
        .eq("whatsapp_message_id", normalizedMessage.originalId)
        .maybeSingle();

      if (existingNow) {
        console.log(`[Webhook] Message was inserted while processing, skipping: ${normalizedMessage.originalId}`);
        return new Response(JSON.stringify({ success: true, message: "Message already exists" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upload media if needed for new insert
      let finalMediaUrl = normalizedMessage.mediaUrl;
      if (normalizedMessage.mediaUrl && !normalizedMessage.mediaBase64 && normalizedMessage.type !== 'text') {
        const provider = (channel as any).provider;
        if (provider?.code === 'evolution' && provider?.base_url && provider?.admin_token) {
          const mediaData = await fetchMediaBase64FromEvolution(
            provider.base_url,
            provider.admin_token,
            channel.instance_id || '',
            {
              id: normalizedMessage.originalId,
              remoteJid: normalizedMessage.from + '@s.whatsapp.net',
              fromMe: normalizedMessage.isFromMe
            }
          );
          if (mediaData.base64) {
            normalizedMessage.mediaBase64 = mediaData.base64;
            normalizedMessage.mediaMimeType = mediaData.mimetype || normalizedMessage.mediaMimeType;
          }
        }
      }

      if (normalizedMessage.mediaBase64 && normalizedMessage.mediaMimeType) {
        const uploadedUrl = await uploadMediaToStorage(
          supabase,
          normalizedMessage.mediaBase64,
          normalizedMessage.mediaMimeType,
          conversation.id
        );
        if (uploadedUrl) {
          finalMediaUrl = uploadedUrl;
        }
      }

      // Find reply_to_message_id if quotedMessageId exists
      let replyToMessageIdFromMe = null;
      if (normalizedMessage.quotedMessageId) {
        const { data: quotedMsgFromMe } = await supabase
          .from("messages")
          .select("id")
          .eq("whatsapp_message_id", normalizedMessage.quotedMessageId)
          .single();
        
        if (quotedMsgFromMe) {
          replyToMessageIdFromMe = quotedMsgFromMe.id;
        }
      }

      // Inserir apenas se for de outro dispositivo (não encontrou mensagem pendente)
      const { error: msgError } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        content: normalizedMessage.content,
        message_type: normalizedMessage.type,
        media_url: finalMediaUrl,
        media_mime_type: normalizedMessage.mediaMimeType,
        is_from_me: true,
        status: "sent",
        whatsapp_message_id: normalizedMessage.originalId,
        created_at: normalizedMessage.timestamp.toISOString(),
        reply_to_message_id: replyToMessageIdFromMe,
      });

      if (msgError) {
        // Se for erro de duplicata, ignorar
        if (msgError.code === '23505') {
          console.log(`[Webhook] Duplicate message (constraint), skipping`);
          return new Response(JSON.stringify({ success: true, message: "Duplicate avoided" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error(`[Webhook] Error saving fromMe message:`, msgError);
        throw msgError;
      }

      // Atualizar conversa
      await supabase
        .from("conversations")
        .update({
          last_message_at: normalizedMessage.timestamp.toISOString(),
          last_message_preview: normalizedMessage.content.substring(0, 100),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation.id);

      console.log(`[Webhook] FromMe message from other device saved for conversation ${conversation.id}`);
      return new Response(JSON.stringify({ success: true, message: "FromMe message saved (other device)" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================================
    // MENSAGEM RECEBIDA (não fromMe) - Fluxo normal
    // =====================================================
    
    // =====================================================
    // FIND OR CREATE CONTACT (usando UPSERT para evitar race conditions)
    // =====================================================
    const contactName = normalizedMessage.fromName || `WhatsApp ${normalizedMessage.from}`;
    
    // Primeiro, tentar buscar o contato existente
    let { data: contact } = await supabase
      .from("contacts")
      .select("id, full_name, phone")
      .eq("phone", normalizedMessage.from)
      .single();

    if (!contact) {
      // Preparar dados de origem baseado em referral (Meta Ads)
      let origin = "whatsapp";
      let originCampaign: string | null = null;
      let referralDataJson: any = null;
      
      if (normalizedMessage.referralData) {
        origin = "meta_ads";
        originCampaign = normalizedMessage.referralData.headline || 
                         normalizedMessage.referralData.adName || 
                         normalizedMessage.referralData.campaignName ||
                         (normalizedMessage.referralData.ctwaClid ? `CTWA ${normalizedMessage.referralData.ctwaClid.substring(0, 8)}` : null);
        referralDataJson = normalizedMessage.referralData;
        console.log(`[Webhook] 📣 New contact from Meta Ads! Campaign: ${originCampaign}`);
      }
      
      // Usar upsert para evitar duplicatas por race condition
      const { data: upsertedContact, error: contactError } = await supabase
        .from("contacts")
        .upsert({
          phone: normalizedMessage.from,
          full_name: contactName,
          origin: origin,
          origin_campaign: originCampaign,
          referral_data: referralDataJson,
          first_contact_at: new Date().toISOString(),
        }, {
          onConflict: 'phone',
          ignoreDuplicates: false
        })
        .select("id, full_name, phone")
        .single();

      if (contactError) {
        // Se o erro for de duplicata, buscar o contato existente
        if (contactError.code === '23505') {
          console.log(`[Webhook] Contact already exists (race condition handled), fetching...`);
          const { data: existingContact } = await supabase
            .from("contacts")
            .select("id, full_name, phone")
            .eq("phone", normalizedMessage.from)
            .single();
          contact = existingContact;
          
          // Se o contato já existe mas tem dados de referral na mensagem atual, atualizar
          if (normalizedMessage.referralData && existingContact) {
            console.log(`[Webhook] 📣 Updating existing contact with Meta Ads data`);
            await supabase
              .from("contacts")
              .update({
                origin: "meta_ads",
                origin_campaign: originCampaign,
                referral_data: referralDataJson,
                updated_at: new Date().toISOString()
              })
              .eq("id", existingContact.id);
          }
        } else {
          console.error(`[Webhook] Error creating contact:`, contactError);
          throw contactError;
        }
      } else {
        contact = upsertedContact;
        console.log(`[Webhook] Created/upserted contact: ${contact?.full_name} (${contact?.phone})${origin === 'meta_ads' ? ' [Meta Ads]' : ''}`);
      }
    }
    
    // Atualizar nome do contato se tiver um pushName real e nome atual for genérico
    if (contact) {
      const currentName = contact.full_name || '';
      const hasGenericName = currentName.startsWith('WhatsApp ') || !currentName;
      const hasBetterName = normalizedMessage.fromName && normalizedMessage.fromName.trim().length > 0;
      
      if (hasGenericName && hasBetterName) {
        console.log(`[Webhook] Updating contact name from "${currentName}" to "${normalizedMessage.fromName}"`);
        await supabase
          .from("contacts")
          .update({ 
            full_name: normalizedMessage.fromName,
            updated_at: new Date().toISOString()
          })
          .eq("id", contact.id);
        contact.full_name = normalizedMessage.fromName;
      }
    }

    // Garantir que temos um contato válido
    if (!contact) {
      console.error(`[Webhook] Failed to find or create contact for phone: ${normalizedMessage.from}`);
      return new Response(JSON.stringify({ success: false, error: "Failed to create contact" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // =====================================================
    // OWNER AGENT SETTINGS - Fetch for reassignment rules
    // =====================================================
    const { data: companySettings } = await supabase
      .from("company_settings")
      .select("owner_agent_enabled, owner_agent_inactivity_days, owner_agent_on_reopen, owner_agent_reopen_reasons")
      .limit(1)
      .maybeSingle();

    const ownerAgentEnabled = companySettings?.owner_agent_enabled ?? true;
    const inactivityDays = companySettings?.owner_agent_inactivity_days ?? 7;
    const reopenToOwner = companySettings?.owner_agent_on_reopen ?? true;
    const reopenReasons = companySettings?.owner_agent_reopen_reasons ?? ['sold', 'no_interest', 'future_contact'];

    // Get contact's owner agent (assigned_to on contacts table)
    const { data: contactWithOwner } = await supabase
      .from("contacts")
      .select("assigned_to")
      .eq("id", contact.id)
      .single();
    
    const ownerAgentId = contactWithOwner?.assigned_to;

    // Find or create conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("id, status, assigned_to, close_reason, last_message_at")
      .eq("contact_id", contact.id)
      .eq("channel_id", channel.id)
      .in("status", ["open", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!conversation) {
      // Check if there's a closed conversation to potentially reopen
      const { data: closedConversation } = await supabase
        .from("conversations")
        .select("id, status, assigned_to, close_reason, last_message_at")
        .eq("contact_id", contact.id)
        .eq("channel_id", channel.id)
        .eq("status", "closed")
        .order("closed_at", { ascending: false })
        .limit(1)
        .single();

      if (closedConversation) {
        // Reopen the closed conversation
        console.log(`[Webhook] Reopening closed conversation: ${closedConversation.id}`);
        
        // Determine who should be assigned based on owner agent rules
        let newAssignedTo = closedConversation.assigned_to;
        
        if (ownerAgentEnabled && ownerAgentId && reopenToOwner) {
          const closeReason = closedConversation.close_reason || '';
          if (reopenReasons.includes(closeReason) || reopenReasons.length === 0) {
            console.log(`[Webhook] 👤 Reassigning reopened conversation to owner agent: ${ownerAgentId}`);
            newAssignedTo = ownerAgentId;
          }
        }

        // Se não tem atendente atribuído, reabre como "pending", senão como "open"
        const reopenStatus = newAssignedTo ? "open" : "pending";
        
        const { error: reopenError } = await supabase
          .from("conversations")
          .update({
            status: reopenStatus,
            is_unread: true,
            unread_count: 1,
            last_message_at: new Date().toISOString(),
            last_message_preview: normalizedMessage.content.substring(0, 100),
            assigned_to: newAssignedTo,
            updated_at: new Date().toISOString(),
          })
          .eq("id", closedConversation.id);

        if (reopenError) {
          console.error(`[Webhook] Error reopening conversation:`, reopenError);
          throw reopenError;
        }

        // Log event if reassigned
        if (newAssignedTo !== closedConversation.assigned_to) {
          await supabase.from("conversation_events").insert({
            conversation_id: closedConversation.id,
            event_type: "auto_reassign",
            data: {
              reason: "reopen_to_owner",
              from_user_id: closedConversation.assigned_to,
              to_user_id: newAssignedTo,
              note: "Reatribuição automática ao atendente responsável (reabertura)"
            }
          });
        }

        conversation = { 
          id: closedConversation.id, 
          status: "open", 
          assigned_to: newAssignedTo,
          close_reason: null,
          last_message_at: new Date().toISOString()
        };
      } else {
        // No existing conversation - create new one
        const conversationReferralSource = normalizedMessage.referralData ? "meta_ads" : null;
        const conversationReferralData = normalizedMessage.referralData || null;
        
        // For new conversations, assign to owner agent if available
        const initialAssignedTo = ownerAgentEnabled && ownerAgentId ? ownerAgentId : null;
        
        // Se tem atendente atribuído, cria como "open", senão como "pending"
        const initialStatus = initialAssignedTo ? "open" : "pending";
        
        const { data: newConversation, error: convError } = await supabase
          .from("conversations")
          .insert({
            contact_id: contact.id,
            channel_id: channel.id,
            department_id: channel.department_id || null,
            status: initialStatus,
            is_unread: true,
            unread_count: 1,
            last_message_at: new Date().toISOString(),
            last_message_preview: normalizedMessage.content.substring(0, 100),
            referral_source: conversationReferralSource,
            referral_data: conversationReferralData,
            assigned_to: initialAssignedTo,
          })
          .select("id, status, assigned_to, close_reason, last_message_at, department_id")
          .single();

        if (convError) {
          console.error(`[Webhook] Error creating conversation:`, convError);
          throw convError;
        }
        conversation = newConversation;
        
        if (conversationReferralSource) {
          console.log(`[Webhook] 📣 New conversation from Meta Ads!`);
        }
        if (initialAssignedTo) {
          console.log(`[Webhook] 👤 New conversation assigned to owner agent: ${initialAssignedTo}`);
        }
      }
    } else {
      // Conversation exists and is open - check inactivity rules
      let shouldReassignToOwner = false;
      
      if (ownerAgentEnabled && ownerAgentId && conversation.assigned_to !== ownerAgentId) {
        // Check if inactivity threshold is exceeded
        if (conversation.last_message_at) {
          const lastMessageDate = new Date(conversation.last_message_at);
          const daysSinceLastMessage = Math.floor((Date.now() - lastMessageDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceLastMessage >= inactivityDays) {
            console.log(`[Webhook] 👤 Inactivity threshold exceeded (${daysSinceLastMessage} days >= ${inactivityDays}), reassigning to owner`);
            shouldReassignToOwner = true;
          }
        }
      }

      // Update existing conversation
      const updateData: any = {
        last_message_at: new Date().toISOString(),
        last_message_preview: normalizedMessage.content.substring(0, 100),
        updated_at: new Date().toISOString(),
      };

      if (shouldReassignToOwner) {
        updateData.assigned_to = ownerAgentId;
        
        // Log reassignment event
        await supabase.from("conversation_events").insert({
          conversation_id: conversation.id,
          event_type: "auto_reassign",
          data: {
            reason: "inactivity",
            from_user_id: conversation.assigned_to,
            to_user_id: ownerAgentId,
            days_inactive: inactivityDays,
            note: `Reatribuição automática ao atendente responsável (${inactivityDays} dias de inatividade)`
          }
        });
      }

      await supabase.rpc("increment_unread", { conv_id: conversation.id });
      await supabase
        .from("conversations")
        .update(updateData)
        .eq("id", conversation.id);
    }

    // Ensure conversation is not null before proceeding
    if (!conversation) {
      console.error(`[Webhook] Failed to find or create conversation`);
      return new Response(JSON.stringify({ success: false, error: "Failed to create conversation" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // =====================================================
    // UPLOAD MEDIA TO STORAGE (received message)
    // =====================================================
    let finalMediaUrl = normalizedMessage.mediaUrl;
    
    // If media exists but no base64, fetch from Evolution API
    if (normalizedMessage.mediaUrl && !normalizedMessage.mediaBase64 && normalizedMessage.type !== 'text') {
      console.log(`[Webhook] Received media without base64, fetching from Evolution API...`);
      const provider = (channel as any).provider;
      if (provider?.code === 'evolution' && provider?.base_url && provider?.admin_token) {
        const mediaData = await fetchMediaBase64FromEvolution(
          provider.base_url,
          provider.admin_token,
          channel.instance_id || '',
          {
            id: normalizedMessage.originalId,
            remoteJid: normalizedMessage.from + '@s.whatsapp.net',
            fromMe: normalizedMessage.isFromMe
          }
        );
        if (mediaData.base64) {
          normalizedMessage.mediaBase64 = mediaData.base64;
          normalizedMessage.mediaMimeType = mediaData.mimetype || normalizedMessage.mediaMimeType;
        }
      }
    }
    
    // Now upload if we have base64
    if (normalizedMessage.mediaBase64 && normalizedMessage.mediaMimeType) {
      console.log(`[Webhook] Uploading media for received message...`);
      const uploadedUrl = await uploadMediaToStorage(
        supabase,
        normalizedMessage.mediaBase64,
        normalizedMessage.mediaMimeType,
        conversation.id
      );
      if (uploadedUrl) {
        finalMediaUrl = uploadedUrl;
        console.log(`[Webhook] Received media uploaded, using Supabase URL`);
      }
    }

    // Find reply_to_message_id if quotedMessageId exists
    let replyToMessageId = null;
    if (normalizedMessage.quotedMessageId) {
      console.log(`[Webhook] Looking for quoted message: ${normalizedMessage.quotedMessageId}`);
      const { data: quotedMsg } = await supabase
        .from("messages")
        .select("id")
        .eq("whatsapp_message_id", normalizedMessage.quotedMessageId)
        .single();
      
      if (quotedMsg) {
        replyToMessageId = quotedMsg.id;
        console.log(`[Webhook] Found quoted message, reply_to_message_id: ${replyToMessageId}`);
      } else {
        console.log(`[Webhook] Quoted message not found in database`);
      }
    }

    // Check if message already exists (deduplicate webhooks)
    const { data: existingReceivedMsg } = await supabase
      .from("messages")
      .select("id")
      .eq("whatsapp_message_id", normalizedMessage.originalId)
      .maybeSingle();

    if (existingReceivedMsg) {
      console.log(`[Webhook] Received message already exists (id: ${existingReceivedMsg.id}), skipping duplicate`);
      return new Response(JSON.stringify({ success: true, message: "Message already exists" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save message
    const { error: msgError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      contact_id: contact.id,
      content: normalizedMessage.content,
      message_type: normalizedMessage.type,
      media_url: finalMediaUrl,
      media_mime_type: normalizedMessage.mediaMimeType,
      is_from_me: false,
      status: "delivered",
      whatsapp_message_id: normalizedMessage.originalId,
      created_at: normalizedMessage.timestamp.toISOString(),
      reply_to_message_id: replyToMessageId,
    });

    if (msgError) {
      console.error(`[Webhook] Error saving message:`, msgError);
      throw msgError;
    }

    // Update channel stats
    await supabase
      .from("whatsapp_channels")
      .update({
        messages_received: (channel as any).messages_received + 1 || 1,
        messages_received_today: (channel as any).messages_received_today + 1 || 1,
        last_sync_at: new Date().toISOString(),
      })
      .eq("id", channel.id);

    console.log(`[Webhook] Message saved successfully for conversation ${conversation.id}`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[Webhook] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

function getEventType(provider: WhatsAppProvider, payload: any): string {
  switch (provider) {
    case "zapi":
      return payload.type || payload.event || "message";
    case "uazapi":
      return payload.event || payload.type || "message";
    case "evolution":
      return (payload.event || "message").toLowerCase().replace(/_/g, '.');
    default:
      return "unknown";
  }
}

function isConnectionEvent(provider: WhatsAppProvider, payload: any): boolean {
  switch (provider) {
    case "zapi":
      return payload.type === "connection_update" || 
             payload.event === "connection" ||
             payload.connected !== undefined;
    case "uazapi":
      return payload.event === "connection.update" || 
             payload.event === "status" ||
             payload.type === "connection";
    case "evolution":
      const evolutionConnEvent = (payload.event || "").toLowerCase().replace(/_/g, '.');
      return evolutionConnEvent === "connection.update";
    default:
      return false;
  }
}

async function handleConnectionEvent(
  supabase: any, 
  provider: WhatsAppProvider, 
  instanceId: string, 
  payload: any
): Promise<void> {
  if (!instanceId) {
    console.log("[Webhook] No instance ID for connection event");
    return;
  }

  let newStatus: "connected" | "disconnected" = "disconnected";
  let ownerPhone: string | null = null;

  switch (provider) {
    case "zapi":
      newStatus = payload.connected === true ? "connected" : "disconnected";
      ownerPhone = payload.phone || payload.owner;
      break;
    case "uazapi":
      const uazapiState = payload.data?.state || payload.state;
      newStatus = uazapiState === "open" || uazapiState === "connected" ? "connected" : "disconnected";
      ownerPhone = payload.data?.wuid?.replace("@s.whatsapp.net", "") || 
                   payload.owner?.replace("@s.whatsapp.net", "");
      break;
    case "evolution":
      const evolutionState = payload.data?.state || payload.state;
      newStatus = evolutionState === "open" ? "connected" : "disconnected";
      ownerPhone = payload.sender?.replace("@s.whatsapp.net", "") || 
                   payload.data?.wuid?.replace("@s.whatsapp.net", "") ||
                   payload.data?.owner?.replace("@s.whatsapp.net", "");
      break;
  }

  console.log(`[Webhook] Connection update - Instance: ${instanceId}, Status: ${newStatus}, Phone: ${ownerPhone}`);

  const { data: channel, error: channelError } = await supabase
    .from("whatsapp_channels")
    .select("id, name, phone, status")
    .eq("instance_id", instanceId)
    .eq("is_deleted", false)
    .single();

  if (channelError || !channel) {
    console.log(`[Webhook] Channel not found for connection update: ${instanceId}`);
    return;
  }

  const updateData: any = {
    status: newStatus,
    last_sync_at: new Date().toISOString(),
  };

  if (ownerPhone && (!channel.phone || channel.phone === "Aguardando conexão" || channel.phone === "Não identificado")) {
    updateData.phone = ownerPhone;
  }

  const { error: updateError } = await supabase
    .from("whatsapp_channels")
    .update(updateData)
    .eq("id", channel.id);

  if (updateError) {
    console.error(`[Webhook] Error updating channel status:`, updateError);
  } else {
    console.log(`[Webhook] Channel ${channel.name} status updated to ${newStatus}`);
  }
}

// =====================================================
// PRESENCE EVENTS - Detectar online/offline dos contatos
// =====================================================

function isPresenceEvent(provider: WhatsAppProvider, payload: any): boolean {
  switch (provider) {
    case "zapi":
      return payload.type === "presence" || payload.event === "presence.update";
    case "uazapi":
      return payload.event === "presence.update";
    case "evolution":
      const evolutionEvent = (payload.event || "").toLowerCase().replace(/_/g, '.');
      return evolutionEvent === "presence.update";
    default:
      return false;
  }
}

async function handlePresenceEvent(
  supabase: any,
  provider: WhatsAppProvider,
  payload: any
): Promise<void> {
  console.log(`[Webhook] Processing presence event:`, JSON.stringify(payload).substring(0, 500));
  
  // Extrair dados de presença baseado no provider
  let remoteJid: string | null = null;
  let presence: string | null = null;
  
  switch (provider) {
    case "evolution":
      remoteJid = payload.data?.remoteJid || payload.data?.id;
      presence = payload.data?.presence;
      break;
    case "zapi":
      remoteJid = payload.phone || payload.sender;
      presence = payload.status || payload.presence;
      break;
    case "uazapi":
      remoteJid = payload.data?.id || payload.data?.remoteJid;
      presence = payload.data?.presence;
      break;
  }
  
  if (!remoteJid || !presence) {
    console.log(`[Webhook] No remoteJid or presence in event`);
    return;
  }
  
  // Extrair número do telefone do remoteJid
  const phone = remoteJid
    .replace("@s.whatsapp.net", "")
    .replace("@lid", "")
    .replace("@c.us", "");
  
  // Determinar se está online e se está digitando
  // Valores possíveis: "available", "unavailable", "composing", "recording", "paused"
  const isOnline = presence === "available" || presence === "composing" || presence === "recording";
  const isTyping = presence === "composing" || presence === "recording";
  
  console.log(`[Webhook] Presence update - Phone: ${phone}, Presence: ${presence}, IsOnline: ${isOnline}, IsTyping: ${isTyping}`);
  
  // Atualizar contato
  const { data: contact, error: findError } = await supabase
    .from("contacts")
    .select("id, full_name")
    .eq("phone", phone)
    .single();
  
  if (findError || !contact) {
    console.log(`[Webhook] Contact not found for presence update: ${phone}`);
    return;
  }
  
  const { error: updateError } = await supabase
    .from("contacts")
    .update({
      is_online: isOnline,
      is_typing: isTyping,
      last_seen_at: isOnline ? null : new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", contact.id);
  
  if (updateError) {
    console.error(`[Webhook] Error updating contact presence:`, updateError);
  } else {
    console.log(`[Webhook] Contact ${contact.full_name} presence: online=${isOnline}, typing=${isTyping}`);
  }
}

function isMessageStatusEvent(provider: WhatsAppProvider, payload: any): boolean {
  switch (provider) {
    case "zapi":
      return payload.type === "MessageStatusCallback" || payload.event === "message_status" || 
             payload.status !== undefined && payload.messageId;
    case "uazapi":
      return payload.event === "messages.update" || payload.event === "message.ack";
    case "evolution":
      const evolutionStatusEvent = (payload.event || "").toLowerCase().replace(/_/g, '.');
      return evolutionStatusEvent === "messages.update";
    default:
      return false;
  }
}

async function handleMessageStatusEvent(
  supabase: any,
  provider: WhatsAppProvider,
  payload: any
): Promise<void> {
  console.log(`[Webhook] handleMessageStatusEvent - Provider: ${provider}, Payload:`, JSON.stringify(payload).substring(0, 500));
  
  const statusUpdates = extractStatusUpdates(provider, payload);
  console.log(`[Webhook] Extracted ${statusUpdates.length} status updates:`, statusUpdates);
  
  for (const update of statusUpdates) {
    if (!update.messageId) {
      console.log(`[Webhook] Skipping update - no messageId`);
      continue;
    }
    
    console.log(`[Webhook] Processing status update: messageId=${update.messageId}, rawStatus=${update.status}`);
    
    const newStatus = mapProviderStatus(update.status);
    console.log(`[Webhook] Mapped status: ${update.status} -> ${newStatus}`);
    
    if (!newStatus) {
      console.log(`[Webhook] Could not map status, skipping`);
      continue;
    }
    
    const { data, error } = await supabase
      .from("messages")
      .update({ status: newStatus })
      .eq("whatsapp_message_id", update.messageId)
      .select("id");
    
    if (error) {
      console.error(`[Webhook] Error updating message status:`, error);
    } else if (data?.length > 0) {
      console.log(`[Webhook] Message ${update.messageId} status updated to ${newStatus} (${data.length} rows)`);
    } else {
      console.log(`[Webhook] No message found with whatsapp_message_id: ${update.messageId}`);
    }
  }
}

interface StatusUpdate {
  messageId: string;
  status: string;
}

function extractStatusUpdates(provider: WhatsAppProvider, payload: any): StatusUpdate[] {
  switch (provider) {
    case "zapi":
      return [{
        messageId: payload.messageId || payload.ids?.[0] || "",
        status: payload.status || payload.ack || ""
      }];
    
    case "uazapi":
      const uazapiData = payload.data || payload;
      if (Array.isArray(uazapiData)) {
        return uazapiData.map((item: any) => ({
          messageId: item.key?.id || item.id || "",
          status: item.status || item.update?.status || ""
        }));
      }
      return [{
        messageId: uazapiData.key?.id || uazapiData.id || "",
        status: uazapiData.status || uazapiData.update?.status || ""
      }];
    
    case "evolution":
      const evolutionData = payload.data;
      console.log(`[Webhook] Evolution status data:`, JSON.stringify(evolutionData));
      
      if (evolutionData?.keyId) {
        return [{
          messageId: evolutionData.keyId,
          status: evolutionData.status || ""
        }];
      }
      
      if (Array.isArray(evolutionData)) {
        return evolutionData.map((item: any) => ({
          messageId: item.keyId || item.key?.id || item.id || "",
          status: item.status || ""
        }));
      }
      if (evolutionData?.key?.id) {
        return [{
          messageId: evolutionData.key.id,
          status: evolutionData.status || ""
        }];
      }
      return [];
    
    default:
      return [];
  }
}

function mapProviderStatus(providerStatus: string): string | null {
  const status = String(providerStatus).toUpperCase();
  
  if (status === "DELIVERY_ACK" || status === "DELIVERED" || status === "SERVER_ACK") {
    return "delivered";
  }
  if (status === "READ" || status === "PLAYED" || status === "VIEWED") {
    return "read";
  }
  if (status === "SENT" || status === "PENDING") {
    return "sent";
  }
  if (status === "ERROR" || status === "FAILED") {
    return "failed";
  }
  
  const numStatus = parseInt(providerStatus);
  if (!isNaN(numStatus)) {
    switch (numStatus) {
      case 0: return "failed";
      case 1: return "sent";
      case 2: return "sent";
      case 3: return "delivered";
      case 4: return "read";
      case 5: return "read";
    }
  }
  
  return null;
}

function extractInstanceId(provider: WhatsAppProvider, payload: any): string {
  switch (provider) {
    case "zapi":
      return payload.instanceId || "";
    case "uazapi":
      return payload.instance || payload.session || payload.instanceId || "";
    case "evolution":
      return payload.instance || "";
    default:
      return "";
  }
}

function isMessageEvent(provider: WhatsAppProvider, payload: any): boolean {
  const event = payload.event || payload.type || "";
  const normalizedEvent = event.toLowerCase().replace(/_/g, '.');
  
  let isMsg = false;
  
  switch (provider) {
    case "zapi":
      isMsg = !!(payload.phone && payload.text) || !!(payload.phone && (payload.image || payload.audio || payload.video || payload.document));
      break;
    case "uazapi":
      isMsg = normalizedEvent === "message" || normalizedEvent === "messages.upsert" || !!payload.message;
      break;
    case "evolution":
      isMsg = normalizedEvent === "messages.upsert" || normalizedEvent === "send.message";
      break;
    default:
      isMsg = false;
  }
  
  // DEBUG: Log detalhado para diagnóstico
  if (!isMsg) {
    console.log(`[Webhook DEBUG] Event NOT processed as message - Provider: ${provider}, RawEvent: "${event}", NormalizedEvent: "${normalizedEvent}", IsMessageEvent: false`);
  }
  
  return isMsg;
}

function normalizeMessage(provider: WhatsAppProvider, payload: any): NormalizedMessage | null {
  try {
    let normalized: NormalizedMessage | null = null;
    switch (provider) {
      case "zapi":
        normalized = normalizeZAPIMessage(payload);
        break;
      case "uazapi":
        normalized = normalizeUAZAPIMessage(payload);
        break;
      case "evolution":
        normalized = normalizeEvolutionMessage(payload);
        break;
      default:
        normalized = null;
    }
    
    if (normalized) {
      console.log(`[Webhook] Normalized message - Type: ${normalized.type}, Content: ${normalized.content.substring(0, 50)}, MediaURL: ${normalized.mediaUrl ? 'YES' : 'NO'}, MediaBase64: ${normalized.mediaBase64 ? 'YES' : 'NO'}`);
    }
    
    return normalized;
  } catch (error) {
    console.error(`[Webhook] Error normalizing ${provider} message:`, error);
    return null;
  }
}

function normalizeZAPIMessage(payload: any): NormalizedMessage | null {
  if (!payload.phone) return null;

  const phone = payload.phone?.replace(/\D/g, "") || "";
  if (phone.startsWith("120363") || payload.isGroup || payload.isGroupMsg) {
    console.log(`[Webhook ZAPI] Ignoring group message from: ${phone}`);
    return null;
  }

  const messageType = detectZAPIMessageType(payload);
  
  return {
    id: `zapi_${payload.messageId}`,
    provider: "zapi",
    instanceId: payload.instanceId || "",
    from: payload.phone.replace(/\D/g, ""),
    fromName: payload.senderName || payload.chatName || "",
    isFromMe: payload.fromMe || false,
    type: messageType,
    content: extractZAPIContent(payload, messageType),
    mediaUrl: payload.image?.imageUrl || payload.audio?.audioUrl || payload.video?.videoUrl || payload.document?.documentUrl,
    mediaMimeType: payload.image?.mimetype || payload.audio?.mimetype || payload.video?.mimetype || payload.document?.mimetype,
    caption: payload.image?.caption || payload.video?.caption,
    timestamp: new Date(payload.momment || Date.now()),
    quotedMessageId: payload.quotedMessage?.messageId,
    status: "delivered",
    originalId: payload.messageId,
  };
}

function detectZAPIMessageType(payload: any): MessageType {
  if (payload.text) return "text";
  if (payload.image) return "image";
  if (payload.audio) return "audio";
  if (payload.video) return "video";
  if (payload.document) return "document";
  if (payload.sticker) return "sticker";
  if (payload.location) return "location";
  if (payload.contact) return "contact";
  return "text";
}

function extractZAPIContent(payload: any, type: MessageType): string {
  switch (type) {
    case "text": return payload.text?.message || payload.text || "";
    case "image": return payload.image?.caption || "[Imagem]";
    case "audio": return "[Áudio]";
    case "video": return payload.video?.caption || "[Vídeo]";
    case "document": return payload.document?.fileName || "[Documento]";
    case "sticker": return "[Sticker]";
    case "location": return `[Localização]`;
    case "contact": return `[Contato]`;
    default: return "";
  }
}

function normalizeUAZAPIMessage(payload: any): NormalizedMessage | null {
  const msg = payload.data || payload.message || payload;
  if (!msg) return null;

  let rawFrom = msg.from || msg.remoteJid || msg.phone || "";
  
  if (rawFrom.includes("@g.us")) {
    console.log(`[Webhook UAZAPI] Ignoring group message from: ${rawFrom}`);
    return null;
  }
  
  let from = rawFrom.replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/\D/g, "");
  
  if (from.startsWith("120363")) {
    console.log(`[Webhook UAZAPI] Ignoring group message from ID: ${from}`);
    return null;
  }
  
  // Validate Brazilian phone to prevent LID contacts
  if (!isValidBrazilianPhone(from)) {
    console.log(`[Webhook UAZAPI] ⚠️ REJECTING message - Invalid phone (LID?): ${from}`);
    return null;
  }

  const messageType = detectUAZAPIMessageType(msg);

  return {
    id: `uazapi_${msg.id || msg.key?.id || Date.now()}`,
    provider: "uazapi",
    instanceId: payload.instance || payload.session || "",
    from,
    fromName: msg.pushName || msg.senderName || "",
    isFromMe: msg.fromMe || msg.key?.fromMe || false,
    type: messageType,
    content: extractUAZAPIContent(msg, messageType),
    mediaUrl: msg.mediaUrl || msg.media?.url,
    mediaMimeType: msg.mimetype || msg.media?.mimetype,
    caption: msg.caption,
    timestamp: new Date(msg.timestamp ? msg.timestamp * 1000 : Date.now()),
    quotedMessageId: msg.quotedMessageId || msg.contextInfo?.stanzaId,
    status: "delivered",
    originalId: msg.id || msg.key?.id || "",
  };
}

function detectUAZAPIMessageType(msg: any): MessageType {
  if (msg.type === "chat" || msg.type === "text" || msg.text || msg.body) return "text";
  if (msg.type === "image" || msg.image || msg.imageMessage) return "image";
  if (msg.type === "audio" || msg.type === "ptt" || msg.audio || msg.audioMessage) return "audio";
  if (msg.type === "video" || msg.video || msg.videoMessage) return "video";
  if (msg.type === "document" || msg.document || msg.documentMessage) return "document";
  if (msg.type === "sticker" || msg.sticker || msg.stickerMessage) return "sticker";
  if (msg.type === "location" || msg.location || msg.locationMessage) return "location";
  if (msg.type === "vcard" || msg.type === "contact" || msg.contactMessage) return "contact";
  return "text";
}

function extractUAZAPIContent(msg: any, type: MessageType): string {
  switch (type) {
    case "text": return msg.body || msg.text || msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    case "image": return msg.caption || "[Imagem]";
    case "audio": return "[Áudio]";
    case "video": return msg.caption || "[Vídeo]";
    case "document": return msg.fileName || msg.title || "[Documento]";
    case "sticker": return "[Sticker]";
    case "location": return "[Localização]";
    case "contact": return "[Contato]";
    default: return "";
  }
}

function normalizeEvolutionMessage(payload: any): NormalizedMessage | null {
  const eventType = (payload.event || "").toLowerCase().replace(/_/g, '.');
  if (eventType !== "messages.upsert" && eventType !== "send.message") return null;

  let msg = payload.data;
  if (Array.isArray(msg)) {
    msg = msg[0];
  }
  
  if (!msg?.key) return null;

  const rawRemoteJid = msg.key.remoteJid || "";
  
  // Filter out group messages
  if (rawRemoteJid.includes("@g.us")) {
    console.log(`[Webhook Evolution] Ignoring group message from: ${rawRemoteJid}`);
    return null;
  }
  
  // =====================================================
  // CRITICAL: Phone validation to prevent LID contacts
  // =====================================================
  const validPhone = extractValidPhoneFromPayload(msg, rawRemoteJid);
  
  if (!validPhone) {
    // Log the invalid phone for debugging
    const extractedPhone = rawRemoteJid
      .replace("@s.whatsapp.net", "")
      .replace("@c.us", "")
      .replace("@lid", "")
      .replace(/\D/g, "");
    
    console.log(`[Webhook Evolution] ⚠️ REJECTING message - Invalid phone (LID?): ${extractedPhone}, rawJid: ${rawRemoteJid}, remoteJidAlt: ${msg.key.remoteJidAlt || 'none'}`);
    return null;
  }
  
  const from = validPhone;
  
  if (from.startsWith("120363")) {
    console.log(`[Webhook Evolution] Ignoring group message from ID: ${from}`);
    return null;
  }

  const messageType = detectEvolutionMessageType(msg);
  
  // Extract base64 data if available
  const mediaData = extractEvolutionMediaBase64(msg);
  
  // Extract quotedMessageId from multiple possible locations
  const quotedMessageId = extractEvolutionQuotedMessageId(msg);
  
  // Extract referral data (Meta Ads / Click-to-WhatsApp) - only for first message (not fromMe)
  const referralData = !msg.key.fromMe ? extractReferralData(msg) : null;
  
  if (quotedMessageId) {
    console.log(`[Webhook Evolution] Found quotedMessageId: ${quotedMessageId}`);
  }
  
  console.log(`[Webhook Evolution] ✅ Processing ${payload.event} - Type: ${messageType}, From: ${from}, FromMe: ${msg.key.fromMe}, HasBase64: ${!!mediaData.base64}, QuotedId: ${quotedMessageId || 'none'}, HasReferral: ${!!referralData}`);

  return {
    id: `evolution_${msg.key.id}`,
    provider: "evolution",
    instanceId: payload.instance || "",
    from,
    fromName: msg.pushName || "",
    isFromMe: msg.key.fromMe || false,
    type: messageType,
    content: extractEvolutionContent(msg, messageType),
    mediaUrl: msg.message?.imageMessage?.url || msg.message?.audioMessage?.url || msg.message?.videoMessage?.url || msg.message?.documentMessage?.url,
    mediaBase64: mediaData.base64 || undefined,
    mediaMimeType: mediaData.mimetype || msg.message?.imageMessage?.mimetype || msg.message?.audioMessage?.mimetype || msg.message?.videoMessage?.mimetype || msg.message?.documentMessage?.mimetype,
    caption: msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption,
    timestamp: new Date((msg.messageTimestamp || Date.now() / 1000) * 1000),
    quotedMessageId: quotedMessageId,
    status: "delivered",
    originalId: msg.key.id,
    referralData: referralData || undefined,
  };
}

// Helper function to extract quotedMessageId from all possible locations in Evolution API payload
function extractEvolutionQuotedMessageId(msg: any): string | undefined {
  // Check msg.contextInfo first (for send.message events)
  if (msg.contextInfo?.stanzaId) {
    return msg.contextInfo.stanzaId;
  }
  
  const message = msg.message;
  if (!message) return undefined;
  
  // Check each message type for contextInfo.stanzaId
  // Text messages
  if (message.extendedTextMessage?.contextInfo?.stanzaId) {
    return message.extendedTextMessage.contextInfo.stanzaId;
  }
  if (message.conversation && message.contextInfo?.stanzaId) {
    return message.contextInfo.stanzaId;
  }
  
  // Media messages
  if (message.imageMessage?.contextInfo?.stanzaId) {
    return message.imageMessage.contextInfo.stanzaId;
  }
  if (message.audioMessage?.contextInfo?.stanzaId) {
    return message.audioMessage.contextInfo.stanzaId;
  }
  if (message.videoMessage?.contextInfo?.stanzaId) {
    return message.videoMessage.contextInfo.stanzaId;
  }
  if (message.documentMessage?.contextInfo?.stanzaId) {
    return message.documentMessage.contextInfo.stanzaId;
  }
  if (message.stickerMessage?.contextInfo?.stanzaId) {
    return message.stickerMessage.contextInfo.stanzaId;
  }
  
  // Check messageContextInfo as fallback (some Evolution versions use this)
  if (message.messageContextInfo?.stanzaId) {
    return message.messageContextInfo.stanzaId;
  }
  
  return undefined;
}

function detectEvolutionMessageType(msg: any): MessageType {
  const message = msg.message;
  if (!message) return "text";
  
  if (message.conversation || message.extendedTextMessage) return "text";
  if (message.imageMessage) return "image";
  if (message.audioMessage) return "audio";
  if (message.videoMessage) return "video";
  if (message.documentMessage) return "document";
  if (message.stickerMessage) return "sticker";
  if (message.locationMessage) return "location";
  if (message.contactMessage) return "contact";
  return "text";
}

function extractEvolutionContent(msg: any, type: MessageType): string {
  const message = msg.message;
  switch (type) {
    case "text": return message?.conversation || message?.extendedTextMessage?.text || "";
    case "image": return message?.imageMessage?.caption || "[Imagem]";
    case "audio": return "[Áudio]";
    case "video": return message?.videoMessage?.caption || "[Vídeo]";
    case "document": return message?.documentMessage?.fileName || "[Documento]";
    case "sticker": return "[Sticker]";
    case "location": return "[Localização]";
    case "contact": return "[Contato]";
    default: return "";
  }
}
