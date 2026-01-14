import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  auth_type: string;
  auth_token: string | null;
  auth_header_name: string | null;
  auth_header_value: string | null;
  events: string[];
  filters: Record<string, string>;
  is_active: boolean;
}

interface DispatchEvent {
  type: string;
  data: Record<string, unknown>;
  context: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, ...params } = await req.json();
    console.log(`[dispatch-webhook] Action: ${action}`);

    switch (action) {
      case 'dispatch':
        return await handleDispatch(supabase, params);
      case 'test':
        return await handleTest(params);
      case 'retry':
        return await handleRetry(supabase, params);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[dispatch-webhook] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleDispatch(supabase: any, params: { event: DispatchEvent }) {
  const { event } = params;
  console.log(`[dispatch-webhook] Dispatching event: ${event.type}`);

  // Fetch active webhooks that listen to this event
  console.log(`[dispatch-webhook] Looking for webhooks with event: ${event.type}`);
  
  const { data: webhooks, error: webhooksError } = await supabase
    .from('webhook_configs')
    .select('*')
    .eq('is_active', true)
    .filter('events', 'cs', JSON.stringify([event.type]));

  if (webhooksError) {
    console.error('[dispatch-webhook] Error fetching webhooks:', webhooksError);
    throw webhooksError;
  }

  console.log(`[dispatch-webhook] Found ${webhooks?.length || 0} webhooks for event ${event.type}`);

  const results = [];

  for (const webhook of (webhooks || []) as WebhookConfig[]) {
    // Check filters
    if (!matchesFilters(webhook.filters, event.context)) {
      console.log(`[dispatch-webhook] Webhook ${webhook.name} skipped due to filters`);
      continue;
    }

    // Build payload
    const payload = {
      event: event.type,
      timestamp: new Date().toISOString(),
      webhook_id: webhook.id,
      data: event.data,
      context: event.context,
    };

    // Create delivery record
    const { data: delivery, error: deliveryError } = await supabase
      .from('webhook_deliveries')
      .insert({
        webhook_id: webhook.id,
        event_type: event.type,
        payload,
        status: 'pending',
      })
      .select()
      .single();

    if (deliveryError) {
      console.error('[dispatch-webhook] Error creating delivery:', deliveryError);
      continue;
    }

    // Send webhook (fire and forget for performance)
    sendWebhookRequest(supabase, webhook, payload, delivery.id).catch(err => {
      console.error(`[dispatch-webhook] Error sending to ${webhook.name}:`, err);
    });

    results.push({ webhookId: webhook.id, deliveryId: delivery.id });
  }

  return new Response(
    JSON.stringify({ success: true, dispatched: results.length, results }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleTest(params: { webhook: { url: string; auth_type: string; auth_token?: string; auth_header_name?: string; auth_header_value?: string } }) {
  const { webhook } = params;
  console.log(`[dispatch-webhook] Testing webhook: ${webhook.url}`);

  const payload = {
    event: "test",
    timestamp: new Date().toISOString(),
    message: "Este é um teste de webhook do CRM",
    data: { test: true },
  };

  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (webhook.auth_type === 'bearer' && webhook.auth_token) {
      headers['Authorization'] = `Bearer ${webhook.auth_token}`;
    } else if (webhook.auth_type === 'header' && webhook.auth_header_name && webhook.auth_header_value) {
      headers[webhook.auth_header_name] = webhook.auth_header_value;
    }

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const responseTime = Date.now() - startTime;
    const responseBody = await response.text();

    return new Response(
      JSON.stringify({
        success: response.ok,
        statusCode: response.status,
        responseTime,
        response: responseBody.substring(0, 500),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        responseTime,
        error: errorMessage,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function handleRetry(supabase: any, params: { deliveryId: string }) {
  const { deliveryId } = params;
  console.log(`[dispatch-webhook] Retrying delivery: ${deliveryId}`);

  // Fetch delivery with webhook config
  const { data: delivery, error: deliveryError } = await supabase
    .from('webhook_deliveries')
    .select('*, webhook_configs(*)')
    .eq('id', deliveryId)
    .single();

  if (deliveryError || !delivery) {
    throw new Error('Delivery not found');
  }

  const webhook = delivery.webhook_configs as WebhookConfig;

  // Update delivery status
  await supabase
    .from('webhook_deliveries')
    .update({ status: 'retrying', attempts: delivery.attempts + 1 })
    .eq('id', deliveryId);

  // Resend
  await sendWebhookRequest(supabase, webhook, delivery.payload, deliveryId);

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function sendWebhookRequest(supabase: any, webhook: WebhookConfig, payload: any, deliveryId: string) {
  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (webhook.auth_type === 'bearer' && webhook.auth_token) {
      headers['Authorization'] = `Bearer ${webhook.auth_token}`;
    } else if (webhook.auth_type === 'header' && webhook.auth_header_name && webhook.auth_header_value) {
      headers[webhook.auth_header_name] = webhook.auth_header_value;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseTime = Date.now() - startTime;
    const responseBody = await response.text();

    // Update delivery
    await supabase
      .from('webhook_deliveries')
      .update({
        status: response.ok ? 'success' : 'failed',
        status_code: response.status,
        response_body: responseBody.substring(0, 1000),
        response_time_ms: responseTime,
        delivered_at: new Date().toISOString(),
        error_message: response.ok ? null : `HTTP ${response.status}`,
      })
      .eq('id', deliveryId);

    // Update webhook stats
    await supabase.rpc('increment_webhook_stats', {
      p_webhook_id: webhook.id,
      p_is_success: response.ok,
      p_error_message: response.ok ? null : `HTTP ${response.status}`,
    });

    console.log(`[dispatch-webhook] Sent to ${webhook.name}: ${response.status} in ${responseTime}ms`);
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const err = error as Error;
    const errorMessage = err.name === 'AbortError' ? 'Request timeout' : err.message;

    // Update delivery as failed
    await supabase
      .from('webhook_deliveries')
      .update({
        status: 'failed',
        error_message: errorMessage,
        response_time_ms: responseTime,
        next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .eq('id', deliveryId);

    // Update webhook stats
    await supabase.rpc('increment_webhook_stats', {
      p_webhook_id: webhook.id,
      p_is_success: false,
      p_error_message: errorMessage,
    });

    console.error(`[dispatch-webhook] Failed to send to ${webhook.name}:`, errorMessage);
  }
}

function matchesFilters(filters: Record<string, string>, context: Record<string, unknown>): boolean {
  if (!filters || Object.keys(filters).length === 0) return true;

  for (const [key, value] of Object.entries(filters)) {
    if (key === 'department_id' && value) {
      const dept = context.department as { id?: string } | undefined;
      if (!dept || dept.id !== value) return false;
    }
    if (key === 'channel_id' && value) {
      const channel = context.channel as { id?: string } | undefined;
      if (!channel || channel.id !== value) return false;
    }
  }

  return true;
}
