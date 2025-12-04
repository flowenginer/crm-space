import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  mediaMimeType?: string;
  caption?: string;
  timestamp: Date;
  quotedMessageId?: string;
  status: string;
  originalId: string;
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
    const pathParts = url.pathname.split("/");
    const provider = pathParts[pathParts.length - 1] as WhatsAppProvider;

    const payload = await req.json();
    
    console.log(`[Webhook] Received from ${provider}:`, JSON.stringify(payload).substring(0, 500));

    // Log webhook for debugging
    const instanceId = extractInstanceId(provider, payload);
    await supabase.from("webhook_logs").insert({
      provider,
      event_type: payload.event || payload.type || "message",
      instance_id: instanceId,
      payload,
    });

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

    // Skip messages from self
    if (normalizedMessage.isFromMe) {
      console.log(`[Webhook] Message from self, skipping`);
      return new Response(JSON.stringify({ success: true, message: "Self message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Save message
    const { error: msgError } = await supabase.from("messages").insert({
      conversation_id: conversation.id,
      contact_id: contact.id,
      content: normalizedMessage.content,
      message_type: normalizedMessage.type,
      media_url: normalizedMessage.mediaUrl,
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
      return payload.event === "messages.upsert";
    default:
      return false;
  }
}

function normalizeMessage(provider: WhatsAppProvider, payload: any): NormalizedMessage | null {
  try {
    switch (provider) {
      case "zapi":
        return normalizeZAPIMessage(payload);
      case "uazapi":
        return normalizeUAZAPIMessage(payload);
      case "evolution":
        return normalizeEvolutionMessage(payload);
      default:
        return null;
    }
  } catch (error) {
    console.error(`[Webhook] Error normalizing ${provider} message:`, error);
    return null;
  }
}

function normalizeZAPIMessage(payload: any): NormalizedMessage | null {
  if (!payload.phone) return null;

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

  let from = msg.from || msg.remoteJid || msg.phone || "";
  from = from.replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/\D/g, "");

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
  if (payload.event !== "messages.upsert") return null;

  const msg = payload.data;
  if (!msg?.key) return null;

  let from = msg.key.remoteJid || "";
  from = from.replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/\D/g, "");

  const messageType = detectEvolutionMessageType(msg);

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
    mediaMimeType: msg.message?.imageMessage?.mimetype || msg.message?.audioMessage?.mimetype || msg.message?.videoMessage?.mimetype || msg.message?.documentMessage?.mimetype,
    caption: msg.message?.imageMessage?.caption || msg.message?.videoMessage?.caption,
    timestamp: new Date((msg.messageTimestamp || 0) * 1000),
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
