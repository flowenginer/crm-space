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

    const { to, contact_id, contact_name } = await req.json();

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

    // Normalize phone number (remove non-digits, ensure + prefix)
    const normalizedPhone = to.replace(/\D/g, "");
    const formattedPhone = normalizedPhone.startsWith("+") ? normalizedPhone : `+${normalizedPhone}`;

    console.log(`[InitiateCall] Calling Meta Graph API to initiate call to ${formattedPhone}`);

    // Call Meta Graph API to initiate the call
    const apiVersion = config.api_version || "v22.0";
    const graphResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${config.phone_number_id}/calls`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: formattedPhone,
        }),
      }
    );

    const graphData = await graphResponse.json();

    if (!graphResponse.ok) {
      console.error("[InitiateCall] Meta API error:", graphData);
      return new Response(
        JSON.stringify({ 
          error: "Failed to initiate call", 
          details: graphData.error?.message || "Unknown error" 
        }),
        { status: graphResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[InitiateCall] Call initiated successfully:`, graphData);

    // Create call log entry
    const { data: callLog, error: logError } = await supabase
      .from("call_logs")
      .insert({
        tenant_id: tenantId,
        channel_id: config.channel_id, // May be null, that's fine
        contact_id: contact_id,
        user_id: user.id,
        whatsapp_call_id: graphData.call_id,
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
        call_id: graphData.call_id,
        call_log_id: callLog?.id,
        channel_id: config.channel_id,
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
