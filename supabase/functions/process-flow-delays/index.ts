import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();
    let processedCount = 0;

    console.log(`[process-flow-delays] Starting at ${now}`);

    // 1. Processar delays de tempo (wait_time)
    const { data: timeDelays } = await supabase
      .from('flow_executions')
      .select('*')
      .eq('status', 'waiting_delay')
      .lt('waiting_until', now);

    for (const exec of timeDelays || []) {
      if (exec.current_node_id) {
        const { data: conn } = await supabase
          .from('flow_connections')
          .select('target_node_id')
          .eq('source_node_id', exec.current_node_id)
          .single();

        if (conn) {
          await supabase.from('flow_executions').update({ status: 'running', waiting_until: null }).eq('id', exec.id);
          await supabase.from('flow_execution_logs').insert({ execution_id: exec.id, node_id: exec.current_node_id, log_type: 'info', message: 'Delay concluído' });
          processedCount++;
        }
      }
    }

    // 2. Processar timeouts de wait_reply
    const { data: replyTimeouts } = await supabase
      .from('flow_executions')
      .select('*')
      .eq('status', 'waiting_reply')
      .lt('waiting_until', now);

    for (const exec of replyTimeouts || []) {
      if (exec.current_node_id) {
        const { data: timeoutConn } = await supabase
          .from('flow_connections')
          .select('target_node_id')
          .eq('source_node_id', exec.current_node_id)
          .eq('source_handle', 'timeout')
          .single();

        await supabase.from('flow_executions').update({ 
          status: timeoutConn ? 'running' : 'completed', 
          waiting_until: null, 
          waiting_for: null,
          completed_at: timeoutConn ? null : now
        }).eq('id', exec.id);
        
        await supabase.from('flow_execution_logs').insert({ 
          execution_id: exec.id, 
          node_id: exec.current_node_id, 
          log_type: 'info', 
          message: timeoutConn ? 'Timeout - seguindo caminho' : 'Timeout - fluxo finalizado' 
        });
        processedCount++;
      }
    }

    console.log(`[process-flow-delays] Processed ${processedCount} executions`);

    return new Response(JSON.stringify({ success: true, processed: processedCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[process-flow-delays] Error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
