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
  const META_APP_ID = Deno.env.get('META_APP_ID')!;
  const META_APP_SECRET = Deno.env.get('META_APP_SECRET')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Validate authorization for non-callback actions
    let user: any = null;
    let tenantId: string | null = null;

    if (action !== 'callback') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Missing authorization header');
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !authData.user) {
        throw new Error('Unauthorized');
      }
      
      user = authData.user;

      // Get tenant ID from user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      tenantId = profile?.tenant_id;
    }

    switch (action) {
      case 'get-signup-url': {
        // Generate state for OAuth
        const state = crypto.randomUUID();
        
        // Store state temporarily
        await supabase
          .from('cloudapi_webhook_logs')
          .insert({
            event_type: 'oauth_state',
            payload: { state, userId: user.id, tenantId },
            processed: false,
          });

        const redirectUri = `${supabaseUrl}/functions/v1/whatsapp-embedded-signup?action=callback`;
        
        // WhatsApp Embedded Signup URL with required permissions
        const scopes = [
          'whatsapp_business_management',
          'whatsapp_business_messaging',
          'business_management',
        ].join(',');

        const loginUrl = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth?` + new URLSearchParams({
          client_id: META_APP_ID,
          redirect_uri: redirectUri,
          state: state,
          scope: scopes,
          response_type: 'code',
          config_id: '', // Optional: WhatsApp Embedded Signup config ID
          override_default_response_type: 'true',
        }).toString();

        return new Response(
          JSON.stringify({ loginUrl, state }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'callback': {
        // Handle OAuth callback
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const errorReason = url.searchParams.get('error_reason');
        const errorDescription = url.searchParams.get('error_description');

        console.log('[Embedded Signup] Callback received:', { 
          hasCode: !!code, 
          state, 
          error, 
          errorReason, 
          errorDescription 
        });

        if (error) {
          console.error('[Embedded Signup] OAuth error:', { error, errorReason, errorDescription });
          
          const fullError = errorDescription || errorReason || error;
          const errorHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>Erro</title></head>
            <body>
              <script>
                localStorage.setItem('whatsapp_oauth_result', JSON.stringify({
                  type: 'WHATSAPP_OAUTH_ERROR',
                  error: '${fullError.replace(/'/g, "\\'")}'
                }));
                window.close();
              </script>
              <p>Erro na autenticação: ${fullError}. Você pode fechar esta janela.</p>
            </body>
            </html>
          `;
          return new Response(errorHtml, {
            headers: { 'Content-Type': 'text/html' },
          });
        }

        if (!code || !state) {
          throw new Error('Missing code or state');
        }

        // Verify state
        const { data: stateData } = await supabase
          .from('cloudapi_webhook_logs')
          .select('payload')
          .eq('event_type', 'oauth_state')
          .eq('processed', false)
          .order('created_at', { ascending: false })
          .limit(10);

        const validState = stateData?.find((s: any) => s.payload?.state === state);
        if (!validState) {
          throw new Error('Invalid state');
        }

        const { userId, tenantId: stateTenantId } = validState.payload;

        // Exchange code for access token
        const redirectUri = `${supabaseUrl}/functions/v1/whatsapp-embedded-signup?action=callback`;
        
        console.log('[Embedded Signup] Exchanging code for token...', { 
          META_APP_ID, 
          redirectUri,
          hasCode: !!code 
        });
        
        const tokenResponse = await fetch(
          `${GRAPH_API_URL}/${GRAPH_API_VERSION}/oauth/access_token?` + new URLSearchParams({
            client_id: META_APP_ID,
            client_secret: META_APP_SECRET,
            code: code,
            redirect_uri: redirectUri,
          }).toString()
        );

        const tokenData = await tokenResponse.json();

        console.log('[Embedded Signup] Token exchange response:', { 
          ok: tokenResponse.ok, 
          status: tokenResponse.status,
          hasAccessToken: !!tokenData.access_token,
          error: tokenData.error 
        });

        if (!tokenResponse.ok || tokenData.error) {
          throw new Error(tokenData.error?.message || `Failed to exchange token: ${JSON.stringify(tokenData)}`);
        }

        const accessToken = tokenData.access_token;

        // Fetch WhatsApp Business Accounts
        console.log('[Embedded Signup] Fetching WABAs...');
        
        const wabaResponse = await fetch(
          `${GRAPH_API_URL}/${GRAPH_API_VERSION}/me/businesses?fields=id,name,owned_whatsapp_business_accounts{id,name,currency,timezone_id,account_review_status,on_behalf_of_business_info,primary_funding_id,purchase_order_number,message_template_namespace}&access_token=${accessToken}`
        );

        const wabaData = await wabaResponse.json();

        console.log('[Embedded Signup] WABAs response:', { 
          ok: wabaResponse.ok,
          status: wabaResponse.status,
          businessCount: wabaData.data?.length || 0,
          error: wabaData.error
        });

        // Detailed logging of full WABAs response
        console.log('[Embedded Signup] Full WABAs response data:', JSON.stringify(wabaData, null, 2));

        // Log each business details
        for (const business of wabaData.data || []) {
          console.log('[Embedded Signup] Business details:', {
            id: business.id,
            name: business.name,
            hasOwnedWabas: !!business.owned_whatsapp_business_accounts,
            ownedWabasCount: business.owned_whatsapp_business_accounts?.data?.length || 0,
            ownedWabas: JSON.stringify(business.owned_whatsapp_business_accounts)
          });
        }

        if (!wabaResponse.ok) {
          throw new Error(wabaData.error?.message || 'Failed to fetch WABAs');
        }

        // Extract WABAs from all businesses
        const wabas: any[] = [];
        for (const business of wabaData.data || []) {
          const ownedWabas = business.owned_whatsapp_business_accounts?.data || [];
          for (const waba of ownedWabas) {
            wabas.push({
              ...waba,
              business_id: business.id,
              business_name: business.name,
            });
          }
        }

        // Store token and WABAs temporarily for next step
        await supabase
          .from('cloudapi_webhook_logs')
          .insert({
            event_type: 'oauth_pending',
            payload: {
              accessToken,
              wabas,
              userId,
              tenantId: stateTenantId,
              expiresIn: tokenData.expires_in,
            },
            processed: false,
          });

        // Mark state as used
        await supabase
          .from('cloudapi_webhook_logs')
          .update({ processed: true })
          .eq('event_type', 'oauth_state')
          .eq('payload->>state', state);

        const successHtml = `
          <!DOCTYPE html>
          <html>
          <head><title>Sucesso</title></head>
          <body>
            <script>
              localStorage.setItem('whatsapp_oauth_result', JSON.stringify({
                type: 'WHATSAPP_OAUTH_SUCCESS',
                wabas: ${JSON.stringify(wabas)},
                state: '${state}'
              }));
              window.close();
            </script>
            <p>Autenticação concluída. Você pode fechar esta janela.</p>
          </body>
          </html>
        `;

        return new Response(successHtml, {
          headers: { 'Content-Type': 'text/html' },
        });
      }

      case 'get-phone-numbers': {
        const body = await req.json();
        const { wabaId } = body;

        if (!wabaId) {
          throw new Error('wabaId is required');
        }

        // Get stored access token
        const { data: oauthData } = await supabase
          .from('cloudapi_webhook_logs')
          .select('payload')
          .eq('event_type', 'oauth_pending')
          .eq('processed', false)
          .eq('payload->>userId', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!oauthData) {
          throw new Error('No pending OAuth data found');
        }

        const accessToken = oauthData.payload.accessToken;

        // Fetch phone numbers for this WABA
        const phonesResponse = await fetch(
          `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,messaging_limit_tier&access_token=${accessToken}`
        );

        const phonesData = await phonesResponse.json();

        if (!phonesResponse.ok) {
          throw new Error(phonesData.error?.message || 'Failed to fetch phone numbers');
        }

        return new Response(
          JSON.stringify({ phoneNumbers: phonesData.data || [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'complete-setup': {
        const body = await req.json();
        const { wabaId, phoneNumberId, channelName, departmentId } = body;

        if (!wabaId || !phoneNumberId) {
          throw new Error('wabaId and phoneNumberId are required');
        }

        // Get stored access token
        const { data: oauthData } = await supabase
          .from('cloudapi_webhook_logs')
          .select('payload')
          .eq('event_type', 'oauth_pending')
          .eq('processed', false)
          .eq('payload->>userId', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!oauthData) {
          throw new Error('No pending OAuth data found');
        }

        const { accessToken, wabas } = oauthData.payload;
        const selectedWaba = wabas.find((w: any) => w.id === wabaId);

        // Get phone number details
        const phoneResponse = await fetch(
          `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier&access_token=${accessToken}`
        );

        const phoneData = await phoneResponse.json();

        if (!phoneResponse.ok) {
          throw new Error(phoneData.error?.message || 'Failed to get phone details');
        }

        // Generate verify token for webhook
        const verifyToken = crypto.randomUUID();

        // Create channel first
        const { data: channel, error: channelError } = await supabase
          .from('whatsapp_channels')
          .insert({
            name: channelName || phoneData.verified_name || 'WhatsApp Oficial',
            phone: phoneData.display_phone_number,
            status: 'connected',
            type: 'official',
            tenant_id: tenantId,
            department_id: departmentId || null,
            instance_id: phoneNumberId,
          })
          .select()
          .single();

        if (channelError) {
          throw new Error(`Failed to create channel: ${channelError.message}`);
        }

        // Create Cloud API config
        const { data: config, error: configError } = await supabase
          .from('cloudapi_configs')
          .insert({
            tenant_id: tenantId,
            channel_id: channel.id,
            phone_number_id: phoneNumberId,
            waba_id: wabaId,
            business_account_id: selectedWaba?.business_id || null,
            access_token: accessToken,
            verify_token: verifyToken,
            is_active: true,
            webhook_configured: false,
          })
          .select()
          .single();

        if (configError) {
          // Rollback channel creation
          await supabase.from('whatsapp_channels').delete().eq('id', channel.id);
          throw new Error(`Failed to create config: ${configError.message}`);
        }

        // Try to register webhook (optional - may require Meta Business verification)
        const webhookUrl = `${supabaseUrl}/functions/v1/cloudapi-webhook`;
        
        try {
          // Subscribe to webhook fields
          const subscribeResponse = await fetch(
            `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${wabaId}/subscribed_apps`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                override_callback_uri: webhookUrl,
                verify_token: verifyToken,
              }),
            }
          );

          if (subscribeResponse.ok) {
            await supabase
              .from('cloudapi_configs')
              .update({ webhook_configured: true })
              .eq('id', config.id);
          }
        } catch (webhookError) {
          console.warn('[Embedded Signup] Webhook registration failed (may need manual setup):', webhookError);
        }

        // Mark OAuth data as processed
        await supabase
          .from('cloudapi_webhook_logs')
          .update({ processed: true })
          .eq('event_type', 'oauth_pending')
          .eq('payload->>userId', user.id);

        return new Response(
          JSON.stringify({
            success: true,
            channel,
            config: {
              id: config.id,
              webhookUrl,
              verifyToken,
              webhookConfigured: config.webhook_configured,
            },
            phoneDetails: {
              displayPhoneNumber: phoneData.display_phone_number,
              verifiedName: phoneData.verified_name,
              qualityRating: phoneData.quality_rating,
              messagingLimitTier: phoneData.messaging_limit_tier,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('[Embedded Signup] Error:', error);
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
