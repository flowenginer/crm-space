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

    console.log("[instagram-token-refresh] Iniciando refresh automático de tokens...");

    // Buscar todas as configs ativas do Instagram
    const { data: configs, error: configError } = await supabase
      .from("instagram_configs")
      .select("id, tenant_id, page_id, page_access_token, token_expires_at")
      .eq("is_active", true)
      .not("page_access_token", "is", null);

    if (configError) {
      console.error("[instagram-token-refresh] Erro ao buscar configs:", configError);
      throw configError;
    }

    if (!configs || configs.length === 0) {
      console.log("[instagram-token-refresh] Nenhuma integração Instagram ativa encontrada");
      return new Response(
        JSON.stringify({ message: "Nenhuma integração ativa", refreshed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[instagram-token-refresh] Encontradas ${configs.length} integrações para verificar`);

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;
    const results: Array<{ tenant_id: string; status: string; expires_at?: string; error?: string }> = [];

    for (const config of configs) {
      try {
        // Só renovar tokens que expiram nos próximos 7 dias ou sem data de expiração
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        if (config.token_expires_at) {
          const expiresAt = new Date(config.token_expires_at);
          if (expiresAt > sevenDaysFromNow) {
            console.log(`[instagram-token-refresh] Token do tenant ${config.tenant_id} ainda válido até ${config.token_expires_at}, pulando`);
            skippedCount++;
            results.push({ tenant_id: config.tenant_id, status: "skipped", expires_at: config.token_expires_at });
            continue;
          }
        }

        console.log(`[instagram-token-refresh] Renovando token do tenant ${config.tenant_id}...`);

        // Renovar token de longa duração via Instagram Graph API
        // Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login#refresh-tokens
        const refreshRes = await fetch(
          `https://graph.instagram.com/refresh_access_token?` +
          `grant_type=ig_refresh_token` +
          `&access_token=${config.page_access_token}`
        );

        const refreshData = await refreshRes.json();

        if (refreshData.error || !refreshData.access_token) {
          console.error(`[instagram-token-refresh] Falha no refresh para tenant ${config.tenant_id}:`, refreshData.error || refreshData);
          failCount++;
          results.push({
            tenant_id: config.tenant_id,
            status: "failed",
            error: refreshData.error?.message || "Token inválido ou expirado - necessário re-autenticar",
          });
          continue;
        }

        // Calcular nova data de expiração (geralmente 60 dias)
        const expiresInSeconds = refreshData.expires_in || 5184000; // 60 dias padrão
        const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

        // Atualizar token no banco
        const { error: updateError } = await supabase
          .from("instagram_configs")
          .update({
            page_access_token: refreshData.access_token,
            token_expires_at: tokenExpiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);

        if (updateError) {
          console.error(`[instagram-token-refresh] Erro ao salvar token: ${updateError.message}`);
          failCount++;
          results.push({ tenant_id: config.tenant_id, status: "failed", error: updateError.message });
        } else {
          console.log(`[instagram-token-refresh] Token atualizado para tenant ${config.tenant_id}, expira em: ${tokenExpiresAt}`);
          successCount++;
          results.push({ tenant_id: config.tenant_id, status: "success", expires_at: tokenExpiresAt });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[instagram-token-refresh] Erro inesperado para tenant ${config.tenant_id}: ${errorMsg}`);
        failCount++;
        results.push({ tenant_id: config.tenant_id, status: "error", error: errorMsg });
      }
    }

    console.log(`[instagram-token-refresh] Concluído: ${successCount} sucesso, ${failCount} falhas, ${skippedCount} pulados`);

    return new Response(
      JSON.stringify({
        message: "Refresh concluído",
        success: successCount,
        failed: failCount,
        skipped: skippedCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[instagram-token-refresh] Erro fatal: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
