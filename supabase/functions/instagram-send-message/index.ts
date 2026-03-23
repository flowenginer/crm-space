import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_URL = 'https://graph.instagram.com';

interface SendMessagePayload {
  channelId: string;
  recipientId: string; // Instagram Scoped User ID (IGSID)
  type: 'text' | 'image' | 'audio' | 'video' | 'file';
  content?: string;
  mediaUrl?: string;
  conversationId?: string;
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
    let user: any = null;

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (!authError && authUser) {
      isAuthorized = true;
      user = authUser;
      console.log('[Instagram Send] Authorized via user token');
    }

    if (!isAuthorized) {
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (token === serviceRoleKey) {
        isAuthorized = true;
        console.log('[Instagram Send] Authorized via service role');
      }
    }

    if (!isAuthorized) {
      throw new Error('Unauthorized');
    }

    const payload: SendMessagePayload = await req.json();
    const { channelId, recipientId, type, content, mediaUrl, conversationId } = payload;

    if (!channelId || !recipientId) {
      throw new Error('channelId and recipientId are required');
    }

    // Extract IGSID from "ig:XXXXX" format if needed
    const igsid = recipientId.startsWith('ig:') ? recipientId.slice(3) : recipientId;

    // Get Instagram config for this channel
    const { data: config, error: configError } = await supabase
      .from('instagram_configs')
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      // Fallback: try by tenant
      const { data: channel } = await supabase
        .from('whatsapp_channels')
        .select('tenant_id')
        .eq('id', channelId)
        .single();

      if (channel) {
        const { data: tenantConfig } = await supabase
          .from('instagram_configs')
          .select('*')
          .eq('tenant_id', channel.tenant_id)
          .eq('is_active', true)
          .single();

        if (!tenantConfig) {
          throw new Error('No Instagram configuration found for this channel');
        }

        Object.assign(config || {}, tenantConfig);
      } else {
        throw new Error('Channel not found');
      }
    }

    const activeConfig = config!;

    // Build Instagram Send API payload
    // Instagram uses the Page Send API: POST /{page-id}/messages
    const messagePayload: any = {
      recipient: { id: igsid },
    };

    switch (type) {
      case 'text':
        messagePayload.message = { text: content || '' };
        break;

      case 'image':
        if (mediaUrl) {
          messagePayload.message = {
            attachment: {
              type: 'image',
              payload: { url: mediaUrl, is_reusable: true },
            },
          };
        }
        break;

      case 'video':
        if (mediaUrl) {
          messagePayload.message = {
            attachment: {
              type: 'video',
              payload: { url: mediaUrl, is_reusable: true },
            },
          };
        }
        break;

      case 'audio':
        if (mediaUrl) {
          messagePayload.message = {
            attachment: {
              type: 'audio',
              payload: { url: mediaUrl, is_reusable: true },
            },
          };
        }
        break;

      case 'file':
        if (mediaUrl) {
          messagePayload.message = {
            attachment: {
              type: 'file',
              payload: { url: mediaUrl, is_reusable: true },
            },
          };
        }
        break;

      default:
        throw new Error(`Unsupported message type: ${type}`);
    }

    console.log('[Instagram Send] Sending to:', igsid, 'type:', type);

    // Send via Instagram Graph API
    const response = await fetch(
      `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${activeConfig.page_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${activeConfig.page_access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[Instagram Send] Error:', result);
      throw new Error(result.error?.message || 'Failed to send Instagram message');
    }

    console.log('[Instagram Send] Message sent:', result);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.message_id,
        recipientId: result.recipient_id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
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
