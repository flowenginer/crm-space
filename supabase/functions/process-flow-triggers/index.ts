import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TriggerRequest {
  trigger_type: 'redirect_lead' | 'keyword' | 'message_key' | 'first_message' | 'new_contact' | 'inactivity' | 'tag_added';
  tenant_id: string;
  contact_id: string;
  channel_id?: string;
  conversation_id?: string;
  message_content?: string;
  metadata?: Record<string, unknown>;
}

interface FlowWithTrigger {
  flow_id: string;
  flow_name: string;
  channel_ids: string[] | null;
  run_once_per_contact: boolean;
  trigger_node_id: string;
  trigger_subtype: string;
  trigger_config: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: TriggerRequest = await req.json();
    const { trigger_type, tenant_id, contact_id, channel_id, conversation_id, message_content, metadata } = body;

    console.log('[process-flow-triggers] Recebido:', { trigger_type, tenant_id, contact_id: contact_id?.substring(0, 8) });

    // OTIMIZAÇÃO: Buscar fluxos E trigger nodes em uma única query com JOIN
    const { data: flowsWithTriggers, error: flowsError } = await supabase
      .from('chatbot_flows')
      .select(`
        id,
        name,
        channel_ids,
        run_once_per_contact,
        flow_nodes!inner(id, node_subtype, config)
      `)
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)
      .eq('flow_nodes.node_type', 'trigger');

    if (flowsError) {
      console.error('[process-flow-triggers] Erro ao buscar fluxos:', flowsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar fluxos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!flowsWithTriggers || flowsWithTriggers.length === 0) {
      console.log('[process-flow-triggers] Nenhum fluxo ativo encontrado');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum fluxo ativo', triggered: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mapear para estrutura mais simples
    const flows: FlowWithTrigger[] = flowsWithTriggers.map(f => {
      const triggerNode = Array.isArray(f.flow_nodes) ? f.flow_nodes[0] : f.flow_nodes;
      return {
        flow_id: f.id,
        flow_name: f.name,
        channel_ids: f.channel_ids as string[] | null,
        run_once_per_contact: f.run_once_per_contact ?? false,
        trigger_node_id: triggerNode?.id || '',
        trigger_subtype: triggerNode?.node_subtype || '',
        trigger_config: (triggerNode?.config as Record<string, unknown>) || {},
      };
    }).filter(f => f.trigger_node_id); // Filtrar fluxos sem trigger node

    // OTIMIZAÇÃO: Pré-filtrar fluxos por tipo de trigger antes do loop
    const matchingFlows = flows.filter(flow => {
      // Verificar canal
      if (channel_id && flow.channel_ids && flow.channel_ids.length > 0) {
        if (!flow.channel_ids.includes(channel_id)) {
          return false;
        }
      }
      // Verificar tipo de trigger - agrupar keyword e message_key como equivalentes
      const keywordTypes = ['keyword', 'message_key'];
      if (keywordTypes.includes(trigger_type)) {
        return keywordTypes.includes(flow.trigger_subtype);
      }
      return flow.trigger_subtype === trigger_type;
    });

    if (matchingFlows.length === 0) {
      console.log('[process-flow-triggers] Nenhum fluxo com trigger correspondente');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum fluxo correspondente', triggered: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // OTIMIZAÇÃO: Buscar todas as execuções existentes de uma vez (para run_once_per_contact)
    const flowsWithRunOnce = matchingFlows.filter(f => f.run_once_per_contact);
    let existingExecutions: Set<string> = new Set();
    
    if (flowsWithRunOnce.length > 0) {
      const { data: executions } = await supabase
        .from('flow_executions')
        .select('flow_id')
        .in('flow_id', flowsWithRunOnce.map(f => f.flow_id))
        .eq('contact_id', contact_id);
      
      existingExecutions = new Set((executions || []).map(e => e.flow_id));
    }

    // OTIMIZAÇÃO: Buscar conversa existente e canais disponíveis em paralelo
    let actualChannelId = channel_id || null;
    let actualConversationId = conversation_id;

    if (!actualChannelId || !actualConversationId) {
      const [existingConvResult, availableChannelsResult] = await Promise.all([
        // Buscar conversa existente do contato
        supabase
          .from('conversations')
          .select('id, channel_id')
          .eq('contact_id', contact_id)
          .in('status', ['open', 'pending'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        // Buscar canais disponíveis (caso não tenha canal definido)
        !actualChannelId ? supabase
          .from('whatsapp_channels')
          .select('id, name')
          .eq('tenant_id', tenant_id)
          .eq('status', 'connected')
          .eq('is_deleted', false) : Promise.resolve({ data: null }),
      ]);

      if (existingConvResult.data?.channel_id) {
        actualChannelId = existingConvResult.data.channel_id;
        actualConversationId = existingConvResult.data.id;
        console.log('[process-flow-triggers] ✅ Usando canal da conversa existente:', actualChannelId?.substring(0, 8));
      } else if (!actualChannelId && availableChannelsResult.data && availableChannelsResult.data.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableChannelsResult.data.length);
        actualChannelId = availableChannelsResult.data[randomIndex].id;
        console.log('[process-flow-triggers] Canal aleatório selecionado:', availableChannelsResult.data[randomIndex].name);
      }
    }

    let triggeredCount = 0;
    const executionPromises: Promise<void>[] = [];

    for (const flow of matchingFlows) {
      // Verificar run_once_per_contact usando cache
      if (flow.run_once_per_contact && existingExecutions.has(flow.flow_id)) {
        console.log(`[process-flow-triggers] Fluxo ${flow.flow_name} já executou para este contato`);
        continue;
      }

      // Verificações específicas por tipo de trigger
      const config = flow.trigger_config;
      let shouldTrigger = true;

      switch (trigger_type) {
        case 'redirect_lead':
          if (config.campaign_id && metadata?.campaign_id) {
            shouldTrigger = config.campaign_id === metadata.campaign_id;
          }
          break;

        case 'keyword':
        case 'message_key':
          if (message_content) {
            const keywords = (config.keywords as string[]) || [];
            const matchType = (config.match_type as string) || 'contains';
            const msg = message_content.toLowerCase();

            shouldTrigger = keywords.some((kw: string) => {
              const keyword = kw.toLowerCase().trim();
              switch (matchType) {
                case 'equals': return msg === keyword;
                case 'starts_with': return msg.startsWith(keyword);
                default: return msg.includes(keyword);
              }
            });
            
            if (shouldTrigger) {
              console.log(`[process-flow-triggers] ✅ ${trigger_type} match found for flow ${flow.flow_name}`);
            }
          } else {
            shouldTrigger = false;
          }
          break;

        case 'tag_added':
          if (config.tag_id && metadata?.tag_id) {
            shouldTrigger = config.tag_id === metadata.tag_id;
            console.log(`[process-flow-triggers] tag_added: config.tag_id=${config.tag_id}, metadata.tag_id=${metadata.tag_id}, match=${shouldTrigger}`);
          } else {
            console.log(`[process-flow-triggers] tag_added: sem tag_id configurado ou recebido`);
            shouldTrigger = false;
          }
          break;
      }

      if (!shouldTrigger) {
        console.log(`[process-flow-triggers] Condições do trigger não satisfeitas para ${flow.flow_name}`);
        continue;
      }

      // Criar conversa se necessário
      let convIdForExecution = actualConversationId;
      
      if (!convIdForExecution && actualChannelId) {
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contact_id)
          .eq('channel_id', actualChannelId)
          .in('status', ['open', 'pending'])
          .maybeSingle();

        if (existingConv) {
          convIdForExecution = existingConv.id;
          console.log('[process-flow-triggers] Conversa existente encontrada:', convIdForExecution?.substring(0, 8));
        } else {
          const { data: newConv, error: convError } = await supabase
            .from('conversations')
            .insert({
              tenant_id,
              contact_id,
              channel_id: actualChannelId,
              status: 'pending',
              referral_source: trigger_type === 'redirect_lead' ? 'redirect' : 'automation',
              referral_data: metadata || {},
            })
            .select('id')
            .single();

          if (convError) {
            console.error('[process-flow-triggers] Erro ao criar conversa:', convError);
            continue;
          }
          convIdForExecution = newConv.id;
          console.log('[process-flow-triggers] Nova conversa criada:', convIdForExecution?.substring(0, 8));
        }
      } else if (!convIdForExecution && !actualChannelId) {
        console.log('[process-flow-triggers] ⚠️ Sem canal disponível, não foi possível criar conversa');
      }

      // Criar execução do fluxo
      const { data: execution, error: execError } = await supabase
        .from('flow_executions')
        .insert({
          flow_id: flow.flow_id,
          conversation_id: convIdForExecution,
          contact_id,
          channel_id: actualChannelId,
          status: 'running',
          variables: {
            trigger_type,
            mensagem_original: message_content || '',
            ...metadata
          },
        })
        .select('id')
        .single();

      if (execError) {
        console.error(`[process-flow-triggers] Erro ao criar execução para ${flow.flow_name}:`, execError);
        continue;
      }

      console.log(`[process-flow-triggers] Execução criada: ${execution.id} para fluxo ${flow.flow_name}`);

      // OTIMIZAÇÃO: Executar operações de follow-up em paralelo
      executionPromises.push((async () => {
        // Atualizar estatísticas do fluxo
        const { data: currentFlow } = await supabase
          .from('chatbot_flows')
          .select('total_executions')
          .eq('id', flow.flow_id)
          .single();

        // Buscar conexão para próximo nó
        const { data: connection } = await supabase
          .from('flow_connections')
          .select('target_node_id')
          .eq('source_node_id', flow.trigger_node_id)
          .single();

        // Atualizar contagem
        await supabase
          .from('chatbot_flows')
          .update({ total_executions: (currentFlow?.total_executions || 0) + 1 })
          .eq('id', flow.flow_id);

        // Invocar próximo nó se houver conexão
        if (connection) {
          try {
            await supabase.functions.invoke('execute-flow-node', {
              body: {
                execution_id: execution.id,
                node_id: connection.target_node_id,
              }
            });
          } catch (invokeError) {
            console.error('[process-flow-triggers] Erro ao invocar execute-flow-node:', invokeError);
          }
        }
      })());

      triggeredCount++;
    }

    // Aguardar todas as operações de follow-up
    await Promise.all(executionPromises);

    console.log(`[process-flow-triggers] Total de fluxos disparados: ${triggeredCount}`);

    return new Response(
      JSON.stringify({ success: true, triggered: triggeredCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-flow-triggers] Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
