import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

          if (field === 'messages') {
            await processMessages(supabase, value);
          } else if (field === 'statuses') {
            await processStatuses(supabase, value);
          } else if (field === 'calls') {
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
    .select('id, tenant_id, channel_id')
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

    // Find or create conversation
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('channel_id', config.channel_id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let conversationId = existingConversation?.id;

    if (!conversationId) {
      const { data: newConversation } = await supabase
        .from('conversations')
        .insert({
          contact_id: contactId,
          channel_id: config.channel_id,
          tenant_id: config.tenant_id,
          status: 'open',
        })
        .select('id')
        .single();
      conversationId = newConversation?.id;
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
        mediaUrl = message.image?.id; // Need to fetch actual URL
        break;
      case 'audio':
        content = '[Áudio]';
        mediaUrl = message.audio?.id;
        break;
      case 'video':
        content = message.video?.caption || '[Vídeo]';
        mediaUrl = message.video?.id;
        break;
      case 'document':
        content = message.document?.filename || '[Documento]';
        mediaUrl = message.document?.id;
        break;
      case 'sticker':
        content = '[Sticker]';
        mediaUrl = message.sticker?.id;
        break;
      default:
        content = `[${messageType}]`;
    }

    // Insert message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      contact_id: contactId,
      tenant_id: config.tenant_id,
      content,
      message_type: messageType,
      media_url: mediaUrl,
      is_from_me: false,
      provider_message_id: message.id,
    });

    // Update conversation
    await supabase
      .from('conversations')
      .update({
        last_message_at: timestamp.toISOString(),
        last_message_preview: content.substring(0, 100),
        last_message_is_from_me: false,
        unread_count: supabase.rpc('increment', { x: 1 }),
        is_unread: true,
      })
      .eq('id', conversationId);
  }
}

async function processStatuses(supabase: any, value: any) {
  const statuses = value.statuses || [];
  
  for (const status of statuses) {
    const messageId = status.id;
    const statusValue = status.status; // sent, delivered, read, failed
    const timestamp = new Date(parseInt(status.timestamp) * 1000);

    console.log('Processing status:', { messageId, status: statusValue, timestamp });

    // Map Cloud API status to our status
    const statusMap: Record<string, string> = {
      'sent': 'sent',
      'delivered': 'delivered',
      'read': 'read',
      'failed': 'failed',
    };

    await supabase
      .from('messages')
      .update({ status: statusMap[statusValue] || statusValue })
      .eq('provider_message_id', messageId);
  }
}

async function processCalls(supabase: any, value: any) {
  const calls = value.calls || [];
  
  for (const call of calls) {
    const callId = call.id;
    const from = call.from;
    const to = call.to;
    const status = call.status; // ringing, accepted, rejected, terminated, completed, failed
    const direction = call.direction; // user_initiated, business_initiated
    const timestamp = new Date(parseInt(call.timestamp) * 1000);
    const duration = call.duration; // in seconds
    const errorCode = call.error?.code;

    console.log('Processing call event:', { 
      callId, 
      from, 
      to, 
      status, 
      direction, 
      duration,
      timestamp 
    });

    // Find existing call log
    const { data: existingCall } = await supabase
      .from('call_logs')
      .select('id, start_time')
      .eq('whatsapp_call_id', callId)
      .single();

    if (existingCall) {
      // Update existing call
      const updates: Record<string, any> = {
        call_status: status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'completed' || status === 'terminated') {
        updates.end_time = timestamp.toISOString();
        updates.duration_seconds = duration;
      }

      if (errorCode) {
        updates.error_code = errorCode;
      }

      await supabase
        .from('call_logs')
        .update(updates)
        .eq('id', existingCall.id);
    } else {
      // Find contact and create new call log
      const phone = direction === 'user_initiated' ? from : to;
      
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, tenant_id')
        .eq('phone', phone)
        .single();

      if (contact) {
        await supabase.from('call_logs').insert({
          contact_id: contact.id,
          tenant_id: contact.tenant_id,
          whatsapp_call_id: callId,
          call_type: 'whatsapp',
          direction: direction === 'user_initiated' ? 'inbound' : 'outbound',
          call_status: status,
          start_time: timestamp.toISOString(),
          call_date: timestamp.toISOString().split('T')[0],
          call_time: timestamp.toTimeString().split(' ')[0],
          user_id: null, // Will be set when agent answers
        });
      }
    }
  }
}
