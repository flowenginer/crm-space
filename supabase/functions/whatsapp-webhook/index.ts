import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode } from "https://esm.sh/base64-arraybuffer@1.0.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type WhatsAppProvider = "zapi" | "uazapi" | "evolution";
type MessageType = "text" | "image" | "audio" | "video" | "document" | "sticker" | "location" | "contact";

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
    
    // Log webhook for debugging
    await supabase.from("webhook_logs").insert({
      provider,
      event_type: eventType,
      instance_id: instanceId,
      payload,
    });

    // Handle connection status updates
    if (isConnectionEvent(provider, payload)) {
      console.log(`[Webhook] Processing connection event for instance: ${instanceId}`);
      await handleConnectionEvent(supabase, provider, instanceId, payload);
      return new Response(JSON.stringify({ success: true, message: "Connection event processed" }), {
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
      .select("id, name")
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
      const recipientPhone = normalizedMessage.from;
      
      // Buscar contato pelo telefone do destinatário
      const { data: contact } = await supabase
        .from("contacts")
        .select("id")
        .eq("phone", recipientPhone)
        .single();

      if (!contact) {
        console.log(`[Webhook] Contact not found for fromMe message: ${recipientPhone}`);
        return new Response(JSON.stringify({ success: true, message: "Contact not found for fromMe" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Buscar conversa existente com esse contato
      const { data: conversation } = await supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", contact.id)
        .eq("channel_id", channel.id)
        .in("status", ["open", "pending"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!conversation) {
        console.log(`[Webhook] No open conversation found for fromMe message`);
        return new Response(JSON.stringify({ success: true, message: "No conversation for fromMe" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verificar se a mensagem já existe (evitar duplicatas)
      const { data: existingMsg } = await supabase
        .from("messages")
        .select("id")
        .eq("whatsapp_message_id", normalizedMessage.originalId)
        .single();

      if (existingMsg) {
        console.log(`[Webhook] Message already exists, skipping: ${normalizedMessage.originalId}`);
        return new Response(JSON.stringify({ success: true, message: "Message already exists" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // =====================================================
      // UPLOAD MEDIA TO STORAGE (fromMe)
      // =====================================================
      let finalMediaUrl = normalizedMessage.mediaUrl;
      
      if (normalizedMessage.mediaBase64 && normalizedMessage.mediaMimeType) {
        console.log(`[Webhook] Uploading media for fromMe message...`);
        const uploadedUrl = await uploadMediaToStorage(
          supabase,
          normalizedMessage.mediaBase64,
          normalizedMessage.mediaMimeType,
          conversation.id
        );
        if (uploadedUrl) {
          finalMediaUrl = uploadedUrl;
          console.log(`[Webhook] FromMe media uploaded, using Supabase URL`);
        }
      }

      // Salvar mensagem enviada
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
      });

      if (msgError) {
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

      // Atualizar stats do canal
      await supabase
        .from("whatsapp_channels")
        .update({
          messages_sent: (channel as any).messages_sent + 1 || 1,
          messages_sent_today: (channel as any).messages_sent_today + 1 || 1,
          last_sync_at: new Date().toISOString(),
        })
        .eq("id", channel.id);

      console.log(`[Webhook] FromMe message saved for conversation ${conversation.id}`);
      return new Response(JSON.stringify({ success: true, message: "FromMe message saved" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================================
    // MENSAGEM RECEBIDA (não fromMe) - Fluxo normal
    // =====================================================
    
    // Find or create contact
    let { data: contact } = await supabase
      .from("contacts")
      .select("id")
      .eq("phone", normalizedMessage.from)
      .single();

    if (!contact) {
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .insert({
          phone: normalizedMessage.from,
          full_name: normalizedMessage.fromName || `WhatsApp ${normalizedMessage.from}`,
          origin: "whatsapp",
          first_contact_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (contactError) {
        console.error(`[Webhook] Error creating contact:`, contactError);
        throw contactError;
      }
      contact = newContact;
    }

    // Find or create conversation
    let { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_id", contact.id)
      .eq("channel_id", channel.id)
      .in("status", ["open", "pending"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!conversation) {
      const { data: newConversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          contact_id: contact.id,
          channel_id: channel.id,
          status: "open",
          is_unread: true,
          unread_count: 1,
          last_message_at: new Date().toISOString(),
          last_message_preview: normalizedMessage.content.substring(0, 100),
        })
        .select("id")
        .single();

      if (convError) {
        console.error(`[Webhook] Error creating conversation:`, convError);
        throw convError;
      }
      conversation = newConversation;
    } else {
      // Update existing conversation
      await supabase.rpc("increment_unread", { conv_id: conversation.id });
      await supabase
        .from("conversations")
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: normalizedMessage.content.substring(0, 100),
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversation.id);
    }

    // =====================================================
    // UPLOAD MEDIA TO STORAGE (received message)
    // =====================================================
    let finalMediaUrl = normalizedMessage.mediaUrl;
    
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
      return payload.event || "message";
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
      return payload.event === "connection.update";
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

function isMessageStatusEvent(provider: WhatsAppProvider, payload: any): boolean {
  switch (provider) {
    case "zapi":
      return payload.type === "MessageStatusCallback" || payload.event === "message_status" || 
             payload.status !== undefined && payload.messageId;
    case "uazapi":
      return payload.event === "messages.update" || payload.event === "message.ack";
    case "evolution":
      return payload.event === "messages.update";
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
  switch (provider) {
    case "zapi":
      return !!(payload.phone && payload.text) || !!(payload.phone && (payload.image || payload.audio || payload.video || payload.document));
    case "uazapi":
      const event = payload.event || payload.type;
      return event === "message" || event === "messages.upsert" || !!payload.message;
    case "evolution":
      return payload.event === "messages.upsert" || payload.event === "send.message";
    default:
      return false;
  }
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
  if (payload.event !== "messages.upsert" && payload.event !== "send.message") return null;

  let msg = payload.data;
  if (Array.isArray(msg)) {
    msg = msg[0];
  }
  
  if (!msg?.key) return null;

  const rawRemoteJid = msg.key.remoteJid || "";
  
  if (rawRemoteJid.includes("@g.us")) {
    console.log(`[Webhook Evolution] Ignoring group message from: ${rawRemoteJid}`);
    return null;
  }
  
  let from = rawRemoteJid.replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/\D/g, "");
  
  if (from.startsWith("120363")) {
    console.log(`[Webhook Evolution] Ignoring group message from ID: ${from}`);
    return null;
  }

  const messageType = detectEvolutionMessageType(msg);
  
  // Extract base64 data if available
  const mediaData = extractEvolutionMediaBase64(msg);
  
  console.log(`[Webhook Evolution] Processing ${payload.event} - Type: ${messageType}, From: ${from}, FromMe: ${msg.key.fromMe}, HasBase64: ${!!mediaData.base64}`);

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
    quotedMessageId: msg.message?.extendedTextMessage?.contextInfo?.stanzaId,
    status: "delivered",
    originalId: msg.key.id,
  };
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
