import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_URL = 'https://graph.facebook.com';

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
    const { data: authData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authData.user) {
      throw new Error('Unauthorized');
    }

    // Get tenant ID from user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', authData.user.id)
      .single();

    const tenantId = profile?.tenant_id;
    if (!tenantId) {
      throw new Error('Tenant not found');
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ========================================
      // REQUEST VERIFICATION CODE
      // ========================================
      case 'request_code': {
        const { phoneNumberId, codeMethod, language } = body;

        if (!phoneNumberId) {
          throw new Error('phoneNumberId is required');
        }

        // Get access token from cloudapi_configs
        const { data: config } = await supabase
          .from('cloudapi_configs')
          .select('access_token')
          .eq('tenant_id', tenantId)
          .eq('phone_number_id', phoneNumberId)
          .single();

        if (!config?.access_token) {
          throw new Error('Configuration not found for this phone number');
        }

        console.log('[Register Phone] Requesting code for:', phoneNumberId);

        // Request verification code
        const response = await fetch(
          `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${phoneNumberId}/request_code`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code_method: codeMethod || 'SMS', // SMS or VOICE
              language: language || 'pt_BR',
            }),
          }
        );

        const data = await response.json();

        console.log('[Register Phone] Request code response:', {
          ok: response.ok,
          status: response.status,
          data,
        });

        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to request verification code');
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: codeMethod === 'VOICE'
              ? 'Você receberá uma ligação com o código de verificação'
              : 'Código de verificação enviado via SMS'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ========================================
      // VERIFY CODE
      // ========================================
      case 'verify_code': {
        const { phoneNumberId, code } = body;

        if (!phoneNumberId || !code) {
          throw new Error('phoneNumberId and code are required');
        }

        // Get access token from cloudapi_configs
        const { data: config } = await supabase
          .from('cloudapi_configs')
          .select('access_token')
          .eq('tenant_id', tenantId)
          .eq('phone_number_id', phoneNumberId)
          .single();

        if (!config?.access_token) {
          throw new Error('Configuration not found for this phone number');
        }

        console.log('[Register Phone] Verifying code for:', phoneNumberId);

        // Verify the code
        const response = await fetch(
          `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${phoneNumberId}/verify_code`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code: code,
            }),
          }
        );

        const data = await response.json();

        console.log('[Register Phone] Verify code response:', {
          ok: response.ok,
          status: response.status,
          data,
        });

        if (!response.ok) {
          throw new Error(data.error?.message || 'Código inválido ou expirado');
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Código verificado com sucesso!'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ========================================
      // REGISTER PHONE NUMBER
      // ========================================
      case 'register': {
        const { phoneNumberId, pin } = body;

        if (!phoneNumberId) {
          throw new Error('phoneNumberId is required');
        }

        // Get access token from cloudapi_configs
        const { data: config } = await supabase
          .from('cloudapi_configs')
          .select('access_token, channel_id')
          .eq('tenant_id', tenantId)
          .eq('phone_number_id', phoneNumberId)
          .single();

        if (!config?.access_token) {
          throw new Error('Configuration not found for this phone number');
        }

        console.log('[Register Phone] Registering phone:', phoneNumberId);

        // Register the phone number
        const registerBody: Record<string, any> = {
          messaging_product: 'whatsapp',
        };

        // PIN is optional - used for two-factor authentication
        if (pin) {
          registerBody.pin = pin;
        }

        const response = await fetch(
          `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${phoneNumberId}/register`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(registerBody),
          }
        );

        const data = await response.json();

        console.log('[Register Phone] Register response:', {
          ok: response.ok,
          status: response.status,
          data,
        });

        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to register phone number');
        }

        // Update channel status to connected
        if (config.channel_id) {
          await supabase
            .from('whatsapp_channels')
            .update({ status: 'connected' })
            .eq('id', config.channel_id);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Número registrado com sucesso! Agora você pode enviar e receber mensagens.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ========================================
      // DEREGISTER PHONE NUMBER
      // ========================================
      case 'deregister': {
        const { phoneNumberId } = body;

        if (!phoneNumberId) {
          throw new Error('phoneNumberId is required');
        }

        // Get access token from cloudapi_configs
        const { data: config } = await supabase
          .from('cloudapi_configs')
          .select('access_token, channel_id')
          .eq('tenant_id', tenantId)
          .eq('phone_number_id', phoneNumberId)
          .single();

        if (!config?.access_token) {
          throw new Error('Configuration not found for this phone number');
        }

        console.log('[Register Phone] Deregistering phone:', phoneNumberId);

        const response = await fetch(
          `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${phoneNumberId}/deregister`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const data = await response.json();

        console.log('[Register Phone] Deregister response:', {
          ok: response.ok,
          status: response.status,
          data,
        });

        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to deregister phone number');
        }

        // Update channel status
        if (config.channel_id) {
          await supabase
            .from('whatsapp_channels')
            .update({ status: 'disconnected' })
            .eq('id', config.channel_id);
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Número desregistrado com sucesso.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ========================================
      // GET PHONE NUMBER STATUS
      // ========================================
      case 'get_status': {
        const { phoneNumberId } = body;

        if (!phoneNumberId) {
          throw new Error('phoneNumberId is required');
        }

        // Get access token from cloudapi_configs
        const { data: config } = await supabase
          .from('cloudapi_configs')
          .select('access_token')
          .eq('tenant_id', tenantId)
          .eq('phone_number_id', phoneNumberId)
          .single();

        if (!config?.access_token) {
          throw new Error('Configuration not found for this phone number');
        }

        console.log('[Register Phone] Getting status for:', phoneNumberId);

        const response = await fetch(
          `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${phoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,messaging_limit_tier,is_official_business_account,account_mode,certificate,name_status,new_name_status`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${config.access_token}`,
            },
          }
        );

        const data = await response.json();

        console.log('[Register Phone] Status response:', {
          ok: response.ok,
          status: response.status,
        });

        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to get phone status');
        }

        return new Response(
          JSON.stringify({
            success: true,
            phoneNumber: {
              id: data.id,
              displayPhoneNumber: data.display_phone_number,
              verifiedName: data.verified_name,
              codeVerificationStatus: data.code_verification_status,
              qualityRating: data.quality_rating,
              messagingLimitTier: data.messaging_limit_tier,
              isOfficialBusinessAccount: data.is_official_business_account,
              accountMode: data.account_mode,
              certificate: data.certificate,
              nameStatus: data.name_status,
              newNameStatus: data.new_name_status,
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ========================================
      // SET TWO-FACTOR AUTH PIN
      // ========================================
      case 'set_pin': {
        const { phoneNumberId, pin } = body;

        if (!phoneNumberId || !pin) {
          throw new Error('phoneNumberId and pin are required');
        }

        if (pin.length !== 6 || !/^\d+$/.test(pin)) {
          throw new Error('PIN must be exactly 6 digits');
        }

        // Get access token from cloudapi_configs
        const { data: config } = await supabase
          .from('cloudapi_configs')
          .select('access_token')
          .eq('tenant_id', tenantId)
          .eq('phone_number_id', phoneNumberId)
          .single();

        if (!config?.access_token) {
          throw new Error('Configuration not found for this phone number');
        }

        console.log('[Register Phone] Setting PIN for:', phoneNumberId);

        const response = await fetch(
          `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${phoneNumberId}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              pin: pin,
            }),
          }
        );

        const data = await response.json();

        console.log('[Register Phone] Set PIN response:', {
          ok: response.ok,
          status: response.status,
        });

        if (!response.ok) {
          throw new Error(data.error?.message || 'Failed to set PIN');
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'PIN de verificação configurado com sucesso!'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('[Register Phone] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
