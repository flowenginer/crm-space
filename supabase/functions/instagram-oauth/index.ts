import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// These are the Instagram App credentials (from the Instagram API section, NOT the Facebook App ID)
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

      // Use Instagram Login OAuth (NOT Facebook Login)
      // Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
      const scopes = 'instagram_business_basic,instagram_business_manage_messages';
      const loginUrl = `https://www.instagram.com/oauth/authorize?` +
        `enable_fb_login=0` +
        `&force_authentication=1` +
        `&client_id=${META_APP_ID}` +
        `&redirect_uri=${encodeURIComponent(frontendCallbackUrl)}` +
        `&state=${state}` +
        `&scope=${scopes}` +
        `&response_type=code`;

      console.log('[Instagram OAuth] Login URL generated with Instagram Login flow');

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

      // Step 1: Exchange code for short-lived token via Instagram API
      console.log('[Instagram OAuth] Exchanging code for short-lived token via Instagram API...');
      const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: META_APP_ID!,
          client_secret: META_APP_SECRET!,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
          code,
        }).toString(),
      });
      const tokenData = await tokenRes.json();

      if (!tokenData.access_token) {
        console.error('[Instagram OAuth] Short-lived token error:', tokenData);
        return new Response(JSON.stringify({ error: tokenData.error_message || tokenData.error?.message || 'Erro ao obter token' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('[Instagram OAuth] Short-lived token obtained, user_id:', tokenData.user_id);

      // Step 2: Exchange short-lived token for long-lived token
      console.log('[Instagram OAuth] Exchanging for long-lived token...');
      const longLivedRes = await fetch(
        `https://graph.instagram.com/access_token?` +
        `grant_type=ig_exchange_token` +
        `&client_secret=${META_APP_SECRET}` +
        `&access_token=${tokenData.access_token}`
      );
      const longLivedData = await longLivedRes.json();
      const accessToken = longLivedData.access_token || tokenData.access_token;

      console.log('[Instagram OAuth] Long-lived token obtained, expires_in:', longLivedData.expires_in);

      // Step 3: Get Instagram user info
      console.log('[Instagram OAuth] Fetching user info...');
      const userRes = await fetch(
        `https://graph.instagram.com/v21.0/me?fields=user_id,username,name,profile_picture_url,account_type&access_token=${accessToken}`
      );
      const userData = await userRes.json();

      console.log('[Instagram OAuth] User info:', JSON.stringify(userData));

      if (userData.error) {
        console.error('[Instagram OAuth] User info error:', userData.error);
        return new Response(JSON.stringify({ error: userData.error.message || 'Erro ao buscar dados do Instagram' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const accounts = [{
        page_id: userData.user_id || userData.id,
        page_name: userData.name || userData.username,
        page_access_token: accessToken,
        instagram_account_id: userData.user_id || userData.id,
        instagram_username: userData.username || 'N/A',
        instagram_name: userData.name || userData.username || 'Instagram',
        profile_picture_url: userData.profile_picture_url || null,
      }];

      console.log('[Instagram OAuth] Account ready:', accounts[0].instagram_username);

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

      if (!page_access_token || !instagram_account_id || !tenantId) {
        return new Response(JSON.stringify({ error: 'Dados incompletos' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('[Instagram OAuth] Saving account', instagram_username);

      // Check if an Instagram channel already exists for this tenant
      let channelId: string;
      const { data: existingConfig } = await supabase
        .from('instagram_configs')
        .select('channel_id')
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (existingConfig?.channel_id) {
        // Update existing channel
        const { error: updateError } = await supabase
          .from('whatsapp_channels')
          .update({
            name: `Instagram - @${instagram_username}`,
            phone: `@${instagram_username}`,
            status: 'connected',
          })
          .eq('id', existingConfig.channel_id);

        if (updateError) {
          console.error('[Instagram OAuth] Channel update error:', updateError);
        }
        channelId = existingConfig.channel_id;
        console.log('[Instagram OAuth] Reusing existing channel:', channelId);
      } else {
        // Create new channel
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
        channelId = channel.id;
        console.log('[Instagram OAuth] Created new channel:', channelId);
      }

      // Create/update instagram_configs
      const { error: configError } = await supabase
        .from('instagram_configs')
        .upsert({
          tenant_id: tenantId,
          page_id: page_id || instagram_account_id,
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
