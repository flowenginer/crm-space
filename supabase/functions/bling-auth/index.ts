import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BLING_AUTH_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize';
const BLING_TOKEN_URL = 'https://www.bling.com.br/Api/v3/oauth/token';

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const action = pathParts[pathParts.length - 1];

  console.log('[Bling Auth] Request path:', url.pathname, 'Action:', action);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle callback from Bling OAuth
    if (action === 'callback' || url.pathname.includes('/callback')) {
      return await handleCallback(req, supabase);
    }

    // Handle authorize action - redirects to Bling
    if (action === 'authorize' || url.pathname.includes('/authorize')) {
      return await handleAuthorize(req, supabase);
    }

    // Default: check request body for action
    if (req.method === 'POST') {
      const body = await req.json();
      
      if (body.action === 'authorize') {
        return await handleAuthorizePost(body, supabase);
      }
      
      if (body.action === 'refresh') {
        return await handleRefresh(body, supabase);
      }

      if (body.action === 'revoke') {
        return await handleRevoke(body, supabase);
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use /authorize, /callback, or POST with action: authorize|refresh|revoke' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Bling Auth] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handleAuthorize(req: Request, supabase: any) {
  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenant_id');
  const redirectUri = url.searchParams.get('redirect_uri');

  if (!tenantId) {
    return new Response(
      JSON.stringify({ error: 'tenant_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get Bling config for this tenant
  const { data: config, error } = await supabase
    .from('bling_integration_config')
    .select('client_id, client_secret')
    .eq('tenant_id', tenantId)
    .single();

  if (error || !config) {
    console.error('[Bling Auth] Config not found for tenant:', tenantId, error);
    return new Response(
      JSON.stringify({ error: 'Bling configuration not found for this tenant' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!config.client_id || !config.client_secret) {
    return new Response(
      JSON.stringify({ error: 'Bling client_id and client_secret must be configured first' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build the callback URL
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const callbackUrl = `${supabaseUrl}/functions/v1/bling-auth/callback`;

  // Store state for CSRF protection (tenant_id + redirect_uri)
  const state = btoa(JSON.stringify({ tenant_id: tenantId, redirect_uri: redirectUri || '' }));

  // Build Bling authorization URL
  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id: config.client_id,
    redirect_uri: callbackUrl,
    state: state,
  });

  const authUrl = `${BLING_AUTH_URL}?${authParams.toString()}`;

  console.log('[Bling Auth] Redirecting to Bling OAuth:', authUrl);

  // Redirect to Bling
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      'Location': authUrl,
    },
  });
}

async function handleAuthorizePost(body: any, supabase: any) {
  const { tenant_id, redirect_uri } = body;

  if (!tenant_id) {
    return new Response(
      JSON.stringify({ error: 'tenant_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get Bling config for this tenant
  const { data: config, error } = await supabase
    .from('bling_integration_config')
    .select('client_id, client_secret')
    .eq('tenant_id', tenant_id)
    .single();

  if (error || !config) {
    return new Response(
      JSON.stringify({ error: 'Bling configuration not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!config.client_id || !config.client_secret) {
    return new Response(
      JSON.stringify({ error: 'Configure client_id and client_secret first' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Build callback URL
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const callbackUrl = `${supabaseUrl}/functions/v1/bling-auth/callback`;

  // State for CSRF protection
  const state = btoa(JSON.stringify({ tenant_id, redirect_uri: redirect_uri || '' }));

  const authParams = new URLSearchParams({
    response_type: 'code',
    client_id: config.client_id,
    redirect_uri: callbackUrl,
    state: state,
  });

  const authUrl = `${BLING_AUTH_URL}?${authParams.toString()}`;

  console.log('[Bling Auth] Generated auth URL for tenant:', tenant_id);

  return new Response(
    JSON.stringify({ auth_url: authUrl }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleCallback(req: Request, supabase: any) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  console.log('[Bling Auth] Callback received - code:', code ? 'present' : 'missing', 'state:', state ? 'present' : 'missing');

  // Handle OAuth error
  if (error) {
    console.error('[Bling Auth] OAuth error:', error, errorDescription);
    return createCallbackResponse(false, `OAuth error: ${error} - ${errorDescription}`);
  }

  if (!code || !state) {
    return createCallbackResponse(false, 'Missing code or state parameter');
  }

  // Decode state
  let stateData;
  try {
    stateData = JSON.parse(atob(state));
  } catch {
    return createCallbackResponse(false, 'Invalid state parameter');
  }

  const { tenant_id, redirect_uri } = stateData;

  if (!tenant_id) {
    return createCallbackResponse(false, 'Missing tenant_id in state');
  }

  // Get Bling config
  const { data: config, error: configError } = await supabase
    .from('bling_integration_config')
    .select('client_id, client_secret')
    .eq('tenant_id', tenant_id)
    .single();

  if (configError || !config) {
    console.error('[Bling Auth] Config not found:', configError);
    return createCallbackResponse(false, 'Configuration not found');
  }

  // Exchange code for tokens
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const callbackUrl = `${supabaseUrl}/functions/v1/bling-auth/callback`;

  const credentials = btoa(`${config.client_id}:${config.client_secret}`);

  console.log('[Bling Auth] Exchanging code for tokens...');

  const tokenResponse = await fetch(BLING_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: callbackUrl,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.error('[Bling Auth] Token exchange failed:', tokenData);
    return createCallbackResponse(false, `Token exchange failed: ${tokenData.error_description || tokenData.error || 'Unknown error'}`);
  }

  console.log('[Bling Auth] Token exchange successful');

  // Calculate token expiration (Bling tokens expire in 6 hours = 21600 seconds)
  const expiresIn = tokenData.expires_in || 21600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Save tokens to database
  const { error: updateError } = await supabase
    .from('bling_integration_config')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      is_active: true,
      is_configured: true,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenant_id);

  if (updateError) {
    console.error('[Bling Auth] Failed to save tokens:', updateError);
    return createCallbackResponse(false, 'Failed to save tokens');
  }

  console.log('[Bling Auth] Tokens saved successfully for tenant:', tenant_id);

  // Redirect back to the app or show success
  if (redirect_uri) {
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${redirect_uri}?success=true`,
      },
    });
  }

  return createCallbackResponse(true, 'Conexão com Bling realizada com sucesso!');
}

async function handleRefresh(body: any, supabase: any) {
  const { tenant_id } = body;

  if (!tenant_id) {
    return new Response(
      JSON.stringify({ error: 'tenant_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get current config
  const { data: config, error: configError } = await supabase
    .from('bling_integration_config')
    .select('client_id, client_secret, refresh_token')
    .eq('tenant_id', tenant_id)
    .single();

  if (configError || !config) {
    return new Response(
      JSON.stringify({ error: 'Configuration not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!config.refresh_token) {
    return new Response(
      JSON.stringify({ error: 'No refresh token available. Re-authorize required.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const credentials = btoa(`${config.client_id}:${config.client_secret}`);

  console.log('[Bling Auth] Refreshing token for tenant:', tenant_id);

  const tokenResponse = await fetch(BLING_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refresh_token,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    console.error('[Bling Auth] Token refresh failed:', tokenData);
    
    // If refresh fails, mark as inactive
    await supabase
      .from('bling_integration_config')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenant_id);

    return new Response(
      JSON.stringify({ error: 'Token refresh failed. Re-authorization required.', details: tokenData }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const expiresIn = tokenData.expires_in || 21600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  const { error: updateError } = await supabase
    .from('bling_integration_config')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      token_expires_at: expiresAt,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenant_id);

  if (updateError) {
    console.error('[Bling Auth] Failed to save refreshed tokens:', updateError);
    return new Response(
      JSON.stringify({ error: 'Failed to save tokens' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('[Bling Auth] Token refreshed successfully');

  return new Response(
    JSON.stringify({ success: true, expires_at: expiresAt }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function handleRevoke(body: any, supabase: any) {
  const { tenant_id } = body;

  if (!tenant_id) {
    return new Response(
      JSON.stringify({ error: 'tenant_id is required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  console.log('[Bling Auth] Revoking tokens for tenant:', tenant_id);

  const { error } = await supabase
    .from('bling_integration_config')
    .update({
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenant_id);

  if (error) {
    console.error('[Bling Auth] Failed to revoke tokens:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to revoke tokens' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function createCallbackResponse(success: boolean, message: string) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Bling - ${success ? 'Sucesso' : 'Erro'}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: ${success ? '#f0fdf4' : '#fef2f2'};
    }
    .container {
      text-align: center;
      padding: 40px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      max-width: 400px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: ${success ? '#16a34a' : '#dc2626'};
      margin: 0 0 16px 0;
    }
    p {
      color: #6b7280;
      margin: 0 0 24px 0;
    }
    .close-btn {
      background: ${success ? '#16a34a' : '#dc2626'};
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
    }
    .close-btn:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">${success ? '✅' : '❌'}</div>
    <h1>${success ? 'Sucesso!' : 'Erro'}</h1>
    <p>${message}</p>
    <button class="close-btn" onclick="window.close(); window.opener && window.opener.location.reload();">
      Fechar
    </button>
  </div>
  <script>
    // Notify opener window
    if (window.opener) {
      window.opener.postMessage({ type: 'bling-auth-result', success: ${success} }, '*');
    }
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
