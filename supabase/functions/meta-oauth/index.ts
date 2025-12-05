import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_APP_ID = Deno.env.get('META_APP_ID');
const META_APP_SECRET = Deno.env.get('META_APP_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    if (action === 'get-login-url') {
      // Generate Facebook OAuth URL
      const redirectUri = `${SUPABASE_URL}/functions/v1/meta-oauth?action=callback`;
      const state = crypto.randomUUID();
      
      // Store state temporarily for verification
      if (userId) {
        await supabase.from('meta_ad_accounts').upsert({
          user_id: userId,
          account_id: `pending_${state}`,
          access_token: state,
          account_name: 'Pending Connection'
        }, { onConflict: 'account_id' });
      }
      
      const loginUrl = `https://www.facebook.com/v21.0/dialog/oauth?` +
        `client_id=${META_APP_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&state=${state}` +
        `&scope=ads_read,ads_management,business_management`;
      
      return new Response(JSON.stringify({ loginUrl, state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'callback') {
      // Handle OAuth callback
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      
      if (error) {
        console.error('[Meta OAuth] Error:', error);
        return new Response(`
          <html>
            <body>
              <script>
                window.opener.postMessage({ type: 'META_OAUTH_ERROR', error: '${error}' }, '*');
                window.close();
              </script>
            </body>
          </html>
        `, { headers: { 'Content-Type': 'text/html' } });
      }

      if (!code) {
        return new Response('Missing code', { status: 400, headers: corsHeaders });
      }

      // Exchange code for access token
      const redirectUri = `${SUPABASE_URL}/functions/v1/meta-oauth?action=callback`;
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `client_id=${META_APP_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&client_secret=${META_APP_SECRET}` +
        `&code=${code}`
      );

      const tokenData = await tokenResponse.json();
      console.log('[Meta OAuth] Token exchange response:', tokenResponse.status);

      if (!tokenData.access_token) {
        console.error('[Meta OAuth] No access token:', tokenData);
        return new Response(`
          <html>
            <body>
              <script>
                window.opener.postMessage({ type: 'META_OAUTH_ERROR', error: 'Failed to get access token' }, '*');
                window.close();
              </script>
            </body>
          </html>
        `, { headers: { 'Content-Type': 'text/html' } });
      }

      // Get long-lived token
      const longLivedResponse = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `grant_type=fb_exchange_token` +
        `&client_id=${META_APP_ID}` +
        `&client_secret=${META_APP_SECRET}` +
        `&fb_exchange_token=${tokenData.access_token}`
      );
      const longLivedData = await longLivedResponse.json();
      const accessToken = longLivedData.access_token || tokenData.access_token;
      const expiresIn = longLivedData.expires_in || tokenData.expires_in || 5184000; // 60 days default

      // Get ad accounts
      const adAccountsResponse = await fetch(
        `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,account_id,currency,timezone_name,business&access_token=${accessToken}`
      );
      const adAccountsData = await adAccountsResponse.json();
      console.log('[Meta OAuth] Ad accounts:', adAccountsData);

      // Return HTML that posts message to opener
      return new Response(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ 
                type: 'META_OAUTH_SUCCESS', 
                accessToken: '${accessToken}',
                expiresIn: ${expiresIn},
                adAccounts: ${JSON.stringify(adAccountsData.data || [])},
                state: '${state}'
              }, '*');
              window.close();
            </script>
          </body>
        </html>
      `, { headers: { 'Content-Type': 'text/html' } });
    }

    if (action === 'save-account') {
      // Save selected ad account
      const body = await req.json();
      const { accountId, accountName, accessToken, expiresIn, businessId, currency, timezone } = body;

      if (!userId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tokenExpiresAt = new Date(Date.now() + (expiresIn || 5184000) * 1000).toISOString();

      // Delete any pending connections for this user
      await supabase.from('meta_ad_accounts')
        .delete()
        .eq('user_id', userId)
        .like('account_id', 'pending_%');

      // Upsert the account
      const { data, error } = await supabase.from('meta_ad_accounts').upsert({
        user_id: userId,
        account_id: accountId,
        account_name: accountName,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        business_id: businessId,
        currency: currency || 'BRL',
        timezone: timezone || 'America/Sao_Paulo',
        is_active: true
      }, { onConflict: 'account_id' }).select().single();

      if (error) {
        console.error('[Meta OAuth] Save error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, account: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'refresh-token') {
      // Refresh an expiring token
      const body = await req.json();
      const { accountId } = body;

      const { data: account } = await supabase
        .from('meta_ad_accounts')
        .select('*')
        .eq('account_id', accountId)
        .single();

      if (!account) {
        return new Response(JSON.stringify({ error: 'Account not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Exchange for new long-lived token
      const refreshResponse = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `grant_type=fb_exchange_token` +
        `&client_id=${META_APP_ID}` +
        `&client_secret=${META_APP_SECRET}` +
        `&fb_exchange_token=${account.access_token}`
      );
      const refreshData = await refreshResponse.json();

      if (!refreshData.access_token) {
        return new Response(JSON.stringify({ error: 'Failed to refresh token' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tokenExpiresAt = new Date(Date.now() + (refreshData.expires_in || 5184000) * 1000).toISOString();

      await supabase.from('meta_ad_accounts').update({
        access_token: refreshData.access_token,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString()
      }).eq('account_id', accountId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[Meta OAuth] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
