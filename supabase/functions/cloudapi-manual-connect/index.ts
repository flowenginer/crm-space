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
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization header required');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get user's tenant_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      throw new Error('Tenant not found');
    }

    const tenantId = profile.tenant_id;

    // Parse request body
    const { accessToken, phoneNumberId, wabaId, channelName, departmentId } = await req.json();

    if (!accessToken || !phoneNumberId || !wabaId || !channelName) {
      throw new Error('Missing required fields: accessToken, phoneNumberId, wabaId, channelName');
    }

    console.log('[cloudapi-manual-connect] Starting connection for tenant:', tenantId);

    // Validate token with Meta API
    const metaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!metaResponse.ok) {
      const errorData = await metaResponse.json();
      console.error('[cloudapi-manual-connect] Meta API error:', errorData);
      throw new Error(errorData.error?.message || 'Failed to validate token with Meta API');
    }

    const phoneData = await metaResponse.json();
    console.log('[cloudapi-manual-connect] Phone data from Meta:', phoneData);

    // Get WABA info
    const wabaResponse = await fetch(
      `https://graph.facebook.com/v21.0/${wabaId}?fields=name,currency,timezone_id`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    let wabaData: any = null;
    if (wabaResponse.ok) {
      wabaData = await wabaResponse.json();
      console.log('[cloudapi-manual-connect] WABA data from Meta:', wabaData);
    }

    // Generate verify token for webhook
    const verifyToken = crypto.randomUUID().replace(/-/g, '');
    const webhookUrl = `${supabaseUrl}/functions/v1/cloudapi-webhook`;

    // Create WhatsApp channel
    const { data: channel, error: channelError } = await supabase
      .from('whatsapp_channels')
      .insert({
        tenant_id: tenantId,
        name: channelName,
        phone: phoneData.display_phone_number || phoneNumberId,
        type: 'official',
        status: 'connected',
        department_id: departmentId || null,
        webhook_url: webhookUrl,
        session_data: {
          verified_name: phoneData.verified_name,
          quality_rating: phoneData.quality_rating,
          messaging_limit_tier: phoneData.messaging_limit_tier,
          waba_name: wabaData?.name,
          waba_currency: wabaData?.currency,
          waba_timezone: wabaData?.timezone_id,
        },
      })
      .select('id')
      .single();

    if (channelError) {
      console.error('[cloudapi-manual-connect] Channel creation error:', channelError);
      throw new Error('Failed to create channel: ' + channelError.message);
    }

    console.log('[cloudapi-manual-connect] Channel created:', channel.id);

    // Deactivate previous configs for this tenant
    await supabase
      .from('cloudapi_configs')
      .update({ is_active: false })
      .eq('tenant_id', tenantId);

    // Create Cloud API config
    const { data: config, error: configError } = await supabase
      .from('cloudapi_configs')
      .insert({
        tenant_id: tenantId,
        phone_number_id: phoneNumberId,
        waba_id: wabaId,
        access_token: accessToken,
        verify_token: verifyToken,
        channel_id: channel.id,
        is_active: true,
        webhook_configured: false,
        api_version: 'v21.0',
      })
      .select('id')
      .single();

    if (configError) {
      console.error('[cloudapi-manual-connect] Config creation error:', configError);
      // Rollback channel creation
      await supabase.from('whatsapp_channels').delete().eq('id', channel.id);
      throw new Error('Failed to create config: ' + configError.message);
    }

    console.log('[cloudapi-manual-connect] Config created:', config.id);

    return new Response(
      JSON.stringify({
        success: true,
        channelId: channel.id,
        configId: config.id,
        webhookUrl,
        verifyToken,
        phoneNumber: phoneData.display_phone_number,
        verifiedName: phoneData.verified_name,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[cloudapi-manual-connect] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
