import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// VERSIONAMENTO: Alterações importantes devem atualizar esta versão
const VERSION = '2026-02-03.1930';

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

    console.log(`[process-flow-delays v${VERSION}] Starting at ${now}`);

    // OTIMIZAÇÃO: Buscar ambos os tipos em paralelo - incluir tenant_id para logs
    const [timeDelaysResult, replyTimeoutsResult] = await Promise.all([
      supabase
        .from('flow_executions')
        .select('id, current_node_id, tenant_id')
        .eq('status', 'waiting_delay')
        .lt('waiting_until', now),
      supabase
        .from('flow_executions')
        .select('id, current_node_id, tenant_id')
        .eq('status', 'waiting_reply')
        .lt('waiting_until', now)
    ]);

    const timeDelays = timeDelaysResult.data || [];
    const replyTimeouts = replyTimeoutsResult.data || [];

    // Se não há nada para processar, retorna cedo
    if (timeDelays.length === 0 && replyTimeouts.length === 0) {
      console.log(`[process-flow-delays] No executions to process`);
      return new Response(JSON.stringify({ success: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Coletar todos os node_ids para buscar connections em batch
    const allNodeIds = [
      ...timeDelays.filter(e => e.current_node_id).map(e => e.current_node_id!),
      ...replyTimeouts.filter(e => e.current_node_id).map(e => e.current_node_id!)
    ];

    // OTIMIZAÇÃO: Buscar todas as connections de uma vez
    const { data: allConnections } = await supabase
      .from('flow_connections')
      .select('source_node_id, target_node_id, source_handle')
      .in('source_node_id', allNodeIds);

    const connectionsMap = new Map<string, { target_node_id: string; source_handle?: string }[]>();
    (allConnections || []).forEach(conn => {
      if (!connectionsMap.has(conn.source_node_id)) {
        connectionsMap.set(conn.source_node_id, []);
      }
      connectionsMap.get(conn.source_node_id)!.push(conn);
    });

    // Preparar updates e logs em batch - incluir tenant_id para evitar erro de NOT NULL
    const delayUpdateIds: string[] = [];
    const delayLogs: { execution_id: string; node_id: string; log_type: string; message: string; tenant_id: string }[] = [];
    
    const timeoutUpdateRunning: string[] = [];
    const timeoutUpdateCompleted: string[] = [];
    const timeoutLogs: { execution_id: string; node_id: string; log_type: string; message: string; tenant_id: string }[] = [];

    // 1. Processar delays de tempo
    for (const exec of timeDelays) {
      if (exec.current_node_id && exec.tenant_id) {
        const connections = connectionsMap.get(exec.current_node_id) || [];
        if (connections.length > 0) {
          delayUpdateIds.push(exec.id);
          delayLogs.push({ 
            execution_id: exec.id, 
            node_id: exec.current_node_id, 
            log_type: 'info', 
            message: 'Delay concluído',
            tenant_id: exec.tenant_id // CRÍTICO: incluir tenant_id
          });
          processedCount++;
        }
      }
    }

    // 2. Processar timeouts de wait_reply
    for (const exec of replyTimeouts) {
      if (exec.current_node_id && exec.tenant_id) {
        const connections = connectionsMap.get(exec.current_node_id) || [];
        const hasTimeoutPath = connections.some(c => c.source_handle === 'timeout');
        
        if (hasTimeoutPath) {
          timeoutUpdateRunning.push(exec.id);
          timeoutLogs.push({ 
            execution_id: exec.id, 
            node_id: exec.current_node_id, 
            log_type: 'info', 
            message: 'Timeout - seguindo caminho',
            tenant_id: exec.tenant_id // CRÍTICO: incluir tenant_id
          });
        } else {
          timeoutUpdateCompleted.push(exec.id);
          timeoutLogs.push({ 
            execution_id: exec.id, 
            node_id: exec.current_node_id, 
            log_type: 'info', 
            message: 'Timeout - fluxo finalizado',
            tenant_id: exec.tenant_id // CRÍTICO: incluir tenant_id
          });
        }
        processedCount++;
      }
    }

    // OTIMIZAÇÃO: Executar todos os updates e inserts em paralelo
    const operations: (() => Promise<void>)[] = [];

    if (delayUpdateIds.length > 0) {
      operations.push(async () => {
        await supabase.from('flow_executions')
          .update({ status: 'running', waiting_until: null })
          .in('id', delayUpdateIds);
      });
    }

    if (timeoutUpdateRunning.length > 0) {
      operations.push(async () => {
        await supabase.from('flow_executions')
          .update({ status: 'running', waiting_until: null, waiting_for: null })
          .in('id', timeoutUpdateRunning);
      });
    }

    if (timeoutUpdateCompleted.length > 0) {
      operations.push(async () => {
        await supabase.from('flow_executions')
          .update({ status: 'completed', waiting_until: null, waiting_for: null, completed_at: now })
          .in('id', timeoutUpdateCompleted);
      });
    }

    const allLogs = [...delayLogs, ...timeoutLogs];
    if (allLogs.length > 0) {
      operations.push(async () => {
        await supabase.from('flow_execution_logs').insert(allLogs);
      });
    }

    await Promise.all(operations.map(op => op()));

    // IMPORTANTE: Após atualizar status, chamar execute-flow-node para continuar o fluxo
    const executePromises: Promise<any>[] = [];

    // Continuar delays de tempo
    for (const exec of timeDelays) {
      if (exec.current_node_id && delayUpdateIds.includes(exec.id)) {
        const connections = connectionsMap.get(exec.current_node_id) || [];
        if (connections.length > 0) {
          const nextNodeId = connections[0].target_node_id;
          console.log(`[process-flow-delays] ▶️ Continuando execução ${exec.id} para nó ${nextNodeId}`);
          executePromises.push(
            supabase.functions.invoke('execute-flow-node', {
              body: { execution_id: exec.id, node_id: nextNodeId }
            })
          );
        }
      }
    }

    // Continuar timeouts que têm caminho
    for (const exec of replyTimeouts) {
      if (exec.current_node_id && timeoutUpdateRunning.includes(exec.id)) {
        const connections = connectionsMap.get(exec.current_node_id) || [];
        const timeoutConnection = connections.find(c => c.source_handle === 'timeout');
        if (timeoutConnection) {
          console.log(`[process-flow-delays] ⏰ Timeout - continuando execução ${exec.id} para nó ${timeoutConnection.target_node_id}`);
          executePromises.push(
            supabase.functions.invoke('execute-flow-node', {
              body: { execution_id: exec.id, node_id: timeoutConnection.target_node_id }
            })
          );
        }
      }
    }

    // Executar todas as continuações em paralelo
    if (executePromises.length > 0) {
      console.log(`[process-flow-delays] 🚀 Disparando ${executePromises.length} continuações de fluxo`);
      await Promise.allSettled(executePromises);
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
