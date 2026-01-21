import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
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
    // Validate API Key
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('x-api-key');
    if (!apiKey) {
      console.error('[API Send] Missing X-API-Key header');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing X-API-Key header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API Key and get tenant
    const { data: keyData, error: keyError } = await supabase
      .from('integration_api_keys')
      .select('id, tenant_id, permissions, name')
      .eq('api_key', apiKey)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData) {
      console.error('[API Send] Invalid or inactive API Key');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or inactive API Key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[API Send] Authenticated via API Key:', keyData.name);

    // Update last_used_at
    await supabase
      .from('integration_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyData.id);

    const tenantId = keyData.tenant_id;

    // Parse payload
    const payload: SendMessagePayload = await req.json();
    let { channelId, phone, type, content, mediaUrl, caption, filename, template } = payload;

    if (!channelId || !phone) {
      return new Response(
        JSON.stringify({ success: false, error: 'channelId and phone are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (type === 'text' && !content) {
      return new Response(
        JSON.stringify({ success: false, error: 'content is required for text messages' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Cloud API config for this channel (validate it belongs to the tenant)
    const { data: config, error: configError } = await supabase
      .from('cloudapi_configs')
      .select('*')
      .eq('channel_id', channelId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      console.error('[API Send] No Cloud API configuration found for channel:', channelId);
      return new Response(
        JSON.stringify({ success: false, error: 'No Cloud API configuration found for this channel' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number
    const formattedPhone = phone.replace(/[^0-9]/g, '');

    // Find or create contact
    let contactId: string;
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, full_name')
      .eq('phone', formattedPhone)
      .eq('tenant_id', tenantId)
      .single();

    if (existingContact) {
      contactId = existingContact.id;
      console.log('[API Send] Found existing contact:', contactId);
    } else {
      // Create new contact
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          phone: formattedPhone,
          full_name: `+${formattedPhone}`,
          tenant_id: tenantId,
        })
        .select('id')
        .single();

      if (contactError || !newContact) {
        console.error('[API Send] Error creating contact:', contactError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create contact' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      contactId = newContact.id;
      console.log('[API Send] Created new contact:', contactId);
    }

    // Find or create conversation
    // CORREÇÃO: Buscar ANY conversa existente (independente do status) e reabri-la se necessário
    // Isso garante que mensagens do N8N vão para a conversa correta que o vendedor está vendo
    let conversationId: string;
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id, status, assigned_to, department_id')
      .eq('contact_id', contactId)
      .eq('channel_id', channelId)
      .eq('tenant_id', tenantId)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .single();

    if (existingConversation) {
      conversationId = existingConversation.id;
      console.log('[API Send] Found existing conversation:', conversationId, 'status:', existingConversation.status);
      
      // Se a conversa não está aberta, reabri-la (preservando assigned_to e department_id)
      if (existingConversation.status !== 'open') {
        console.log('[API Send] Reopening conversation from status:', existingConversation.status);
        const { error: reopenError } = await supabase
          .from('conversations')
          .update({ 
            status: 'open',
            reopened_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', conversationId);
        
        if (reopenError) {
          console.error('[API Send] Error reopening conversation:', reopenError);
        } else {
          console.log('[API Send] Conversation reopened successfully, assigned_to preserved:', existingConversation.assigned_to);
        }
      }
    } else {
      // Criar nova conversa apenas se não existir NENHUMA
      console.log('[API Send] No existing conversation found, creating new one');
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          contact_id: contactId,
          channel_id: channelId,
          tenant_id: tenantId,
          status: 'open',
          last_message_at: new Date().toISOString(),
          last_message_is_from_me: true,
        })
        .select('id')
        .single();

      if (convError || !newConversation) {
        console.error('[API Send] Error creating conversation:', convError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to create conversation' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      conversationId = newConversation.id;
      console.log('[API Send] Created new conversation:', conversationId);
    }

    // Build WhatsApp message payload
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
          console.log('[API Send] Fetching audio from:', mediaUrl);
          
          const audioResponse = await fetch(mediaUrl);
          if (!audioResponse.ok) {
            throw new Error(`Failed to fetch audio: ${audioResponse.status}`);
          }
          
          const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';
          const audioBuffer = await audioResponse.arrayBuffer();
          
          let finalMimeType = 'audio/mpeg';
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
          }
          
          const formData = new FormData();
          formData.append('messaging_product', 'whatsapp');
          formData.append('type', finalMimeType);
          formData.append('file', new Blob([audioBuffer], { type: finalMimeType }), `audio.${extension}`);
          
          const mediaUploadResponse = await fetch(
            `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${config.phone_number_id}/media`,
            {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${config.access_token}` },
              body: formData,
            }
          );
          
          const mediaUploadResult = await mediaUploadResponse.json();
          
          if (!mediaUploadResponse.ok) {
            throw new Error(mediaUploadResult.error?.message || 'Failed to upload audio');
          }
          
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
          return new Response(
            JSON.stringify({ success: false, error: 'Template name is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Fetch template from database to get the body text
        const { data: templateData } = await supabase
          .from('meta_message_templates')
          .select('components')
          .eq('name', template.name)
          .eq('tenant_id', tenantId)
          .single();
        
        // Extract body text and replace variables
        if (templateData?.components) {
          const bodyComponent = templateData.components.find(
            (c: any) => c.type === 'BODY'
          );
          if (bodyComponent?.text) {
            let templateBodyText = bodyComponent.text;
            
            // Find body parameters from the request
            const bodyParams = template.components?.find(
              (c: any) => c.type === 'body'
            )?.parameters || [];
            
            // Replace {{1}}, {{2}}, etc. with actual values
            bodyParams.forEach((param: any, index: number) => {
              const placeholder = `{{${index + 1}}}`;
              const value = param.text || param.value || '';
              templateBodyText = templateBodyText.replace(placeholder, value);
            });
            
            content = templateBodyText;
            console.log('[API Send] Template body text:', content);
          }
        }
        
        // Fallback if template not found in DB
        if (!content) {
          content = `[Template: ${template.name}]`;
        }
        
        messagePayload.type = 'template';
        messagePayload.template = {
          name: template.name,
          language: { code: template.language || 'pt_BR' },
          components: template.components || []
        };
        break;

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unsupported message type: ${type}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    console.log('[API Send] Sending message to WhatsApp:', {
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
      console.error('[API Send] WhatsApp API error:', result);
      return new Response(
        JSON.stringify({ success: false, error: result.error?.message || 'Failed to send message' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const whatsappMessageId = result.messages?.[0]?.id;
    console.log('[API Send] Message sent to WhatsApp:', whatsappMessageId);

    // Save message to database
    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: content || caption || `[${type}]`,
        message_type: type,
        is_from_me: true,
        status: 'sent',
        whatsapp_message_id: whatsappMessageId,
        media_url: mediaUrl || null,
        tenant_id: tenantId,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (messageError) {
      console.error('[API Send] Error saving message:', messageError);
      // Don't fail the request, message was sent to WhatsApp
    }

    // Update conversation
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: content || caption || `[${type}]`,
        last_message_is_from_me: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId);

    // Dispatch webhook
    try {
      // Fetch enriched data
      const { data: contactData } = await supabase
        .from('contacts')
        .select('id, full_name, phone, email, lead_status, lead_score')
        .eq('id', contactId)
        .single();

      const { data: conversationData } = await supabase
        .from('conversations')
        .select('department_id, assigned_to, status, priority, unread_count, created_at')
        .eq('id', conversationId)
        .single();

      let departmentData = null;
      if (conversationData?.department_id) {
        const { data: dept } = await supabase
          .from('departments')
          .select('id, name')
          .eq('id', conversationData.department_id)
          .single();
        departmentData = dept;
      }

      let agentData = null;
      if (conversationData?.assigned_to) {
        const { data: agent } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', conversationData.assigned_to)
          .single();
        agentData = agent;
      }

      const { data: channelData } = await supabase
        .from('whatsapp_channels')
        .select('id, name, phone_number')
        .eq('id', channelId)
        .single();

      await fetch(`${supabaseUrl}/functions/v1/dispatch-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          action: 'dispatch',
          event: {
            type: 'message.sent',
            data: {
              message: {
                id: savedMessage?.id || null,
                whatsapp_message_id: whatsappMessageId,
                type,
                content: content || caption || null,
                media_url: mediaUrl || null,
                timestamp: new Date().toISOString(),
              },
              contact: {
                id: contactId,
                name: contactData?.full_name || null,
                phone: contactData?.phone || formattedPhone,
                email: contactData?.email || null,
                lead_status: contactData?.lead_status || null,
                lead_score: contactData?.lead_score || null,
              },
              conversation: {
                id: conversationId,
                status: conversationData?.status || 'open',
                priority: conversationData?.priority || null,
                unread_count: conversationData?.unread_count || 0,
                created_at: conversationData?.created_at || null,
              },
              department: {
                id: conversationData?.department_id || null,
                name: departmentData?.name || null,
              },
              channel: {
                id: channelId,
                name: channelData?.name || null,
                phone_number: channelData?.phone_number || null,
              },
              agent: agentData ? {
                id: agentData.id,
                name: agentData.full_name,
                email: agentData.email,
              } : null,
              source: 'api',
              api_key_name: keyData.name,
            },
            context: {
              department: { id: conversationData?.department_id },
              channel: { id: channelId },
              assigned_to: conversationData?.assigned_to,
              tenant_id: tenantId,
            },
          },
        }),
      });
      console.log('[API Send] Webhook dispatched');
    } catch (webhookError) {
      console.error('[API Send] Error dispatching webhook:', webhookError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          messageId: savedMessage?.id || null,
          whatsappMessageId,
          conversationId,
          contactId,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[API Send] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
