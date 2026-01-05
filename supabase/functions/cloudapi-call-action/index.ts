import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CallAction = "answer" | "reject" | "hangup";

interface CallActionRequest {
  channel_id: string;
  call_id: string;
  action: CallAction;
  sdp_answer?: string; // Required for "answer" action
}

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

    const { channel_id, call_id, action, sdp_answer }: CallActionRequest = await req.json();

    if (!channel_id || !call_id || !action) {
      return new Response(
        JSON.stringify({ error: "channel_id, call_id, and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["answer", "reject", "hangup"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "Invalid action. Must be: answer, reject, or hangup" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "answer" && !sdp_answer) {
      return new Response(
        JSON.stringify({ error: "sdp_answer is required for answer action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CallAction] Processing ${action} for call ${call_id}`);

    // Get CloudAPI config for this channel
    const { data: config, error: configError } = await supabase
      .from("cloudapi_configs")
      .select("*")
      .eq("channel_id", channel_id)
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      console.error("[CallAction] Config not found:", configError);
      return new Response(
        JSON.stringify({ error: "CloudAPI config not found for this channel" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build request body based on action - Meta requires messaging_product
    let requestBody: Record<string, unknown> = { 
      messaging_product: "whatsapp",
      action 
    };

    if (action === "answer" && sdp_answer) {
      requestBody.session = {
        sdp: sdp_answer,
        sdp_type: "answer",
      };
    }

    console.log(`[CallAction] Sending ${action} to Meta API for call ${call_id}`);

    // Call Meta Graph API
    const apiVersion = config.api_version || "v22.0";
    const graphResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${config.phone_number_id}/calls/${call_id}`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    const graphData = await graphResponse.json();

    if (!graphResponse.ok) {
      console.error("[CallAction] Meta API error:", graphData);
      return new Response(
        JSON.stringify({ 
          error: `Failed to ${action} call`, 
          details: graphData.error?.message || "Unknown error" 
        }),
        { status: graphResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CallAction] ${action} successful for call ${call_id}:`, graphData);

    // Update call log based on action
    const now = new Date().toISOString();
    let updateData: Record<string, unknown> = {
      updated_at: now,
    };

    switch (action) {
      case "answer":
        updateData.call_status = "active";
        break;
      case "reject":
        updateData.call_status = "rejected";
        updateData.end_time = now;
        break;
      case "hangup":
        updateData.call_status = "completed";
        updateData.end_time = now;
        break;
    }

    const { error: updateError } = await supabase
      .from("call_logs")
      .update(updateData)
      .eq("whatsapp_call_id", call_id);

    if (updateError) {
      console.error("[CallAction] Error updating call log:", updateError);
    }

    // Broadcast call state change via Realtime
    await supabase.channel("call-events").send({
      type: "broadcast",
      event: "call_state_changed",
      payload: {
        call_id,
        action,
        status: updateData.call_status,
        timestamp: now,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        action,
        call_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[CallAction] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
