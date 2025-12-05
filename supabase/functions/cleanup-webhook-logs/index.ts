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

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    console.log("[Cleanup] Starting webhook_logs cleanup...");
    
    // Configurações
    const RETENTION_DAYS = 3; // Manter apenas últimos 3 dias
    const BATCH_SIZE = 5000;  // Deletar em lotes para não travar
    const MAX_ITERATIONS = 10; // Máximo de iterações por execução
    
    let totalDeleted = 0;
    let iteration = 0;
    
    // Deletar em lotes até não ter mais registros antigos ou atingir limite
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      
      // Usar subquery para deletar em lotes
      const { data, error } = await supabase.rpc('delete_old_webhook_logs', {
        retention_days: RETENTION_DAYS,
        batch_size: BATCH_SIZE
      });
      
      if (error) {
        // Se a RPC não existir, fazer delete direto
        if (error.code === '42883') { // function does not exist
          console.log("[Cleanup] RPC not found, using direct delete...");
          
          const { error: deleteError, count } = await supabase
            .from('webhook_logs')
            .delete({ count: 'exact' })
            .lt('created_at', new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString())
            .limit(BATCH_SIZE);
          
          if (deleteError) {
            console.error("[Cleanup] Delete error:", deleteError);
            break;
          }
          
          const deleted = count || 0;
          totalDeleted += deleted;
          console.log(`[Cleanup] Iteration ${iteration}: Deleted ${deleted} logs`);
          
          if (deleted < BATCH_SIZE) {
            break; // Não há mais registros para deletar
          }
        } else {
          console.error("[Cleanup] RPC error:", error);
          break;
        }
      } else {
        const deleted = data || 0;
        totalDeleted += deleted;
        console.log(`[Cleanup] Iteration ${iteration}: Deleted ${deleted} logs via RPC`);
        
        if (deleted < BATCH_SIZE) {
          break;
        }
      }
    }
    
    // Também limpar eventos desnecessários mesmo recentes
    const unnecessaryEvents = [
      'presence.update', 'presence_update', 
      'qrcode.updated', 'qrcode_updated',
      'typing', 'composing', 'recording',
      'chats.upsert', 'chats.update',
      'connection.update'
    ];
    
    const { error: cleanError, count: cleanCount } = await supabase
      .from('webhook_logs')
      .delete({ count: 'exact' })
      .in('event_type', unnecessaryEvents);
    
    if (!cleanError && cleanCount) {
      totalDeleted += cleanCount;
      console.log(`[Cleanup] Deleted ${cleanCount} unnecessary event logs`);
    }
    
    console.log(`[Cleanup] Total deleted: ${totalDeleted} logs`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted: totalDeleted,
        message: `Cleaned up ${totalDeleted} webhook logs` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("[Cleanup] Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
