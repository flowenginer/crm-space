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
    let tenantId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
      
      // Get tenant_id from profile
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', userId)
          .single();
        tenantId = profile?.tenant_id || null;
      }
    }

    if (action === 'get-login-url') {
      // Generate Facebook OAuth URL with cache-busting timestamp
      const timestamp = Date.now();
      const redirectUri = `${SUPABASE_URL}/functions/v1/meta-oauth?action=callback&t=${timestamp}`;
      const state = crypto.randomUUID();
      
      console.log('[Meta OAuth] Generated login URL with timestamp:', timestamp);
      
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
        const errorHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Erro na Conexão</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 20px;
                }
                .container {
                  background: white;
                  border-radius: 16px;
                  padding: 40px;
                  max-width: 400px;
                  text-align: center;
                  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                .icon { font-size: 48px; margin-bottom: 20px; }
                h1 { color: #dc2626; font-size: 24px; margin-bottom: 12px; }
                p { color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
                .btn {
                  background: #3b82f6;
                  color: white;
                  border: none;
                  padding: 12px 24px;
                  border-radius: 8px;
                  font-size: 14px;
                  cursor: pointer;
                  transition: background 0.2s;
                }
                .btn:hover { background: #2563eb; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="icon">❌</div>
                <h1>Erro na Autenticação</h1>
                <p>${error}</p>
                <button class="btn" onclick="window.close()">Fechar</button>
              </div>
              <script>
                const errorData = { type: 'META_OAUTH_ERROR', error: '${error}' };
                
                // Try postMessage first
                if (window.opener) {
                  window.opener.postMessage(errorData, '*');
                  setTimeout(() => window.close(), 1000);
                } else {
                  // Fallback to localStorage
                  localStorage.setItem('meta_oauth_result', JSON.stringify(errorData));
                }
              </script>
            </body>
          </html>
        `;
        return new Response(errorHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }

      if (!code) {
        return new Response('Missing code', { status: 400, headers: corsHeaders });
      }

      // Exchange code for access token - must match the redirect URI used in get-login-url
      const callbackTimestamp = url.searchParams.get('t') || '';
      const redirectUri = callbackTimestamp 
        ? `${SUPABASE_URL}/functions/v1/meta-oauth?action=callback&t=${callbackTimestamp}`
        : `${SUPABASE_URL}/functions/v1/meta-oauth?action=callback`;
      
      console.log('[Meta OAuth] Token exchange with redirectUri:', redirectUri);
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
        const tokenErrorHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <title>Erro</title>
              <style>
                body { 
                  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  min-height: 100vh; display: flex; align-items: center; justify-content: center;
                }
                .container { background: white; border-radius: 16px; padding: 40px; text-align: center; }
                .icon { font-size: 48px; margin-bottom: 20px; }
                h1 { color: #dc2626; margin-bottom: 12px; }
                .btn { background: #3b82f6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="icon">❌</div>
                <h1>Erro ao obter token</h1>
                <p>Não foi possível obter o token de acesso.</p>
                <button class="btn" onclick="window.close()">Fechar</button>
              </div>
              <script>
                const errorData = { type: 'META_OAUTH_ERROR', error: 'Failed to get access token' };
                if (window.opener) {
                  window.opener.postMessage(errorData, '*');
                  setTimeout(() => window.close(), 1000);
                } else {
                  localStorage.setItem('meta_oauth_result', JSON.stringify(errorData));
                }
              </script>
            </body>
          </html>
        `;
        return new Response(tokenErrorHtml, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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

      // Return HTML that posts message to opener with localStorage fallback
      const successData = {
        type: 'META_OAUTH_SUCCESS',
        accessToken: accessToken,
        expiresIn: expiresIn,
        adAccounts: adAccountsData.data || [],
        state: state
      };
      
      // Escape JSON for safe embedding in HTML script
      const jsonString = JSON.stringify(successData)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/'/g, '\\u0027');
      
      const accountCount = (adAccountsData.data || []).length;
      
      const successHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Conexão Realizada</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { 
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.container {
  background: white;
  border-radius: 16px;
  padding: 40px;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.icon { font-size: 64px; margin-bottom: 20px; }
h1 { color: #16a34a; font-size: 24px; margin-bottom: 12px; }
p { color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
.status { 
  background: #f0fdf4; 
  border: 1px solid #bbf7d0; 
  border-radius: 8px; 
  padding: 12px; 
  margin-bottom: 20px;
  color: #166534;
  font-size: 13px;
}
.btn {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}
.btn:hover { background: #2563eb; }
.accounts { 
  text-align: left; 
  font-size: 12px; 
  color: #666; 
  margin-top: 16px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
}
.accounts strong { color: #333; }
</style>
</head>
<body>
<div class="container">
  <div class="icon">✅</div>
  <h1>Conexão Realizada!</h1>
  <div id="status" class="status">Processando...</div>
  <p id="message">Aguarde enquanto processamos sua conexão.</p>
  <button class="btn" id="closeBtn" style="display: none;" onclick="window.close()">Fechar esta janela</button>
  <div class="accounts">
    <strong>Contas encontradas:</strong> ${accountCount}
  </div>
</div>
<script>
(function() {
  var oauthData = ${jsonString};
  var statusEl = document.getElementById('status');
  var messageEl = document.getElementById('message');
  var closeBtn = document.getElementById('closeBtn');
  
  function showSuccess(method) {
    statusEl.textContent = 'Dados enviados com sucesso!';
    messageEl.textContent = method === 'postMessage' 
      ? 'Esta janela será fechada automaticamente...'
      : 'Volte para a aba do CRM para selecionar sua conta.';
    closeBtn.style.display = 'inline-block';
  }
  
  // Always save to localStorage first as fallback
  try {
    localStorage.setItem('meta_oauth_result', JSON.stringify(oauthData));
  } catch(e) {
    console.error('localStorage error:', e);
  }
  
  // Try postMessage to opener
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(oauthData, '*');
      showSuccess('postMessage');
      setTimeout(function() {
        try { window.close(); } catch(e) {}
      }, 1500);
    } catch(e) {
      showSuccess('localStorage');
    }
  } else {
    showSuccess('localStorage');
  }
})();
</script>
</body>
</html>`;
      
      // Force fresh response with explicit anti-cache headers
      console.log('[Meta OAuth] Returning HTML response, size:', successHtml.length, 'bytes');
      
      const htmlHeaders = new Headers({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Vary': '*',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN'
      });
      
      return new Response(successHtml, { 
        status: 200,
        headers: htmlHeaders
      });
    }

    if (action === 'manual-connect') {
      // Manual connection with access token and account ID
      const body = await req.json();
      const { accessToken, accountId } = body;

      if (!userId) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (!accessToken || !accountId) {
        return new Response(JSON.stringify({ error: 'Access Token e Account ID são obrigatórios' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('[Meta OAuth] Manual connect attempt for account:', accountId);

      // Validate the access token by calling /me
      const meResponse = await fetch(
        `https://graph.facebook.com/v21.0/me?access_token=${accessToken}`
      );
      const meData = await meResponse.json();

      if (meData.error) {
        console.error('[Meta OAuth] Token validation failed:', meData.error);
        return new Response(JSON.stringify({ 
          error: `Token inválido: ${meData.error.message}` 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('[Meta OAuth] Token validated for user:', meData.name);

      // Fetch ad account details
      const accountResponse = await fetch(
        `https://graph.facebook.com/v21.0/${accountId}?fields=id,name,account_id,currency,timezone_name,business&access_token=${accessToken}`
      );
      const accountData = await accountResponse.json();

      if (accountData.error) {
        console.error('[Meta OAuth] Account fetch failed:', accountData.error);
        return new Response(JSON.stringify({ 
          error: `Conta não encontrada ou sem permissão: ${accountData.error.message}` 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('[Meta OAuth] Account details:', accountData);

      // Try to get a long-lived token (60 days)
      let finalToken = accessToken;
      let expiresIn = 5184000; // Default 60 days

      if (META_APP_ID && META_APP_SECRET) {
        try {
          const longLivedResponse = await fetch(
            `https://graph.facebook.com/v21.0/oauth/access_token?` +
            `grant_type=fb_exchange_token` +
            `&client_id=${META_APP_ID}` +
            `&client_secret=${META_APP_SECRET}` +
            `&fb_exchange_token=${accessToken}`
          );
          const longLivedData = await longLivedResponse.json();
          
          if (longLivedData.access_token) {
            finalToken = longLivedData.access_token;
            expiresIn = longLivedData.expires_in || 5184000;
            console.log('[Meta OAuth] Got long-lived token, expires in:', expiresIn);
          }
        } catch (e) {
          console.log('[Meta OAuth] Could not get long-lived token, using original');
        }
      }

      const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // Delete any pending connections for this user
      await supabase.from('meta_ad_accounts')
        .delete()
        .eq('user_id', userId)
        .like('account_id', 'pending_%');

      // Upsert the account with tenant_id
      const upsertData: Record<string, unknown> = {
        user_id: userId,
        account_id: accountData.id || accountId,
        account_name: accountData.name || `Conta ${accountId}`,
        access_token: finalToken,
        token_expires_at: tokenExpiresAt,
        business_id: accountData.business?.id,
        currency: accountData.currency || 'BRL',
        timezone: accountData.timezone_name || 'America/Sao_Paulo',
        is_active: true
      };
      
      if (tenantId) {
        upsertData.tenant_id = tenantId;
      }

      const { data, error } = await supabase.from('meta_ad_accounts').upsert(
        upsertData,
        { onConflict: 'account_id' }
      ).select().single();

      if (error) {
        console.error('[Meta OAuth] Save error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('[Meta OAuth] Account saved successfully:', data.id);

      return new Response(JSON.stringify({ success: true, account: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'save-account') {
      // Save selected ad account (legacy OAuth flow)
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

      // Upsert the account with tenant_id
      const upsertData: Record<string, unknown> = {
        user_id: userId,
        account_id: accountId,
        account_name: accountName,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        business_id: businessId,
        currency: currency || 'BRL',
        timezone: timezone || 'America/Sao_Paulo',
        is_active: true
      };
      
      if (tenantId) {
        upsertData.tenant_id = tenantId;
      }

      const { data, error } = await supabase.from('meta_ad_accounts').upsert(
        upsertData,
        { onConflict: 'account_id' }
      ).select().single();

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
