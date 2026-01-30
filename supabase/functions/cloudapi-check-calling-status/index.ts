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
      console.error("[CheckCallingStatus] Auth error:", authError);
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
      console.error("[CheckCallingStatus] Profile error:", profileError);
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = profile.tenant_id;
    console.log(`[CheckCallingStatus] User ${user.id} from tenant ${tenantId}`);

    // Get CloudAPI config for this tenant
    const { data: config, error: configError } = await supabase
      .from("cloudapi_configs")
      .select("phone_number_id, access_token, api_version, waba_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .single();

    if (configError || !config) {
      console.error("[CheckCallingStatus] Config not found:", configError);
      return new Response(
        JSON.stringify({ 
          error: "Cloud API não configurada",
          calling_enabled: false,
          meta_calling_enabled: false
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CheckCallingStatus] Checking calling status for phone_number_id ${config.phone_number_id}`);

    // Use minimum v22.0 for calling endpoints (Meta docs recommend this)
    const configVersion = config.api_version || "v22.0";
    const versionNumber = parseInt(configVersion.replace(/[^\d]/g, "")) || 22;
    const apiVersion = versionNumber >= 22 ? configVersion : "v22.0";

    // Fetch phone number details including health_status
    const graphResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${config.phone_number_id}?fields=id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,health_status,account_mode`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${config.access_token}`,
        },
      }
    );

    const graphData = await graphResponse.json();

    if (!graphResponse.ok) {
      console.error("[CheckCallingStatus] Meta API error:", graphData);
      return new Response(
        JSON.stringify({ 
          error: `Erro ao verificar status no Meta: ${graphData.error?.message || "Unknown error"}`,
          calling_enabled: false,
          meta_calling_enabled: false,
          meta_error: graphData.error
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[CheckCallingStatus] Phone number data:`, JSON.stringify(graphData));

    // Check calling settings specifically - Meta returns { calling: { status: "ENABLED" | "DISABLED" } }
    const settingsResponse = await fetch(
      `https://graph.facebook.com/${apiVersion}/${config.phone_number_id}/settings`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${config.access_token}`,
        },
      }
    );

    let callingStatus = "unknown";
    let callingEnabled = false;
    let callbackPermissionStatus: string | null = null;
    let callIconVisibility: string | null = null;
    let settingsRaw: any = null;

    if (settingsResponse.ok) {
      const settingsData = await settingsResponse.json();
      console.log(`[CheckCallingStatus] Settings data (raw):`, JSON.stringify(settingsData));
      settingsRaw = settingsData;
      
      // Per Meta documentation, settings returns { calling: { status: "ENABLED" | "DISABLED", ... } }
      if (settingsData.calling) {
        callingStatus = settingsData.calling.status || "unknown";
        callingEnabled = callingStatus === "ENABLED";
        callbackPermissionStatus = settingsData.calling.callback_permission_status || null;
        callIconVisibility = settingsData.calling.call_icon_visibility || null;
      } else if (settingsData.data && Array.isArray(settingsData.data)) {
        // Fallback: some versions may use data array format
        const callingSetting = settingsData.data.find((s: any) => s.setting_type === "calling" || s.type === "calling");
        if (callingSetting) {
          callingStatus = callingSetting.value?.status || callingSetting.status || "unknown";
          callingEnabled = callingStatus === "ENABLED";
        }
      }
    } else {
      const settingsError = await settingsResponse.json();
      console.log(`[CheckCallingStatus] Could not fetch settings:`, JSON.stringify(settingsError));
    }

    // Parse messaging limit tier to check if eligible for calling (needs tier 2+)
    const messagingLimitTier = graphData.messaging_limit_tier || "TIER_NOT_SET";
    const tierMatch = messagingLimitTier.match(/(\d+)/);
    const tierNumber = tierMatch ? parseInt(tierMatch[1]) : 0;
    const isEligibleForCalling = tierNumber >= 2;

    // Parse health_status
    const healthStatus = graphData.health_status || null;
    const healthCanSendMessage = healthStatus?.can_send_message;
    const healthEntities = healthStatus?.entities || [];

    // Build detailed response
    const response = {
      success: true,
      phone_number_id: config.phone_number_id,
      waba_id: config.waba_id,
      display_phone_number: graphData.display_phone_number,
      verified_name: graphData.verified_name,
      quality_rating: graphData.quality_rating,
      account_mode: graphData.account_mode,
      messaging_limit_tier: messagingLimitTier,
      tier_number: tierNumber,
      is_eligible_for_calling: isEligibleForCalling,
      // Calling-specific
      calling_status: callingStatus,
      meta_calling_enabled: callingEnabled,
      callback_permission_status: callbackPermissionStatus,
      call_icon_visibility: callIconVisibility,
      // Health
      health_status: healthStatus,
      health_can_send_message: healthCanSendMessage,
      health_entities: healthEntities,
      // Debug
      api_version_used: apiVersion,
      settings_raw: settingsRaw,
    };

    console.log(`[CheckCallingStatus] Final response:`, JSON.stringify(response));

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[CheckCallingStatus] Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : "Unknown error",
        calling_enabled: false,
        meta_calling_enabled: false
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
