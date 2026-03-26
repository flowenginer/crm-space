import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_URL = 'https://graph.facebook.com';

interface SendMessagePayload {
  channelId: string;
  recipientId: string; // IGSID (Instagram Scoped User ID)
  type: 'text' | 'image' | 'video' | 'audio';
  content?: string;
  mediaUrl?: string;
  conversationId?: string;
  quickReplies?: Array<{ title: string; payload: string }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    let isAuthorized = false;

    // Validate as user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (!authError && user) {
      isAuthorized = true;
    }

    // Internal calls from other edge functions
    if (!isAuthorized) {
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (token === serviceRoleKey) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new Error('Unauthorized');
    }

    const payload: SendMessagePayload = await req.json();
    const { channelId, recipientId, type, content, mediaUrl, conversationId, quickReplies } = payload;

    if (!channelId || !recipientId) {
      throw new Error('channelId and recipientId are required');
    }

    // Buscar canal Instagram
    const { data: channel, error: channelError } = await supabase
      .from('instagram_configs')
      .select('id, page_id, page_access_token, instagram_account_id, tenant_id, channel_id')
      .eq('id', channelId)
      .eq('is_active', true)
      .single();

    if (channelError || !channel) {
      throw new Error('Instagram channel not found or inactive');
    }

    if (!channel.page_access_token) {
      throw new Error('Page access token not configured');
    }

    // Construir payload da mensagem para a Instagram Send API
    let messagePayload: Record<string, unknown> = {};

    switch (type) {
      case 'text':
        if (quickReplies && quickReplies.length > 0) {
          messagePayload = {
            text: content || '',
            quick_replies: quickReplies.map(qr => ({
              content_type: 'text',
              title: qr.title,
              payload: qr.payload,
            })),
          };
        } else {
          messagePayload = { text: content || '' };
        }
        break;

      case 'image':
        messagePayload = {
          attachment: {
            type: 'image',
            payload: { url: mediaUrl || content, is_reusable: true },
          },
        };
        break;

      case 'video':
        messagePayload = {
          attachment: {
            type: 'video',
            payload: { url: mediaUrl || content, is_reusable: true },
          },
        };
        break;

      case 'audio':
        messagePayload = {
          attachment: {
            type: 'audio',
            payload: { url: mediaUrl || content, is_reusable: true },
          },
        };
        break;

      default:
        messagePayload = { text: content || '' };
    }

    // Enviar via Instagram Send API (usa Page ID, não Instagram Account ID)
    console.log('[Instagram Send] Sending message:', {
      recipientId,
      type,
      channelId: channel.id,
    });

    const response = await fetch(
      `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${channel.page_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${channel.page_access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: messagePayload,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok || result.error) {
      console.error('[Instagram Send] Error:', result.error || result);
      throw new Error(result.error?.message || 'Failed to send Instagram message');
    }

    console.log('[Instagram Send] ✅ Message sent:', result);

    const instagramMessageId = result.message_id || null;

    // Atualizar timestamp do canal
    await supabase
      .from('instagram_configs')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', channel.id);

    // Se temos conversationId, atualizar a conversa
    if (conversationId) {
      const preview = type === 'text' ? (content || '').substring(0, 100) : `📎 ${type}`;
      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: preview,
          last_message_is_from_me: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: instagramMessageId,
        recipientId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Instagram Send] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
