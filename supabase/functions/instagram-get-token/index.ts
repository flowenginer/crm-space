import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Aceita tenant_id via query string ou body JSON
    const url = new URL(req.url);
    let tenantId = url.searchParams.get("tenant_id");
    let pageId = url.searchParams.get("page_id");

    if (!tenantId && req.method === "POST") {
      try {
        const body = await req.json();
        tenantId = body.tenant_id || null;
        pageId = body.page_id || null;
      } catch {
        // Sem body JSON, ok
      }
    }

    // Validar API key simples via header (para n8n)
    const apiKey = req.headers.get("x-api-key") || url.searchParams.get("api_key");
    const expectedApiKey = Deno.env.get("INSTAGRAM_API_KEY");

    // Se INSTAGRAM_API_KEY estiver configurada, validar
    if (expectedApiKey && apiKey !== expectedApiKey) {
      // Fallback: aceitar service_role_key como Authorization
      const authHeader = req.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");
      if (token !== supabaseServiceKey) {
        return new Response(
          JSON.stringify({ error: "Não autorizado. Envie x-api-key ou Authorization com service_role_key." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Buscar config ativa
    let query = supabase
      .from("instagram_configs")
      .select("id, tenant_id, page_id, instagram_account_id, page_access_token, token_expires_at, channel_id")
      .eq("is_active", true);

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }
    if (pageId) {
      query = query.eq("page_id", pageId);
    }

    const { data: configs, error: queryError } = await query;

    if (queryError) {
      throw queryError;
    }

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma integração Instagram ativa encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se o token está prestes a expirar e tentar renovar
    const results = [];
    for (const config of configs) {
      let token = config.page_access_token;
      let expiresAt = config.token_expires_at;
      let wasRefreshed = false;

      // Se o token expira em menos de 24h, renovar automaticamente
      if (expiresAt) {
        const expiresDate = new Date(expiresAt);
        const oneDayFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);

        if (expiresDate <= oneDayFromNow) {
          console.log(`[instagram-get-token] Token do tenant ${config.tenant_id} expirando, tentando renovar...`);

          try {
            const refreshRes = await fetch(
              `https://graph.instagram.com/refresh_access_token?` +
              `grant_type=ig_refresh_token` +
              `&access_token=${token}`
            );
            const refreshData = await refreshRes.json();

            if (refreshData.access_token) {
              const newExpiresAt = new Date(
                Date.now() + (refreshData.expires_in || 5184000) * 1000
              ).toISOString();

              await supabase
                .from("instagram_configs")
                .update({
                  page_access_token: refreshData.access_token,
                  token_expires_at: newExpiresAt,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", config.id);

              token = refreshData.access_token;
              expiresAt = newExpiresAt;
              wasRefreshed = true;
              console.log(`[instagram-get-token] Token renovado com sucesso para tenant ${config.tenant_id}`);
            } else {
              console.warn(`[instagram-get-token] Falha ao renovar token:`, refreshData.error);
            }
          } catch (refreshErr) {
            console.warn(`[instagram-get-token] Erro ao renovar token:`, refreshErr);
          }
        }
      }

      results.push({
        tenant_id: config.tenant_id,
        page_id: config.page_id,
        instagram_account_id: config.instagram_account_id,
        channel_id: config.channel_id,
        access_token: token,
        token_expires_at: expiresAt,
        was_refreshed: wasRefreshed,
      });
    }

    // Se buscou por tenant_id ou page_id específico, retornar só o primeiro
    if (tenantId || pageId) {
      return new Response(
        JSON.stringify(results[0]),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ configs: results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[instagram-get-token] Erro: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
