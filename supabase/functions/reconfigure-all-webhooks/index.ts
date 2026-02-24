import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[ReconfigureAll] Starting batch webhook reconfiguration...");

    // Buscar todos os canais ativos que ainda não foram reconfigurados
    const { data: channels, error } = await supabase
      .from("whatsapp_channels")
      .select(`
        id,
        name,
        instance_id,
        provider:whatsapp_providers(code)
      `)
      .eq("is_deleted", false)
      .is("webhook_events_configured_at", null);

    if (error) {
      console.error("[ReconfigureAll] Error fetching channels:", error);
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!channels || channels.length === 0) {
      console.log("[ReconfigureAll] No channels need reconfiguration");
      return new Response(JSON.stringify({ success: true, message: "No channels need reconfiguration", reconfigured: 0, errors: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ReconfigureAll] Found ${channels.length} channels to reconfigure`);

    let successCount = 0;
    let errorCount = 0;
    const results: any[] = [];

    for (const ch of channels) {
      const providerCode = (ch.provider as any)?.code;
      
      // Skip Z-API (doesn't support webhook reconfiguration via API)
      if (providerCode === "zapi") {
        console.log(`[ReconfigureAll] Skipping Z-API channel: ${ch.name}`);
        // Mark as configured anyway to avoid repeated checks
        await supabase
          .from("whatsapp_channels")
          .update({ webhook_events_configured_at: new Date().toISOString() })
          .eq("id", ch.id);
        results.push({ id: ch.id, name: ch.name, status: "skipped", reason: "zapi" });
        continue;
      }

      try {
        console.log(`[ReconfigureAll] Reconfiguring: ${ch.name} (${providerCode})`);

        const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-instance`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            action: "reconfigureWebhook",
            channelId: ch.id,
          }),
        });

        const result = await response.json();

        if (result.success) {
          // Mark as configured
          await supabase
            .from("whatsapp_channels")
            .update({ webhook_events_configured_at: new Date().toISOString() })
            .eq("id", ch.id);

          successCount++;
          results.push({ id: ch.id, name: ch.name, status: "success" });
          console.log(`[ReconfigureAll] ✅ ${ch.name} reconfigured successfully`);
        } else {
          errorCount++;
          results.push({ id: ch.id, name: ch.name, status: "error", error: result.error || result.message });
          console.log(`[ReconfigureAll] ❌ ${ch.name} failed: ${result.error || result.message}`);
        }
      } catch (err) {
        errorCount++;
        results.push({ id: ch.id, name: ch.name, status: "error", error: String(err) });
        console.error(`[ReconfigureAll] ❌ ${ch.name} exception:`, err);
      }

      // Small delay between calls to avoid overloading
      await new Promise((r) => setTimeout(r, 500));
    }

    console.log(`[ReconfigureAll] Done! Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        total: channels.length,
        reconfigured: successCount,
        errors: errorCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[ReconfigureAll] Unexpected error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
