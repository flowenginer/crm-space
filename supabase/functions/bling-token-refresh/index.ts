import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BLING_TOKEN_URL = "https://www.bling.com.br/Api/v3/oauth/token";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[bling-token-refresh] Iniciando refresh automático de tokens...");

    // Buscar TODAS as configurações ativas que têm refresh_token
    const { data: configs, error: configError } = await supabase
      .from("bling_integration_config")
      .select("id, tenant_id, client_id, client_secret, refresh_token, token_expires_at")
      .eq("is_active", true)
      .not("refresh_token", "is", null);

    if (configError) {
      console.error("[bling-token-refresh] Erro ao buscar configs:", configError);
      throw configError;
    }

    if (!configs || configs.length === 0) {
      console.log("[bling-token-refresh] Nenhuma integração ativa encontrada");
      return new Response(
        JSON.stringify({ message: "Nenhuma integração ativa", refreshed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[bling-token-refresh] Encontradas ${configs.length} integrações para refresh`);

    let successCount = 0;
    let failCount = 0;
    const results: Array<{ tenant_id: string; status: string; expires_at?: string; error?: string }> = [];

    for (const config of configs) {
      try {
        console.log(`[bling-token-refresh] Processando tenant ${config.tenant_id}...`);

        // Fazer refresh do token
        const tokenResponse = await fetch(BLING_TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${btoa(`${config.client_id}:${config.client_secret}`)}`,
          },
          body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: config.refresh_token!,
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error(`[bling-token-refresh] Falha no refresh para tenant ${config.tenant_id}: ${errorText}`);
          
          // Marcar como inativo se o refresh falhar
          await supabase
            .from("bling_integration_config")
            .update({
              is_active: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", config.id);

          failCount++;
          results.push({ tenant_id: config.tenant_id, status: "failed", error: errorText });
          continue;
        }

        const tokens = await tokenResponse.json();
        const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        // Atualizar tokens no banco
        const { error: updateError } = await supabase
          .from("bling_integration_config")
          .update({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expires_at: tokenExpiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);

        if (updateError) {
          console.error(`[bling-token-refresh] Erro ao salvar tokens: ${updateError.message}`);
          failCount++;
          results.push({ tenant_id: config.tenant_id, status: "failed", error: updateError.message });
        } else {
          console.log(`[bling-token-refresh] ✅ Token atualizado para tenant ${config.tenant_id}, expira em: ${tokenExpiresAt}`);
          successCount++;
          results.push({ tenant_id: config.tenant_id, status: "success", expires_at: tokenExpiresAt });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[bling-token-refresh] Erro inesperado para tenant ${config.tenant_id}: ${errorMsg}`);
        failCount++;
        results.push({ tenant_id: config.tenant_id, status: "error", error: errorMsg });
      }
    }

    console.log(`[bling-token-refresh] Concluído: ${successCount} sucesso, ${failCount} falhas`);

    return new Response(
      JSON.stringify({
        message: "Refresh concluído",
        success: successCount,
        failed: failCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[bling-token-refresh] Erro fatal: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
