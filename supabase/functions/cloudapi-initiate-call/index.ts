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

    const { channel_id, to, contact_id, contact_name } = await req.json();

    if (!channel_id || !to) {
      return new Response(
        JSON.stringify({ error: "channel_id and to are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[InitiateCall] Starting call to ${to} via channel ${channel_id}`);

    // Get CloudAPI config for this channel
    const { data: config, error: configError } = await supabase
      .from("cloudapi_configs")
      .select("*")
      .eq("channel_id", channel_id)
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      console.error("[InitiateCall] Config not found:", configError);
      return new Response(
        JSON.stringify({ error: "CloudAPI config not found for this channel" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.calling_enabled) {
      return new Response(
        JSON.stringify({ error: "Calling is not enabled for this channel" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    let userId = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = user?.id;
    }

    // Create call log entry
    const { data: callLog, error: logError } = await supabase
      .from("call_logs")
      .insert({
        tenant_id: config.tenant_id,
        channel_id: channel_id,
        contact_id: contact_id,
        user_id: userId || config.tenant_id, // Fallback to tenant_id if no user
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
