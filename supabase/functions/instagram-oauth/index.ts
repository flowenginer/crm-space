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

      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', userId)
          .single();
        tenantId = profile?.tenant_id || null;
      }
    }

    // ============ GET LOGIN URL ============
    if (action === 'get-login-url') {
      if (!userId || !tenantId) {
        return new Response(JSON.stringify({ error: 'Não autenticado' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const origin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/[^/]*$/, '') || '';
      const frontendCallbackUrl = `${origin}/instagram-oauth-callback`;
      const state = crypto.randomUUID();

      // Store state for verification
      await supabase.from('meta_oauth_states').upsert({
        state,
        user_id: userId,
        tenant_id: tenantId,
        redirect_origin: origin,
      }, { onConflict: 'state' });

      const scopes = 'instagram_business_basic,instagram_business_manage_messages';
      const loginUrl = `https://www.facebook.com/v21.0/dialog/oauth?` +
        `client_id=${META_APP_ID}` +
        `&redirect_uri=${encodeURIComponent(frontendCallbackUrl)}` +
        `&state=${state}` +
        `&scope=${scopes}` +
        `&response_type=code`;

      console.log('[Instagram OAuth] Login URL generated');

      return new Response(JSON.stringify({ loginUrl, state }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ EXCHANGE CODE ============
    if (action === 'exchange-code') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      if (!code || !state) {
        return new Response(JSON.stringify({ error: 'Código e state são obrigatórios' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Validate state
      const { data: stateData, error: stateError } = await supabase
        .from('meta_oauth_states')
        .select('redirect_origin, user_id, tenant_id')
        .eq('state', state)
        .single();

      if (stateError || !stateData) {
        return new Response(JSON.stringify({ error: 'State inválido ou expirado' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Delete used state
      await supabase.from('meta_oauth_states').delete().eq('state', state);

      const redirectUri = stateData.redirect_origin
        ? `${stateData.redirect_origin}/instagram-oauth-callback`
        : '';

      // Exchange code for short-lived token
      console.log('[Instagram OAuth] Exchanging code for token...');
      const tokenRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `client_id=${META_APP_ID}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&client_secret=${META_APP_SECRET}` +
        `&code=${code}`
      );
      const tokenData = await tokenRes.json();

      if (!tokenData.access_token) {
        console.error('[Instagram OAuth] Token error:', tokenData);
        return new Response(JSON.stringify({ error: tokenData.error?.message || 'Erro ao obter token' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Exchange for long-lived user token
      const longLivedRes = await fetch(
        `https://graph.facebook.com/v21.0/oauth/access_token?` +
        `grant_type=fb_exchange_token` +
        `&client_id=${META_APP_ID}` +
        `&client_secret=${META_APP_SECRET}` +
        `&fb_exchange_token=${tokenData.access_token}`
      );
      const longLivedData = await longLivedRes.json();
      const userAccessToken = longLivedData.access_token || tokenData.access_token;

      // Fetch Pages with their Instagram Business Accounts
      console.log('[Instagram OAuth] Fetching pages...');
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${userAccessToken}`
      );
      const pagesData = await pagesRes.json();
      const pages = pagesData.data || [];

      console.log('[Instagram OAuth] Pages found:', pages.length);

      // For each page with instagram_business_account, fetch IG details
      const accounts: any[] = [];
      for (const page of pages) {
        if (page.instagram_business_account?.id) {
          try {
            const igRes = await fetch(
              `https://graph.facebook.com/v21.0/${page.instagram_business_account.id}?fields=id,username,name,profile_picture_url&access_token=${page.access_token}`
            );
            const igData = await igRes.json();

            accounts.push({
              page_id: page.id,
              page_name: page.name,
              page_access_token: page.access_token,
              instagram_account_id: igData.id,
              instagram_username: igData.username || igData.name || 'N/A',
              instagram_name: igData.name || igData.username || page.name,
              profile_picture_url: igData.profile_picture_url || null,
            });
          } catch (e) {
            console.warn('[Instagram OAuth] Error fetching IG for page', page.id, e);
          }
        }
      }

      console.log('[Instagram OAuth] Instagram accounts found:', accounts.length);

      return new Response(JSON.stringify({
        accounts,
        userId: stateData.user_id,
        tenantId: stateData.tenant_id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============ SAVE ACCOUNT ============
    if (action === 'save-account') {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Não autenticado' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const body = await req.json();
      const {
        page_id,
        page_name,
        page_access_token,
        instagram_account_id,
        instagram_username,
        instagram_name,
        profile_picture_url,
      } = body;

      if (!page_id || !page_access_token || !instagram_account_id || !tenantId) {
        return new Response(JSON.stringify({ error: 'Dados incompletos' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get long-lived page access token (page tokens from long-lived user tokens never expire)
      // The page_access_token from /me/accounts with a long-lived user token is already long-lived
      console.log('[Instagram OAuth] Saving account', instagram_username);

      // Create whatsapp_channels entry with type 'instagram'
      const { data: channel, error: channelError } = await supabase
        .from('whatsapp_channels')
        .insert({
          name: `Instagram - @${instagram_username}`,
          phone: `@${instagram_username}`,
          status: 'connected',
          type: 'official',
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (channelError) {
        console.error('[Instagram OAuth] Channel insert error:', channelError);
        return new Response(JSON.stringify({ error: 'Erro ao criar canal: ' + channelError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Create/update instagram_configs
      const { error: configError } = await supabase
        .from('instagram_configs')
        .upsert({
          tenant_id: tenantId,
          page_id,
          page_access_token,
          instagram_account_id,
          channel_id: channel.id,
          is_active: true,
          webhook_configured: true,
          verify_token: `ig_verify_${crypto.randomUUID().slice(0, 8)}`,
        }, { onConflict: 'tenant_id' });

      if (configError) {
        console.error('[Instagram OAuth] Config insert error:', configError);
        // Clean up channel
        await supabase.from('whatsapp_channels').delete().eq('id', channel.id);
        return new Response(JSON.stringify({ error: 'Erro ao salvar configuração: ' + configError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('[Instagram OAuth] Account saved successfully:', channel.id);

      return new Response(JSON.stringify({
        success: true,
        channel_id: channel.id,
        instagram_username,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Ação não reconhecida' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[Instagram OAuth] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
