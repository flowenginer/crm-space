import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BLING_AUTH_URL = "https://www.bling.com.br/Api/v3/oauth/authorize";
const BLING_TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Action: authorize - Start OAuth flow
    if (action === "authorize") {
      const tenantId = url.searchParams.get("tenant_id");
      const redirectUri = url.searchParams.get("redirect_uri");
      const clientId = url.searchParams.get("client_id");

      if (!tenantId || !redirectUri || !clientId) {
        return new Response(
          JSON.stringify({ error: "Missing required parameters: tenant_id, redirect_uri, client_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Store state for validation on callback
      const state = btoa(JSON.stringify({ tenant_id: tenantId, redirect_uri: redirectUri }));

      // Build Bling authorization URL
      const authUrl = new URL(BLING_AUTH_URL);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("state", state);

      console.log(`[bling-oauth] Starting OAuth for tenant ${tenantId}`);

      return new Response(
        JSON.stringify({ auth_url: authUrl.toString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: callback - Handle OAuth callback
    if (action === "callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        console.error(`[bling-oauth] OAuth error: ${error}`);
        return new Response(
          JSON.stringify({ error: `OAuth error: ${error}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!code || !state) {
        return new Response(
          JSON.stringify({ error: "Missing code or state parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Parse state
      let stateData: { tenant_id: string; redirect_uri: string };
      try {
        stateData = JSON.parse(atob(state));
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid state parameter" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get stored credentials for tenant
      const { data: config, error: configError } = await supabase
        .from("bling_integration_config")
        .select("client_id, client_secret")
        .eq("tenant_id", stateData.tenant_id)
        .single();

      if (configError || !config?.client_id || !config?.client_secret) {
        console.error(`[bling-oauth] Config not found for tenant ${stateData.tenant_id}`);
        return new Response(
          JSON.stringify({ error: "Integration config not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Exchange code for tokens
      const tokenResponse = await fetch(BLING_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`${config.client_id}:${config.client_secret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(`[bling-oauth] Token exchange failed: ${errorText}`);
        return new Response(
          JSON.stringify({ error: "Failed to exchange code for tokens" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokens: TokenResponse = await tokenResponse.json();

      // Calculate expiration time
      const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Update config with tokens
      const { error: updateError } = await supabase
        .from("bling_integration_config")
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokenExpiresAt,
          is_active: true,
          is_configured: true,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", stateData.tenant_id);

      if (updateError) {
        console.error(`[bling-oauth] Failed to save tokens: ${updateError.message}`);
        return new Response(
          JSON.stringify({ error: "Failed to save tokens" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[bling-oauth] Successfully connected tenant ${stateData.tenant_id}`);

      // Redirect back to app
      return Response.redirect(`${stateData.redirect_uri}?success=true`, 302);
    }

    // Action: refresh - Refresh access token
    if (action === "refresh") {
      const body = await req.json();
      const { tenant_id } = body;

      if (!tenant_id) {
        return new Response(
          JSON.stringify({ error: "Missing tenant_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get config with refresh token
      const { data: config, error: configError } = await supabase
        .from("bling_integration_config")
        .select("client_id, client_secret, refresh_token")
        .eq("tenant_id", tenant_id)
        .single();

      if (configError || !config?.refresh_token) {
        return new Response(
          JSON.stringify({ error: "No refresh token found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Refresh tokens
      const tokenResponse = await fetch(BLING_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${btoa(`${config.client_id}:${config.client_secret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: config.refresh_token,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error(`[bling-oauth] Token refresh failed: ${errorText}`);
        
        // Mark as disconnected if refresh fails
        await supabase
          .from("bling_integration_config")
          .update({
            is_active: false,
            access_token: null,
            refresh_token: null,
            token_expires_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", tenant_id);

        return new Response(
          JSON.stringify({ error: "Token refresh failed - please reconnect" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokens: TokenResponse = await tokenResponse.json();
      const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Update tokens
      await supabase
        .from("bling_integration_config")
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokenExpiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenant_id);

      console.log(`[bling-oauth] Successfully refreshed tokens for tenant ${tenant_id}`);

      return new Response(
        JSON.stringify({ success: true, expires_at: tokenExpiresAt }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: disconnect - Disconnect integration
    if (action === "disconnect") {
      const body = await req.json();
      const { tenant_id } = body;

      if (!tenant_id) {
        return new Response(
          JSON.stringify({ error: "Missing tenant_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Clear tokens and set inactive
      const { error: updateError } = await supabase
        .from("bling_integration_config")
        .update({
          access_token: null,
          refresh_token: null,
          token_expires_at: null,
          is_active: false,
          is_configured: false,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenant_id);

      if (updateError) {
        return new Response(
          JSON.stringify({ error: "Failed to disconnect" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[bling-oauth] Disconnected tenant ${tenant_id}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Action: status - Check connection status
    if (action === "status") {
      const tenantId = url.searchParams.get("tenant_id");

      if (!tenantId) {
        return new Response(
          JSON.stringify({ error: "Missing tenant_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: config } = await supabase
        .from("bling_integration_config")
        .select("is_active, is_configured, token_expires_at, last_sync_at")
        .eq("tenant_id", tenantId)
        .single();

      const isExpired = config?.token_expires_at 
        ? new Date(config.token_expires_at) < new Date() 
        : true;

      return new Response(
        JSON.stringify({
          is_connected: config?.is_active && config?.is_configured && !isExpired,
          is_configured: config?.is_configured || false,
          token_expires_at: config?.token_expires_at,
          last_sync_at: config?.last_sync_at,
          needs_refresh: isExpired && config?.is_configured,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: authorize, callback, refresh, disconnect, status" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[bling-oauth] Error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
