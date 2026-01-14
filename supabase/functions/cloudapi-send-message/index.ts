import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_URL = 'https://graph.facebook.com';

// Supported audio formats by WhatsApp Cloud API
const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg',      // MP3
  'audio/mp4',       // M4A
  'audio/aac',       // AAC
  'audio/amr',       // AMR
  'audio/ogg',       // OGG (opus codec)
];

interface SendMessagePayload {
  channelId: string;
  phone: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'template';
  content?: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  conversationId?: string;
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
    const { channelId, phone, type, content, mediaUrl, caption, filename, template, conversationId } = payload;

    if (!channelId || !phone) {
      throw new Error('channelId and phone are required');
    }

    // Get Cloud API config for this channel
    let config: any = null;
    const { data: configData, error: configError } = await supabase
      .from('cloudapi_configs')
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_active', true)
      .single();

    if (configError || !configData) {
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
        
        config = tenantConfig;
      } else {
        throw new Error('Channel not found');
      }
    } else {
      config = configData;
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
          // Fetch the audio file to upload to Meta's servers
          console.log('[CloudAPI] Fetching audio from:', mediaUrl);
          
          const audioResponse = await fetch(mediaUrl);
          if (!audioResponse.ok) {
            throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
          }
          
          const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';
          console.log('[CloudAPI] Audio content-type:', contentType);
          
          // Validate audio format
          const isSupported = SUPPORTED_AUDIO_TYPES.some(t => contentType.includes(t.split('/')[1]));
          if (!isSupported && !contentType.includes('octet-stream')) {
            console.error('[CloudAPI] Unsupported audio format:', contentType);
            throw new Error(`Unsupported audio format: ${contentType}. Supported: MP3, M4A, AAC, AMR, OGG`);
          }
          
          const audioBuffer = await audioResponse.arrayBuffer();
          console.log('[CloudAPI] Audio size:', audioBuffer.byteLength, 'bytes');
          
          // Determine file extension and mime type
          let finalMimeType = contentType;
          let extension = 'mp3';
          
          if (contentType.includes('mpeg') || contentType.includes('mp3')) {
            finalMimeType = 'audio/mpeg';
            extension = 'mp3';
          } else if (contentType.includes('ogg')) {
            finalMimeType = 'audio/ogg';
            extension = 'ogg';
          } else if (contentType.includes('mp4') || contentType.includes('m4a')) {
            finalMimeType = 'audio/mp4';
            extension = 'm4a';
          } else if (contentType.includes('aac')) {
            finalMimeType = 'audio/aac';
            extension = 'aac';
          } else if (contentType.includes('octet-stream') && mediaUrl.includes('.mp3')) {
            // Fallback for octet-stream with .mp3 extension
            finalMimeType = 'audio/mpeg';
            extension = 'mp3';
          }
          
          // Upload to Meta's Media API
          const formData = new FormData();
          formData.append('messaging_product', 'whatsapp');
          formData.append('type', finalMimeType);
          formData.append('file', new Blob([audioBuffer], { type: finalMimeType }), `audio.${extension}`);
          
          console.log('[CloudAPI] Uploading audio to Meta Media API...');
          const mediaUploadResponse = await fetch(
            `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${config.phone_number_id}/media`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${config.access_token}`,
              },
              body: formData,
            }
          );
          
          const mediaUploadResult = await mediaUploadResponse.json();
          
          if (!mediaUploadResponse.ok) {
            console.error('[CloudAPI] Media upload failed:', mediaUploadResult);
            throw new Error(mediaUploadResult.error?.message || 'Failed to upload audio to Meta');
          }
          
          console.log('[CloudAPI] Audio uploaded to Meta, media_id:', mediaUploadResult.id);
          
          // Use the uploaded media ID - voice: true sends as native PTT (Push To Talk)
          messagePayload.audio = { id: mediaUploadResult.id, voice: true };
        } else {
          messagePayload.audio = { id: mediaUrl, voice: true };
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

    // Disparar webhook de mensagem enviada
    if (conversationId) {
      try {
        // Buscar dados da conversa para o contexto
        const { data: conversationData } = await supabase
          .from('conversations')
          .select('department_id, channel_id, assigned_to, contact_id')
          .eq('id', conversationId)
          .single();

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        await fetch(`${supabaseUrl}/functions/v1/dispatch-webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            action: 'dispatch',
            event: {
              type: 'message.sent',
              data: {
                conversation_id: conversationId,
                contact_id: conversationData?.contact_id,
                to: phone,
                content,
                message_type: type,
                media_url: mediaUrl,
                whatsapp_message_id: result.messages?.[0]?.id,
                timestamp: new Date().toISOString(),
              },
              context: {
                department: { id: conversationData?.department_id },
                channel: { id: conversationData?.channel_id || channelId },
                assigned_to: conversationData?.assigned_to,
                tenant_id: config.tenant_id,
              },
            },
          }),
        });
        console.log('[CloudAPI Send] Webhook dispatched for message.sent');
      } catch (webhookError) {
        console.error('[CloudAPI Send] Error dispatching webhook:', webhookError);
      }
    }

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
