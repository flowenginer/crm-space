import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get auth header and validate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: 'User has no tenant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tenantId = profile.tenant_id;

    // Parse request body
    const body = await req.json();
    const { contactId, contactPhone, conversationId, channelId, customMessage } = body;

    console.log('[CallPermission] Request:', { contactId, contactPhone, conversationId, channelId });

    if (!contactId || !contactPhone || !conversationId) {
      return new Response(JSON.stringify({ error: 'Missing required fields: contactId, contactPhone, conversationId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the CloudAPI config for the channel
    let config;
    
    if (channelId) {
      // Get config by channel_id
      const { data } = await supabase
        .from('cloudapi_configs')
        .select('id, phone_number_id, access_token, calling_enabled, channel_id')
        .eq('channel_id', channelId)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();
      config = data;
    } else {
      // Get first active config for tenant
      const { data } = await supabase
        .from('cloudapi_configs')
        .select('id, phone_number_id, access_token, calling_enabled, channel_id')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .eq('calling_enabled', true)
        .limit(1)
        .single();
      config = data;
    }

    if (!config) {
      return new Response(JSON.stringify({ 
        error: 'No active CloudAPI config found with calling enabled',
        code: 'NO_CONFIG'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.calling_enabled) {
      return new Response(JSON.stringify({ 
        error: 'Calling is not enabled for this channel',
        code: 'CALLING_DISABLED'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[CallPermission] Using config:', { 
      configId: config.id, 
      phoneNumberId: config.phone_number_id,
      channelId: config.channel_id 
    });

    // Format phone number (remove any non-digits)
    const formattedPhone = contactPhone.replace(/\D/g, '');

    // Default message text
    const messageText = customMessage || 
      "Olá! Podemos ligar para você quando necessário para atendimento? Clique no botão abaixo para autorizar chamadas.";

    // Send interactive call_permission_request message via Meta Graph API
    // According to Meta's documentation for Business-Initiated Calls
    const messagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: formattedPhone,
      type: "interactive",
      interactive: {
        type: "call_permission_request",
        body: {
          text: messageText
        },
        action: {
          name: "call_permission_request"
        }
      }
    };

    console.log('[CallPermission] Sending message to Meta:', JSON.stringify(messagePayload, null, 2));

    const metaResponse = await fetch(
      `https://graph.facebook.com/v19.0/${config.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      }
    );

    const metaResult = await metaResponse.json();
    console.log('[CallPermission] Meta response:', JSON.stringify(metaResult, null, 2));

    if (!metaResponse.ok) {
      console.error('[CallPermission] Meta API error:', metaResult);
      return new Response(JSON.stringify({ 
        error: metaResult.error?.message || 'Failed to send call permission request',
        meta_error: metaResult.error,
        code: 'META_API_ERROR'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const whatsappMessageId = metaResult.messages?.[0]?.id;

    // Update contact call_permission_status to 'pending'
    const { error: contactUpdateError } = await supabase
      .from('contacts')
      .update({
        call_permission_status: 'pending',
        call_permission_requested_at: new Date().toISOString(),
      })
      .eq('id', contactId)
      .eq('tenant_id', tenantId);

    if (contactUpdateError) {
      console.error('[CallPermission] Error updating contact:', contactUpdateError);
    }

    // Insert the message into the messages table
    const { data: insertedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        contact_id: contactId,
        tenant_id: tenantId,
        content: messageText,
        message_type: 'interactive',
        is_from_me: true,
        whatsapp_message_id: whatsappMessageId,
        status: 'sent',
        sender_id: user.id,
      })
      .select('id')
      .single();

    if (messageError) {
      console.error('[CallPermission] Error inserting message:', messageError);
    }

    // Update conversation last_message
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: '📞 Solicitação de permissão para chamada',
        last_message_is_from_me: true,
      })
      .eq('id', conversationId);

    console.log('[CallPermission] Success! Message ID:', whatsappMessageId);

    return new Response(JSON.stringify({ 
      success: true,
      messageId: whatsappMessageId,
      status: 'pending'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[CallPermission] Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
