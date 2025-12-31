import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TriggerRequest {
  trigger_type: 'redirect_lead' | 'keyword' | 'first_message' | 'new_contact' | 'inactivity' | 'tag_added';
  tenant_id: string;
  contact_id: string;
  channel_id?: string;
  conversation_id?: string;
  message_content?: string;
  metadata?: Record<string, unknown>;
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

    // Buscar fluxos ativos com este tipo de gatilho
    const { data: flows, error: flowsError } = await supabase
      .from('chatbot_flows')
      .select('id, name, channel_ids, run_once_per_contact')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true);

    if (flowsError) {
      console.error('[process-flow-triggers] Erro ao buscar fluxos:', flowsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar fluxos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    if (!flows || flows.length === 0) {
      console.log('[process-flow-triggers] Nenhum fluxo ativo encontrado');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum fluxo ativo', triggered: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let triggeredCount = 0;

    for (const flow of flows) {
      // Verificar se o fluxo é específico para certos canais
      const flowChannelIds = flow.channel_ids as string[] | null;
      if (channel_id && flowChannelIds && flowChannelIds.length > 0) {
        if (!flowChannelIds.includes(channel_id)) {
          console.log(`[process-flow-triggers] Fluxo ${flow.name} não inclui canal ${channel_id}`);
          continue;
        }
      }

      // Buscar nó trigger do fluxo
      const { data: triggerNode, error: nodeError } = await supabase
        .from('flow_nodes')
        .select('id, node_subtype, config')
        .eq('flow_id', flow.id)
        .eq('node_type', 'trigger')
        .single();

      if (nodeError || !triggerNode) {
        console.log(`[process-flow-triggers] Fluxo ${flow.name} sem trigger node`);
        continue;
      }

      // Verificar se o trigger corresponde ao tipo solicitado
      if (triggerNode.node_subtype !== trigger_type) {
        continue;
      }

      // Verificações específicas por tipo de trigger
      const config = triggerNode.config as Record<string, unknown> || {};
      let shouldTrigger = true;

      switch (trigger_type) {
        case 'redirect_lead':
          // Se configurado para campanha específica, verificar
          if (config.campaign_id && metadata?.campaign_id) {
            shouldTrigger = config.campaign_id === metadata.campaign_id;
          }
          break;

        case 'keyword':
          // Verificar se mensagem contém palavras-chave
          if (message_content) {
            const keywords = (config.keywords as string[]) || [];
            const matchType = (config.match_type as string) || 'contains';
            const msg = message_content.toLowerCase();

            shouldTrigger = keywords.some((kw: string) => {
              const keyword = kw.toLowerCase();
              switch (matchType) {
                case 'equals': return msg === keyword;
                case 'starts_with': return msg.startsWith(keyword);
                default: return msg.includes(keyword);
              }
            });
          } else {
            shouldTrigger = false;
          }
          break;

        case 'tag_added':
          // Verificar se a tag adicionada corresponde à configurada no trigger
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
        console.log(`[process-flow-triggers] Condições do trigger não satisfeitas para ${flow.name}`);
        continue;
      }

      // Verificar se já executou para este contato (se run_once_per_contact)
      if (flow.run_once_per_contact) {
        const { data: existingExecution } = await supabase
          .from('flow_executions')
          .select('id')
          .eq('flow_id', flow.id)
          .eq('contact_id', contact_id)
          .single();

        if (existingExecution) {
          console.log(`[process-flow-triggers] Fluxo ${flow.name} já executou para este contato`);
          continue;
        }
      }

      // Determinar canal para execução ANTES de criar conversa
      let actualChannelId = channel_id || null;
      let actualConversationId = conversation_id;

      // Se não tem canal definido, PRIORIZAR canal da conversa existente do contato
      if (!actualChannelId) {
        console.log('[process-flow-triggers] Canal não definido, buscando conversa existente do contato...');
        
        // PRIMEIRO: buscar conversa existente do contato para usar o mesmo canal
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id, channel_id')
          .eq('contact_id', contact_id)
          .in('status', ['open', 'pending'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (existingConv?.channel_id) {
          actualChannelId = existingConv.channel_id;
          actualConversationId = existingConv.id;
          console.log('[process-flow-triggers] ✅ Usando canal da conversa existente:', actualChannelId?.substring(0, 8));
        } else {
          // ÚLTIMO RECURSO: canal aleatório (só para contatos novos sem histórico)
          console.log('[process-flow-triggers] Nenhuma conversa existente, buscando canal aleatório...');
          
          const { data: availableChannels } = await supabase
            .from('whatsapp_channels')
            .select('id, name')
            .eq('tenant_id', tenant_id)
            .eq('status', 'connected')
            .eq('is_deleted', false);
          
          if (availableChannels && availableChannels.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableChannels.length);
            actualChannelId = availableChannels[randomIndex].id;
            console.log('[process-flow-triggers] Canal aleatório selecionado:', availableChannels[randomIndex].name);
          } else {
            console.log('[process-flow-triggers] ⚠️ Nenhum canal disponível para automação');
          }
        }
      }

      // Criar conversa se não existir (para redirect_lead e outros triggers)
      if (!actualConversationId && actualChannelId) {
        // Buscar conversa existente ou criar uma
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contact_id)
          .eq('channel_id', actualChannelId)
          .in('status', ['open', 'pending'])
          .single();

        if (existingConv) {
          actualConversationId = existingConv.id;
          console.log('[process-flow-triggers] Conversa existente encontrada:', actualConversationId?.substring(0, 8));
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
          actualConversationId = newConv.id;
          console.log('[process-flow-triggers] Nova conversa criada:', actualConversationId?.substring(0, 8));
        }
      } else if (!actualConversationId && !actualChannelId) {
        console.log('[process-flow-triggers] ⚠️ Sem canal disponível, não foi possível criar conversa');
      }

      // Criar execução do fluxo
      const { data: execution, error: execError } = await supabase
        .from('flow_executions')
        .insert({
          flow_id: flow.id,
          conversation_id: actualConversationId,
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
        console.error(`[process-flow-triggers] Erro ao criar execução para ${flow.name}:`, execError);
        continue;
      }

      console.log(`[process-flow-triggers] Execução criada: ${execution.id} para fluxo ${flow.name}`);

      // Atualizar estatísticas do fluxo
      const { data: currentFlow } = await supabase
        .from('chatbot_flows')
        .select('total_executions')
        .eq('id', flow.id)
        .single();

      await supabase
        .from('chatbot_flows')
        .update({ total_executions: (currentFlow?.total_executions || 0) + 1 })
        .eq('id', flow.id);

      // Buscar conexão do trigger para o próximo nó
      const { data: connection } = await supabase
        .from('flow_connections')
        .select('target_node_id')
        .eq('source_node_id', triggerNode.id)
        .single();

      if (connection) {
        // Chamar edge function para executar próximo nó
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

      triggeredCount++;
    }

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
