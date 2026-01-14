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
  phone: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'template';
  content?: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  template?: {
    name: string;
    language: string;
    components?: any[];
  };
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

    // First, try to validate as a user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (!authError && user) {
      isAuthorized = true;
      console.log('[CloudAPI Send] Authorized via user token');
    }

    // If not a user, check if the token is the service_role key (internal calls from other edge functions)
    if (!isAuthorized) {
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (token === serviceRoleKey) {
        isAuthorized = true;
        console.log('[CloudAPI Send] Authorized via service role');
      }
    }

    if (!isAuthorized) {
      throw new Error('Unauthorized');
    }

    const payload: SendMessagePayload = await req.json();
    const { channelId, phone, type, content, mediaUrl, caption, filename, template } = payload;

    if (!channelId || !phone) {
      throw new Error('channelId and phone are required');
    }

    // Get Cloud API config for this channel
    const { data: config, error: configError } = await supabase
      .from('cloudapi_configs')
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      // Try to find by tenant
      const { data: channel } = await supabase
        .from('whatsapp_channels')
        .select('tenant_id')
        .eq('id', channelId)
        .single();

      if (channel) {
        const { data: tenantConfig } = await supabase
          .from('cloudapi_configs')
          .select('*')
          .eq('tenant_id', channel.tenant_id)
          .eq('is_active', true)
          .single();

        if (!tenantConfig) {
          throw new Error('No Cloud API configuration found for this channel');
        }
        
        Object.assign(config || {}, tenantConfig);
      } else {
        throw new Error('Channel not found');
      }
    }

    // Format phone number (remove + and spaces)
    const formattedPhone = phone.replace(/[^0-9]/g, '');

    // Build message payload based on type
    let messagePayload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
    };

    switch (type) {
      case 'text':
        messagePayload.type = 'text';
        messagePayload.text = { body: content || '' };
        break;

      case 'image':
        messagePayload.type = 'image';
        if (mediaUrl?.startsWith('http')) {
          messagePayload.image = { 
            link: mediaUrl,
            caption: caption || undefined
          };
        } else {
          messagePayload.image = { 
            id: mediaUrl,
            caption: caption || undefined
          };
        }
        break;

      case 'audio':
        messagePayload.type = 'audio';
        if (mediaUrl?.startsWith('http')) {
          // OGG files are directly supported by WhatsApp
          // For WebM, we need to upload to Meta which may convert it
          if (mediaUrl.includes('.webm')) {
            console.log('[CloudAPI] WebM audio detected, uploading via Media API with OGG type...');
            try {
              // Download the WebM audio file
              const audioResponse = await fetch(mediaUrl);
              const audioBuffer = await audioResponse.arrayBuffer();
              console.log('[CloudAPI] Downloaded WebM, size:', audioBuffer.byteLength);
              
              // Upload to Meta Media API as OGG (WebM with Opus codec is similar)
              const formData = new FormData();
              const audioBlob = new Blob([audioBuffer], { type: 'audio/ogg; codecs=opus' });
              formData.append('file', audioBlob, 'audio.ogg');
              formData.append('messaging_product', 'whatsapp');
              formData.append('type', 'audio/ogg');
              
              const uploadResponse = await fetch(
                `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${config.phone_number_id}/media`,
                {
                  method: 'POST',
                  headers: { 
                    Authorization: `Bearer ${config.access_token}` 
                  },
                  body: formData
                }
              );
              const uploadResult = await uploadResponse.json();
              console.log('[CloudAPI] Media upload result:', uploadResult);
              
              if (uploadResult.id) {
                messagePayload.audio = { id: uploadResult.id };
              } else {
                console.error('[CloudAPI] Failed to upload audio:', uploadResult);
                messagePayload.audio = { link: mediaUrl };
              }
            } catch (uploadError) {
              console.error('[CloudAPI] Audio upload error:', uploadError);
              messagePayload.audio = { link: mediaUrl };
            }
          } else {
            // OGG, MP3, M4A - send directly as link
            messagePayload.audio = { link: mediaUrl };
          }
        } else {
          messagePayload.audio = { id: mediaUrl };
        }
        break;

      case 'video':
        messagePayload.type = 'video';
        if (mediaUrl?.startsWith('http')) {
          messagePayload.video = { 
            link: mediaUrl,
            caption: caption || undefined
          };
        } else {
          messagePayload.video = { 
            id: mediaUrl,
            caption: caption || undefined
          };
        }
        break;

      case 'document':
        messagePayload.type = 'document';
        if (mediaUrl?.startsWith('http')) {
          messagePayload.document = { 
            link: mediaUrl,
            filename: filename || 'document'
          };
        } else {
          messagePayload.document = { 
            id: mediaUrl,
            filename: filename || 'document'
          };
        }
        break;

      case 'template':
        if (!template?.name) {
          throw new Error('Template name is required for template messages');
        }
        messagePayload.type = 'template';
        messagePayload.template = {
          name: template.name,
          language: { code: template.language || 'pt_BR' },
          components: template.components || []
        };
        break;

      default:
        throw new Error(`Unsupported message type: ${type}`);
    }

    console.log('[CloudAPI Send] Sending message:', {
      to: formattedPhone,
      type,
      phoneNumberId: config.phone_number_id,
    });

    // Send message via Graph API
    const response = await fetch(
      `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[CloudAPI Send] Error response:', result);
      throw new Error(result.error?.message || 'Failed to send message');
    }

    console.log('[CloudAPI Send] Message sent successfully:', result);

    return new Response(
      JSON.stringify({
        success: true,
        messageId: result.messages?.[0]?.id,
        whatsappId: result.messages?.[0]?.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[CloudAPI Send] Error:', error);
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
