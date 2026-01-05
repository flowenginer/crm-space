import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get authenticated user and their tenant
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.error("[EnableCalling] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's tenant_id from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      console.error("[EnableCalling] Profile error:", profileError);
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = profile.tenant_id;
    console.log(`[EnableCalling] User ${user.id} from tenant ${tenantId}`);

    // Get CloudAPI config for this tenant
    const { data: config, error: configError } = await supabase
      .from("cloudapi_configs")
      .select("phone_number_id, access_token, api_version")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      console.error("[EnableCalling] Config not found:", configError);
      return new Response(
        JSON.stringify({ 
          error: "Cloud API não configurada. Configure primeiro as credenciais do Meta."
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[EnableCalling] Enabling calling for phone_number_id ${config.phone_number_id}`);

    // Enable calling via Meta Graph API
    const apiVersion = config.api_version || "v22.0";
    const graphResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${config.phone_number_id}/settings`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          calling: {
            status: "ENABLED"
          }
        }),
      }
    );

    const graphData = await graphResponse.json();

    if (!graphResponse.ok) {
      console.error("[EnableCalling] Meta API error:", graphData);
      
      const errorMessage = graphData.error?.message || "Unknown error";
      const errorCode = graphData.error?.code;
      
      // Provide helpful error messages based on common error codes
      let userMessage = errorMessage;
      let suggestion = "";
      
      if (errorCode === 200 || errorMessage.includes("permission")) {
        userMessage = "Sem permissão para habilitar Calling API";
        suggestion = "Verifique se seu token tem as permissões 'whatsapp_business_messaging' e 'whatsapp_business_management'. Seu número também precisa ter limite de pelo menos 2.000 mensagens/dia (Tier 2+).";
      } else if (errorCode === 100 || errorMessage.includes("Invalid parameter")) {
        userMessage = "Parâmetro inválido na requisição";
        suggestion = "A Calling API pode não estar disponível para sua conta. Verifique os requisitos no Meta Business Suite.";
      } else if (errorCode === 190 || errorMessage.includes("access token")) {
        userMessage = "Token de acesso inválido ou expirado";
        suggestion = "Gere um novo token de acesso permanente no Meta for Developers.";
      }
      
      return new Response(
        JSON.stringify({ 
          error: userMessage,
          suggestion,
          details: graphData.error,
          meta_error_code: errorCode
        }),
        { status: graphResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[EnableCalling] Calling enabled successfully:`, graphData);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Calling API habilitada com sucesso no Meta!",
        data: graphData
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[EnableCalling] Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
