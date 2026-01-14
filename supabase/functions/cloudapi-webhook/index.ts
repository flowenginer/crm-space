import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Download media from Facebook and upload to Supabase Storage
async function downloadAndUploadMedia(
  supabase: any, 
  mediaId: string, 
  messageType: string, 
  conversationId: string,
  accessToken: string
): Promise<string | null> {
  try {
    console.log(`[CloudAPI] Downloading media: ${mediaId} for conversation ${conversationId}`);
    
    // 1. Get download URL from Facebook
    const mediaInfoResponse = await fetch(
      `https://graph.facebook.com/v19.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const mediaInfo = await mediaInfoResponse.json();
    
    if (!mediaInfo.url) {
      console.error('[CloudAPI] No URL in media info:', mediaInfo);
      return null;
    }
    
    console.log(`[CloudAPI] Got media URL, mime_type: ${mediaInfo.mime_type}`);
    
    // 2. Download the file
    const mediaResponse = await fetch(mediaInfo.url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!mediaResponse.ok) {
      console.error('[CloudAPI] Failed to download media:', mediaResponse.status);
      return null;
    }
    
    const mediaBuffer = await mediaResponse.arrayBuffer();
    
    // 3. Determine extension from mime type
    const mimeType = mediaInfo.mime_type || 'application/octet-stream';
    const extensionMap: Record<string, string> = {
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/amr': 'amr',
      'audio/aac': 'aac',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/3gpp': '3gp',
      'application/pdf': 'pdf',
    };
    
    let extension = extensionMap[mimeType.split(';')[0]] || mimeType.split('/')[1]?.split(';')[0] || 'bin';
    const fileName = `${conversationId}/${Date.now()}_${mediaId}.${extension}`;
    
    // 4. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('conversation-attachments')
      .upload(fileName, mediaBuffer, {
        contentType: mimeType,
        cacheControl: '3600'
      });
    
    if (uploadError) {
      console.error('[CloudAPI] Upload error:', uploadError);
      return null;
    }
    
    // 5. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('conversation-attachments')
      .getPublicUrl(fileName);
    
    console.log(`[CloudAPI] Media uploaded successfully: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('[CloudAPI] Error downloading/uploading media:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    
    // Webhook verification (GET request from Meta)
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('Webhook verification request:', { mode, token, challenge });

      if (mode === 'subscribe' && token) {
        // Find config with matching verify_token
        const { data: config } = await supabase
          .from('cloudapi_configs')
          .select('id, verify_token')
          .eq('verify_token', token)
          .eq('is_active', true)
          .single();

        if (config) {
          // Mark webhook as configured
          await supabase
            .from('cloudapi_configs')
            .update({ webhook_configured: true })
            .eq('id', config.id);

          console.log('Webhook verified for config:', config.id);
          return new Response(challenge, { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });
        }
      }

      console.error('Webhook verification failed: Invalid token');
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    // Handle incoming webhooks (POST)
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('Received webhook:', JSON.stringify(body, null, 2));

      // Process each entry
      const entries = body.entry || [];
      
      for (const entry of entries) {
        const changes = entry.changes || [];
        
        for (const change of changes) {
          const field = change.field;
          const value = change.value;

          // Log the webhook
          await supabase.from('cloudapi_webhook_logs').insert({
            event_type: field,
            payload: change,
            processed: false,
          });

          // A Meta envia status com field="messages" mas com array "statuses" no value
          // Verificar o conteúdo do payload ao invés de confiar apenas no field
          if (value.statuses && value.statuses.length > 0) {
            // Evento de status (sent, delivered, read, failed)
            console.log('[CloudAPI] Processing status update from webhook, count:', value.statuses.length);
            await processStatuses(supabase, value);
          } else if (value.messages && value.messages.length > 0) {
            // Mensagem nova recebida
            await processMessages(supabase, value);
          } else if (field === 'calls' || (value.calls && value.calls.length > 0)) {
            await processCalls(supabase, value);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processMessages(supabase: any, value: any) {
  const metadata = value.metadata;
  const messages = value.messages || [];
  const contacts = value.contacts || [];
  
  const phoneNumberId = metadata?.phone_number_id;

  // Find the channel/config for this phone_number_id
  const { data: config } = await supabase
    .from('cloudapi_configs')
    .select('id, tenant_id, channel_id, access_token')
    .eq('phone_number_id', phoneNumberId)
    .eq('is_active', true)
    .single();

  if (!config) {
    console.log('No config found for phone_number_id:', phoneNumberId);
    return;
  }

  for (const message of messages) {
    const from = message.from;
    const messageType = message.type;
    const timestamp = new Date(parseInt(message.timestamp) * 1000);
    
    // Get contact name
    const contact = contacts.find((c: any) => c.wa_id === from);
    const contactName = contact?.profile?.name || from;

    console.log('Processing message:', {
      from,
      type: messageType,
      timestamp,
      contactName,
      tenantId: config.tenant_id,
    });

    // Find or create contact
    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone', from)
      .eq('tenant_id', config.tenant_id)
      .single();

    let contactId = existingContact?.id;

    if (!contactId) {
      const { data: newContact } = await supabase
        .from('contacts')
        .insert({
          phone: from,
          full_name: contactName,
          tenant_id: config.tenant_id,
        })
        .select('id')
        .single();
      contactId = newContact?.id;
    }

    // Find or create conversation - OTIMIZAÇÃO: Usar upsert com ON CONFLICT para evitar race condition
    let conversationId: string | undefined;
    
    // Primeiro, tentar encontrar conversa aberta existente
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('channel_id', config.channel_id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConversation?.id) {
      conversationId = existingConversation.id;
    } else {
      // Tentar criar nova conversa com tratamento de conflito
      const { data: newConversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          contact_id: contactId,
          channel_id: config.channel_id,
          tenant_id: config.tenant_id,
          status: 'open',
        })
        .select('id')
        .single();
      
      if (convError) {
        // Se erro de chave duplicada, buscar a conversa que foi criada por outro processo
        if (convError.code === '23505') {
          console.log('[CloudAPI] Duplicate key detected, fetching existing conversation');
          const { data: existingConv } = await supabase
            .from('conversations')
            .select('id')
            .eq('contact_id', contactId)
            .eq('channel_id', config.channel_id)
            .eq('status', 'open')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          conversationId = existingConv?.id;
        } else {
          console.error('[CloudAPI] Error creating conversation:', convError);
        }
      } else {
        conversationId = newConversation?.id;
      }
    }

    // Extract message content
    let content = '';
    let mediaUrl = null;

    switch (messageType) {
      case 'text':
        content = message.text?.body || '';
        break;
      case 'image':
        content = message.image?.caption || '[Imagem]';
        if (message.image?.id && config.access_token) {
          mediaUrl = await downloadAndUploadMedia(supabase, message.image.id, 'image', conversationId!, config.access_token);
        }
        break;
      case 'audio':
        content = '[Áudio]';
        if (message.audio?.id && config.access_token) {
          mediaUrl = await downloadAndUploadMedia(supabase, message.audio.id, 'audio', conversationId!, config.access_token);
        }
        break;
      case 'video':
        content = message.video?.caption || '[Vídeo]';
        if (message.video?.id && config.access_token) {
          mediaUrl = await downloadAndUploadMedia(supabase, message.video.id, 'video', conversationId!, config.access_token);
        }
        break;
      case 'document':
        content = message.document?.filename || '[Documento]';
        if (message.document?.id && config.access_token) {
          mediaUrl = await downloadAndUploadMedia(supabase, message.document.id, 'document', conversationId!, config.access_token);
        }
        break;
      case 'sticker':
        content = '[Sticker]';
        if (message.sticker?.id && config.access_token) {
          mediaUrl = await downloadAndUploadMedia(supabase, message.sticker.id, 'sticker', conversationId!, config.access_token);
        }
        break;
      default:
        content = `[${messageType}]`;
    }

    // Insert message (usando whatsapp_message_id que é a coluna correta)
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      contact_id: contactId,
      tenant_id: config.tenant_id,
      content,
      message_type: messageType,
      media_url: mediaUrl,
      is_from_me: false,
      whatsapp_message_id: message.id,
    });

    // Update conversation - incrementar unread_count usando SQL direto
    await supabase.rpc('increment_unread', { conv_id: conversationId });

    // Atualizar outros campos da conversa
    await supabase
      .from('conversations')
      .update({
        last_message_at: timestamp.toISOString(),
        last_message_preview: content.substring(0, 100),
        last_message_is_from_me: false,
        is_unread: true,
      })
      .eq('id', conversationId);
  }
}

async function processStatuses(supabase: any, value: any) {
  const statuses = value.statuses || [];
  
  console.log(`[CloudAPI] Processing ${statuses.length} status updates`);
  
  for (const status of statuses) {
    const messageId = status.id;
    const statusValue = status.status; // sent, delivered, read, failed
    const timestamp = new Date(parseInt(status.timestamp) * 1000);

    console.log('[CloudAPI] Updating message status:', { 
      whatsappMessageId: messageId, 
      status: statusValue, 
      timestamp: timestamp.toISOString() 
    });

    // Map Cloud API status to our status
    const statusMap: Record<string, string> = {
      'sent': 'sent',
      'delivered': 'delivered',
      'read': 'read',
      'failed': 'failed',
    };

    // Usar whatsapp_message_id que é a coluna correta
    const { error } = await supabase
      .from('messages')
      .update({ status: statusMap[statusValue] || statusValue })
      .eq('whatsapp_message_id', messageId);

    if (error) {
      console.error('[CloudAPI] Error updating message status:', error);
    } else {
      console.log('[CloudAPI] Message status updated successfully:', statusValue);
    }
  }
}

async function processCalls(supabase: any, value: any) {
  const metadata = value.metadata;
  const calls = value.calls || [];
  const phoneNumberId = metadata?.phone_number_id;

  // Find the config for this phone_number_id
  const { data: config } = await supabase
    .from('cloudapi_configs')
    .select('id, tenant_id, channel_id, calling_enabled')
    .eq('phone_number_id', phoneNumberId)
    .eq('is_active', true)
    .single();

  if (!config) {
    console.log('[Calls] No config found for phone_number_id:', phoneNumberId);
    return;
  }

  if (!config.calling_enabled) {
    console.log('[Calls] Calling not enabled for config:', config.id);
    return;
  }
  
  for (const call of calls) {
    const callId = call.id;
    const from = call.from;
    const to = call.to;
    const status = call.status; // ringing, accepted, rejected, terminated, completed, failed
    const direction = call.direction; // user_initiated, business_initiated
    const timestamp = new Date(parseInt(call.timestamp) * 1000);
    const duration = call.duration; // in seconds
    const errorCode = call.error?.code;
    const mediaType = call.media_type; // audio, video
    const session = call.session; // Contains SDP offer/answer

    console.log('[Calls] Processing call event:', { 
      callId, 
      from, 
      to, 
      status, 
      direction, 
      duration,
      mediaType,
      hasSDP: !!session?.sdp,
      timestamp 
    });

    // Find contact
    const phone = direction === 'user_initiated' ? from : to;
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, full_name, avatar_url')
      .eq('phone', phone)
      .eq('tenant_id', config.tenant_id)
      .single();

    // Find existing call log
    const { data: existingCall } = await supabase
      .from('call_logs')
      .select('id, start_time, user_id, conversation_id')
      .eq('whatsapp_call_id', callId)
      .single();

    let callLogId = existingCall?.id;

    if (existingCall) {
      // Update existing call
      const updates: Record<string, any> = {
        call_status: status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'completed' || status === 'terminated') {
        updates.end_time = timestamp.toISOString();
        if (duration) {
          updates.duration_seconds = duration;
        }
      }

      if (errorCode) {
        updates.error_code = errorCode;
      }

      await supabase
        .from('call_logs')
        .update(updates)
        .eq('id', existingCall.id);
    } else if (contact) {
      // Create new call log
      const { data: newCallLog } = await supabase
        .from('call_logs')
        .insert({
          contact_id: contact.id,
          tenant_id: config.tenant_id,
          channel_id: config.channel_id,
          whatsapp_call_id: callId,
          call_type: 'whatsapp',
          direction: direction === 'user_initiated' ? 'inbound' : 'outbound',
          call_status: status,
          start_time: timestamp.toISOString(),
          call_date: timestamp.toISOString().split('T')[0],
          call_time: timestamp.toTimeString().split(' ')[0],
          user_id: null, // Will be set when agent answers
        })
        .select('id')
        .single();

      callLogId = newCallLog?.id;
    }

    // Broadcast incoming calls via Realtime
    if (status === 'ringing' && direction === 'user_initiated') {
      console.log('[Calls] Broadcasting incoming call to agents');
      
      await supabase.channel('incoming-calls').send({
        type: 'broadcast',
        event: 'incoming_call',
        payload: {
          callId,
          callLogId,
          phone: from,
          contactId: contact?.id,
          contactName: contact?.full_name || from,
          contactAvatar: contact?.avatar_url,
          channelId: config.channel_id,
          tenantId: config.tenant_id,
          mediaType: mediaType || 'audio',
          sdpOffer: session?.sdp || null,
          sdpType: session?.sdp_type || null,
          timestamp: timestamp.toISOString(),
        },
      });
    }

    // Broadcast call state changes for active calls
    if (['accepted', 'rejected', 'terminated', 'completed', 'failed'].includes(status)) {
      console.log('[Calls] Broadcasting call state change:', status);
      
      await supabase.channel('call-events').send({
        type: 'broadcast',
        event: 'call_state_changed',
        payload: {
          callId,
          callLogId,
          status,
          duration,
          timestamp: timestamp.toISOString(),
        },
      });
    }
  }
}
