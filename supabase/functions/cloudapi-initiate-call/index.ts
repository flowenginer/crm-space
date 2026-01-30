import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { to, contact_id, contact_name, sdp_offer } = await req.json();

    if (!to) {
      return new Response(
        JSON.stringify({ error: "Phone number (to) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[InitiateCall] Starting call to ${to}`);

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
      console.error("[InitiateCall] Auth error:", authError);
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
      console.error("[InitiateCall] Profile error:", profileError);
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = profile.tenant_id;
    console.log(`[InitiateCall] User ${user.id} from tenant ${tenantId}`);

    // Get CloudAPI config for this tenant with calling enabled
    const { data: config, error: configError } = await supabase
      .from("cloudapi_configs")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .eq("calling_enabled", true)
      .single();

    if (configError || !config) {
      console.error("[InitiateCall] Config not found:", configError);
      return new Response(
        JSON.stringify({ 
          error: "Cloud API não configurada para chamadas",
          details: "Vá em Configurações → Integrações → Cloud API e habilite a API de Ligações"
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[InitiateCall] Using Cloud API config ${config.id} with phone_number_id ${config.phone_number_id}`);

    // Format phone number - Meta expects E.164 without the "+" prefix
    const formattedPhone = to.replace(/\D/g, "");

    // Check if we have SDP offer for WebRTC
    if (!sdp_offer) {
      console.log(`[InitiateCall] No SDP offer provided - returning instructions for WebRTC setup`);
      
      // For now, return an error explaining that WebRTC SDP is required
      // The WhatsApp Calling API requires a full WebRTC implementation
      return new Response(
        JSON.stringify({ 
          error: "WebRTC SDP offer é obrigatório",
          suggestion: "A Calling API do WhatsApp requer integração WebRTC completa. É necessário gerar um SDP offer no cliente antes de iniciar a chamada.",
          action_required: "webrtc_setup",
          documentation: "https://developers.facebook.com/docs/whatsapp/cloud-api/calling/business-initiated-calls/",
          details: {
            message: "A API de chamadas do WhatsApp Cloud API funciona via WebRTC. Para iniciar uma chamada business-initiated, você precisa: 1) Obter permissão do usuário via mensagem de solicitação de permissão, 2) Gerar um SDP offer via WebRTC no cliente, 3) Enviar o SDP offer para esta API, 4) Receber o SDP answer via webhook e estabelecer a conexão."
          }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[InitiateCall] Calling Meta Graph API to initiate call to ${formattedPhone} with WebRTC SDP`);

    // Quick permission sanity-check: verify token can access this Phone Number ID
    const apiVersion = config.api_version || "v22.0";
    const phoneCheckResp = await fetch(
      `https://graph.facebook.com/${apiVersion}/${config.phone_number_id}?fields=id,display_phone_number,verified_name`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${config.access_token}`,
        },
      }
    );

    const phoneCheckData = await phoneCheckResp.json().catch(() => ({}));

    if (!phoneCheckResp.ok) {
      console.error("[InitiateCall] Phone number access check failed:", phoneCheckData);
      return new Response(
        JSON.stringify({
          error: "Token sem acesso ao Phone Number ID",
          suggestion:
            "O access_token configurado não tem permissão/escopo para operar neste phone_number_id (ou pertence a outra WABA). Gere um token permanente de um System User com acesso ao mesmo Business/WABA e com as permissões WhatsApp necessárias.",
          action_required: "fix_access_token_or_phone_number_id",
          details: phoneCheckData?.error || phoneCheckData,
          meta_error_code: phoneCheckData?.error?.code,
        }),
        {
          status: phoneCheckResp.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initiate call via Meta Graph API with proper WebRTC format
    const graphResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${config.phone_number_id}/calls`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: formattedPhone,
          action: "connect",
          session: {
            sdp_type: "offer",
            sdp: sdp_offer
          }
        }),
      }
    );

    const graphData = await graphResponse.json();

    if (!graphResponse.ok) {
      console.error("[InitiateCall] Meta API error:", graphData);
      const errorMessage = graphData.error?.message || graphData.error?.error_user_msg || "Unknown error";
      const errorCode = graphData.error?.code;
        const errorSubcode = graphData.error?.error_subcode;
      
      // Provide helpful error messages based on common error codes
      let userMessage = errorMessage;
      let suggestion = "";
      let actionRequired = "";
      
        if (errorCode === 138000 || errorSubcode === 2593051) {
          userMessage = "Calling API do WhatsApp não está habilitada para este número";
          suggestion = "No Meta (WhatsApp Manager / Developers), habilite o recurso de Calling/Voice para este phone number e garanta elegibilidade (business verificado + acesso ao Calling API).";
          actionRequired = "enable_calling_api_in_meta";
        } else if (errorCode === 138006) {
        userMessage = "Usuário não deu permissão para receber chamadas";
        suggestion = "É necessário primeiro enviar uma mensagem de solicitação de permissão de chamada ao usuário e aguardar que ele aceite.";
        actionRequired = "request_call_permission";
      } else if (errorCode === 200 || errorMessage.includes("permission") || errorMessage.includes("necessary permissions")) {
        userMessage = "Sem permissão para fazer chamadas";
        suggestion = "Verifique: 1) Se a Calling API está habilitada no seu número, 2) Se o usuário deu permissão para receber chamadas, 3) Se seu token tem as permissões necessárias.";
        actionRequired = "check_permissions";
      } else if (errorMessage.includes("tier") || errorMessage.includes("limit")) {
        userMessage = "Limite de tier insuficiente";
        suggestion = "Seu número precisa ter limite de pelo menos 2.000 mensagens/dia (Tier 2+) para usar a Calling API.";
        actionRequired = "upgrade_tier";
      } else if (errorCode === 190 || errorMessage.includes("access token")) {
        userMessage = "Token de acesso inválido ou expirado";
        suggestion = "Gere um novo token de acesso permanente no Meta for Developers.";
        actionRequired = "refresh_token";
      } else if (errorMessage.includes("SDP") || errorMessage.includes("sdp")) {
        userMessage = "Erro no formato do SDP WebRTC";
        suggestion = "O SDP offer enviado não está no formato correto. Verifique se o SDP segue o padrão RFC 8866.";
        actionRequired = "fix_sdp";
      }
      
      return new Response(
        JSON.stringify({ 
          error: userMessage, 
          suggestion,
          action_required: actionRequired,
          details: graphData.error || graphData,
          meta_error_code: errorCode
        }),
        { status: graphResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[InitiateCall] Call initiated successfully:`, graphData);

    // Extract call ID from response
    const callId = graphData.calls?.[0]?.id;

    // Create call log entry
    const { data: callLog, error: logError } = await supabase
      .from("call_logs")
      .insert({
        tenant_id: tenantId,
        channel_id: config.channel_id,
        contact_id: contact_id,
        user_id: user.id,
        whatsapp_call_id: callId,
        call_type: "whatsapp",
        direction: "outbound",
        call_status: "initiating",
        call_date: new Date().toISOString().split("T")[0],
        call_time: new Date().toTimeString().split(" ")[0],
        start_time: new Date().toISOString(),
      })
      .select()
      .single();

    if (logError) {
      console.error("[InitiateCall] Error creating call log:", logError);
    } else {
      console.log(`[InitiateCall] Call log created: ${callLog.id}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        call_id: callId,
        call_log_id: callLog?.id,
        channel_id: config.channel_id,
        message: "Chamada iniciada. Aguardando webhook de conexão do Meta."
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[InitiateCall] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
