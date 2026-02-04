import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VERSION = '2026-02-04.1500';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReprocessRequest {
  tenant_id?: string;         // Opcional: se não informado, processa todos os tenants
  trigger_type?: 'message_key' | 'keyword' | 'all';
  days_back?: number;         // Padrão: 7
  batch_size?: number;        // Padrão: 50
  dry_run?: boolean;          // Padrão: false
  continue_from?: string;     // Para paginação: ID da última mensagem processada
}

interface FlowTriggerInfo {
  flow_id: string;
  flow_name: string;
  tenant_id: string;
  channel_ids: string[] | null;
  run_once_per_contact: boolean;
  trigger_subtype: string;
  trigger_node_id: string;
  keywords: string[];
  match_type: string;
  is_from_me: boolean; // message_key = true, keyword = false
}

interface ProcessingResult {
  success: boolean;
  dry_run: boolean;
  summary: {
    tenants_processed: number;
    flows_checked: number;
    messages_scanned: number;
    already_executed: number;
    triggers_fired: number;
    errors: number;
  };
  details: Array<{
    tenant_id: string;
    flow_name: string;
    keyword: string;
    messages_found: number;
    already_executed: number;
    triggered: number;
  }>;
  continue_from?: string;
  has_more?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Autenticação - verificar se é admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verificar se é super admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_super_admin) {
      return new Response(
        JSON.stringify({ success: false, error: 'Apenas super admins podem executar esta operação' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    const body: ReprocessRequest = await req.json();
    const {
      tenant_id,
      trigger_type = 'all',
      days_back = 7,
      batch_size = 50,
      dry_run = false,
      continue_from
    } = body;

    console.log(`[reprocess-missed-triggers v${VERSION}] Iniciando:`, {
      tenant_id: tenant_id || 'ALL',
      trigger_type,
      days_back,
      batch_size,
      dry_run,
      continue_from: continue_from?.substring(0, 8) || 'N/A'
    });

    // Calcular data limite
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days_back);
    const sinceDateStr = sinceDate.toISOString();

    // Buscar todos os fluxos ativos com triggers de keyword/message_key
    let flowsQuery = supabase
      .from('chatbot_flows')
      .select(`
        id,
        name,
        tenant_id,
        channel_ids,
        run_once_per_contact,
        flow_nodes!inner(id, node_subtype, config)
      `)
      .eq('is_active', true)
      .eq('flow_nodes.node_type', 'trigger');

    if (tenant_id) {
      flowsQuery = flowsQuery.eq('tenant_id', tenant_id);
    }

    const { data: flowsData, error: flowsError } = await flowsQuery;

    if (flowsError) {
      console.error('[reprocess-missed-triggers] Erro ao buscar fluxos:', flowsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar fluxos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Filtrar e mapear fluxos com triggers keyword/message_key
    const flows: FlowTriggerInfo[] = [];
    
    for (const flow of flowsData || []) {
      const triggerNode = Array.isArray(flow.flow_nodes) ? flow.flow_nodes[0] : flow.flow_nodes;
      if (!triggerNode) continue;

      const subtype = triggerNode.node_subtype as string;
      if (!['keyword', 'message_key'].includes(subtype)) continue;

      if (trigger_type !== 'all' && trigger_type !== subtype) continue;

      const config = triggerNode.config as Record<string, unknown>;
      const keywords = (config?.keywords as string[]) || [];
      
      if (keywords.length === 0) continue;

      flows.push({
        flow_id: flow.id,
        flow_name: flow.name,
        tenant_id: flow.tenant_id,
        channel_ids: flow.channel_ids as string[] | null,
        run_once_per_contact: flow.run_once_per_contact ?? false,
        trigger_subtype: subtype,
        trigger_node_id: triggerNode.id,
        keywords,
        match_type: (config?.match_type as string) || 'contains',
        is_from_me: subtype === 'message_key',
      });
    }

    console.log(`[reprocess-missed-triggers] ${flows.length} fluxos com triggers encontrados`);

    if (flows.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          dry_run,
          summary: {
            tenants_processed: 0,
            flows_checked: 0,
            messages_scanned: 0,
            already_executed: 0,
            triggers_fired: 0,
            errors: 0
          },
          details: []
        } as ProcessingResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Agrupar tenants únicos
    const uniqueTenants = [...new Set(flows.map(f => f.tenant_id))];
    
    const result: ProcessingResult = {
      success: true,
      dry_run,
      summary: {
        tenants_processed: uniqueTenants.length,
        flows_checked: flows.length,
        messages_scanned: 0,
        already_executed: 0,
        triggers_fired: 0,
        errors: 0
      },
      details: []
    };

    let lastMessageId: string | undefined;
    let processedCount = 0;

    // Processar cada fluxo
    for (const flow of flows) {
      console.log(`[reprocess-missed-triggers] Processando fluxo: ${flow.flow_name} (${flow.trigger_subtype})`);

      for (const keyword of flow.keywords) {
        // Buscar mensagens que correspondem a este keyword
        let messagesQuery = supabase
          .from('messages')
          .select(`
            id,
            content,
            conversation_id,
            conversations!inner(contact_id, channel_id, tenant_id)
          `)
          .eq('conversations.tenant_id', flow.tenant_id)
          .eq('is_from_me', flow.is_from_me)
          .or(`trigger_processed.is.null,trigger_processed.eq.false`)
          .gte('created_at', sinceDateStr)
          .ilike('content', `%${keyword}%`)
          .order('created_at', { ascending: true })
          .limit(batch_size);

        if (continue_from) {
          messagesQuery = messagesQuery.gt('id', continue_from);
        }

        // Filtrar por canal se configurado no fluxo
        if (flow.channel_ids && flow.channel_ids.length > 0) {
          messagesQuery = messagesQuery.in('conversations.channel_id', flow.channel_ids);
        }

        const { data: messages, error: messagesError } = await messagesQuery;

        if (messagesError) {
          console.error(`[reprocess-missed-triggers] Erro ao buscar mensagens para keyword "${keyword}":`, messagesError);
          result.summary.errors++;
          continue;
        }

        if (!messages || messages.length === 0) {
          continue;
        }

        result.summary.messages_scanned += messages.length;
        
        // Verificar match exato baseado no match_type
        const matchingMessages = messages.filter(msg => {
          const content = msg.content?.toLowerCase() || '';
          const kw = keyword.toLowerCase().trim();
          
          switch (flow.match_type) {
            case 'equals': return content === kw;
            case 'starts_with': return content.startsWith(kw);
            default: return content.includes(kw);
          }
        });

        if (matchingMessages.length === 0) {
          continue;
        }

        // Buscar execuções existentes para os contatos dessas mensagens
        const contactIds = [...new Set(matchingMessages.map(m => (m.conversations as any)?.contact_id).filter(Boolean))];
        
        let existingExecutions: Set<string> = new Set();
        if (flow.run_once_per_contact && contactIds.length > 0) {
          const { data: executions } = await supabase
            .from('flow_executions')
            .select('contact_id')
            .eq('flow_id', flow.flow_id)
            .in('contact_id', contactIds);
          
          existingExecutions = new Set((executions || []).map(e => e.contact_id));
        }

        let triggeredForKeyword = 0;
        let alreadyExecutedForKeyword = 0;

        for (const message of matchingMessages) {
          const conversation = message.conversations as any;
          const contactId = conversation?.contact_id;
          const channelId = conversation?.channel_id;
          
          if (!contactId) continue;

          lastMessageId = message.id;
          processedCount++;

          // Verificar se já foi executado
          if (flow.run_once_per_contact && existingExecutions.has(contactId)) {
            alreadyExecutedForKeyword++;
            result.summary.already_executed++;
            
            // Marcar como processado mesmo assim
            if (!dry_run) {
              await supabase
                .from('messages')
                .update({ trigger_processed: true })
                .eq('id', message.id);
            }
            continue;
          }

          if (dry_run) {
            triggeredForKeyword++;
            result.summary.triggers_fired++;
            continue;
          }

          // Disparar o trigger
          try {
            const { error: invokeError } = await supabase.functions.invoke('process-flow-triggers', {
              body: {
                trigger_type: flow.trigger_subtype,
                tenant_id: flow.tenant_id,
                contact_id: contactId,
                channel_id: channelId,
                conversation_id: message.conversation_id,
                message_content: message.content,
              }
            });

            if (invokeError) {
              console.error(`[reprocess-missed-triggers] Erro ao invocar trigger para mensagem ${message.id}:`, invokeError);
              result.summary.errors++;
            } else {
              triggeredForKeyword++;
              result.summary.triggers_fired++;
              
              // Marcar como processado
              await supabase
                .from('messages')
                .update({ trigger_processed: true })
                .eq('id', message.id);
            }

            // Rate limiting: pequeno delay entre chamadas
            await new Promise(resolve => setTimeout(resolve, 100));

          } catch (error) {
            console.error(`[reprocess-missed-triggers] Exceção ao processar mensagem ${message.id}:`, error);
            result.summary.errors++;
          }
        }

        if (matchingMessages.length > 0) {
          result.details.push({
            tenant_id: flow.tenant_id,
            flow_name: flow.flow_name,
            keyword,
            messages_found: matchingMessages.length,
            already_executed: alreadyExecutedForKeyword,
            triggered: triggeredForKeyword,
          });
        }

        // Verificar se atingiu o batch_size
        if (processedCount >= batch_size) {
          result.has_more = true;
          result.continue_from = lastMessageId;
          break;
        }
      }

      if (processedCount >= batch_size) {
        break;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[reprocess-missed-triggers] Concluído em ${duration}ms:`, result.summary);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[reprocess-missed-triggers] Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno', message: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
