import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExecuteNodeRequest {
  execution_id: string;
  node_id: string;
}

interface FlowNode {
  id: string;
  flow_id: string;
  node_type: string;
  node_subtype: string;
  config: Record<string, unknown>;
}

interface FlowExecution {
  id: string;
  flow_id: string;
  conversation_id: string;
  contact_id: string;
  channel_id: string;
  variables: Record<string, unknown>;
  tenant_id: string;
  contact?: {
    full_name: string | null;
    phone: string;
    email?: string;
    cpf_cnpj?: string | null;
    birth_date?: string | null;
    zip_code?: string | null;
    street?: string | null;
    number?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    lead_status?: string | null;
    origin?: string | null;
    notes?: string | null;
    lead_score?: number | null;
    negotiated_value?: number | null;
  } | null;
}

function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function getDayOfWeek(date: Date): string {
  const days = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  return days[date.getDay()];
}

function replaceVariables(text: string, execution: FlowExecution): string {
  const now = new Date();
  const contact = execution.contact;
  const fullName = contact?.full_name || '';
  const firstName = fullName.split(' ')[0] || '';

  return text
    // Variáveis em português
    .replace(/\{\{nome\}\}/g, fullName)
    .replace(/\{\{primeiro_nome\}\}/g, firstName)
    .replace(/\{\{telefone\}\}/g, contact?.phone || '')
    .replace(/\{\{email\}\}/g, contact?.email || '')
    .replace(/\{\{data\}\}/g, formatDate(now))
    .replace(/\{\{hora\}\}/g, formatTime(now))
    .replace(/\{\{dia_semana\}\}/g, getDayOfWeek(now))
    .replace(/\{\{ultima_resposta\}\}/g, (execution.variables?.ultima_resposta as string) || '')
    .replace(/\{\{mensagem_original\}\}/g, (execution.variables?.mensagem_original as string) || '')
    // Variáveis em inglês (do WebhookBodyFields)
    .replace(/\{\{full_name\}\}/g, fullName)
    .replace(/\{\{first_name\}\}/g, firstName)
    .replace(/\{\{phone\}\}/g, contact?.phone || '')
    .replace(/\{\{cpf_cnpj\}\}/g, contact?.cpf_cnpj || '')
    .replace(/\{\{birth_date\}\}/g, contact?.birth_date || '')
    .replace(/\{\{zip_code\}\}/g, contact?.zip_code || '')
    .replace(/\{\{street\}\}/g, contact?.street || '')
    .replace(/\{\{number\}\}/g, contact?.number || '')
    .replace(/\{\{complement\}\}/g, contact?.complement || '')
    .replace(/\{\{neighborhood\}\}/g, contact?.neighborhood || '')
    .replace(/\{\{city\}\}/g, contact?.city || '')
    .replace(/\{\{state\}\}/g, contact?.state || '')
    .replace(/\{\{country\}\}/g, contact?.country || '')
    .replace(/\{\{lead_status\}\}/g, contact?.lead_status || '')
    .replace(/\{\{origin\}\}/g, contact?.origin || '')
    .replace(/\{\{notes\}\}/g, contact?.notes || '')
    .replace(/\{\{lead_score\}\}/g, String(contact?.lead_score ?? ''))
    .replace(/\{\{negotiated_value\}\}/g, String(contact?.negotiated_value ?? ''));
}

async function logExecution(
  supabase: any,
  executionId: string,
  nodeId: string,
  logType: string,
  message: string
) {
  try {
    await supabase.from('flow_execution_logs').insert({
      execution_id: executionId,
      node_id: nodeId,
      log_type: logType,
      message: message,
    });
  } catch (e) {
    console.error('[logExecution] Erro:', e);
  }
}

async function sendWhatsAppMessage(
  supabase: any,
  channelId: string,
  phone: string,
  content: string,
  type: 'text' | 'image' | 'audio' | 'video' | 'document' = 'text',
  mediaUrl?: string,
  filename?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    console.log('[execute-flow-node] Enviando mensagem WhatsApp:', { channelId: channelId?.substring(0, 8), phone, type });
    
    const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
      body: {
        action: 'send',
        channelId,
        phone,
        content,
        type,
        mediaUrl,
        filename
      }
    });
    
    if (error) {
      console.error('[execute-flow-node] WhatsApp send error:', error);
      return { success: false, error: error.message || 'Erro ao invocar whatsapp-instance' };
    }
    
    console.log('[execute-flow-node] WhatsApp send response:', data);
    return { success: data?.success ?? true, messageId: data?.messageId, error: data?.error };
  } catch (err) {
    console.error('[execute-flow-node] WhatsApp send exception:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Erro desconhecido' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ExecuteNodeRequest = await req.json();
    const { execution_id, node_id } = body;

    console.log('[execute-flow-node] Executando nó:', { execution_id: execution_id?.substring(0, 8), node_id: node_id?.substring(0, 8) });

    // Buscar nó
    const { data: node, error: nodeError } = await supabase
      .from('flow_nodes')
      .select('*')
      .eq('id', node_id)
      .single();

    if (nodeError || !node) {
      console.error('[execute-flow-node] Nó não encontrado:', nodeError);
      return new Response(
        JSON.stringify({ success: false, error: 'Nó não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Buscar execução com dados do contato (incluindo campos extras para variáveis)
    const { data: execution, error: execError } = await supabase
      .from('flow_executions')
      .select(`
        *,
        contact:contacts(full_name, phone, email, cpf_cnpj, birth_date, zip_code, street, number, complement, neighborhood, city, state, country, lead_status, origin, notes, lead_score, negotiated_value)
      `)
      .eq('id', execution_id)
      .single();

    if (execError || !execution) {
      console.error('[execute-flow-node] Execução não encontrada:', execError);
      return new Response(
        JSON.stringify({ success: false, error: 'Execução não encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Atualizar nó atual
    await supabase
      .from('flow_executions')
      .update({
        current_node_id: node_id,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', execution_id);

    const flowNode = node as unknown as FlowNode;
    const config = flowNode.config || {};

    await logExecution(supabase, execution_id, node_id, 'info', `Executando nó: ${flowNode.node_subtype}`);

    // Executar baseado no tipo
    switch (flowNode.node_type) {
      case 'action':
        await executeAction(supabase, execution as FlowExecution, flowNode);
        break;

      case 'condition':
        const result = await evaluateCondition(supabase, execution as FlowExecution, flowNode);
        const handleId = result ? 'yes' : 'no';

        const { data: condConnection } = await supabase
          .from('flow_connections')
          .select('target_node_id')
          .eq('source_node_id', node_id)
          .eq('source_handle', handleId)
          .single();

        if (condConnection) {
          // Chamar recursivamente
          await supabase.functions.invoke('execute-flow-node', {
            body: { execution_id, node_id: condConnection.target_node_id }
          });
        } else {
          await finishExecution(supabase, execution_id, node_id);
        }
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'delay':
        await executeDelay(supabase, execution_id, flowNode);
        return new Response(
          JSON.stringify({ success: true, waiting: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      case 'end':
        await finishExecution(supabase, execution_id, node_id);
        return new Response(
          JSON.stringify({ success: true, completed: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Buscar próximo nó
    const { data: nextConnection } = await supabase
      .from('flow_connections')
      .select('target_node_id')
      .eq('source_node_id', node_id)
      .is('source_handle', null)
      .single();

    if (!nextConnection) {
      // Tentar buscar sem filtro de handle
      const { data: anyConnection } = await supabase
        .from('flow_connections')
        .select('target_node_id')
        .eq('source_node_id', node_id)
        .limit(1)
        .single();

      if (anyConnection) {
        await supabase.functions.invoke('execute-flow-node', {
          body: { execution_id, node_id: anyConnection.target_node_id }
        });
      } else {
        await finishExecution(supabase, execution_id, node_id);
      }
    } else {
      await supabase.functions.invoke('execute-flow-node', {
        body: { execution_id, node_id: nextConnection.target_node_id }
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[execute-flow-node] Erro geral:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function finishExecution(
  supabase: any,
  executionId: string,
  nodeId: string
) {
  await supabase
    .from('flow_executions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', executionId);

  // Atualizar estatísticas do fluxo
  const { data: exec } = await supabase
    .from('flow_executions')
    .select('flow_id')
    .eq('id', executionId)
    .single();

  if (exec) {
    const { data: flow } = await supabase
      .from('chatbot_flows')
      .select('total_completions')
      .eq('id', exec.flow_id)
      .single();

    await supabase
      .from('chatbot_flows')
      .update({ total_completions: (flow?.total_completions || 0) + 1 })
      .eq('id', exec.flow_id);
  }

  await logExecution(supabase, executionId, nodeId, 'info', 'Fluxo finalizado');
}

async function executeAction(
  supabase: any,
  execution: FlowExecution,
  node: FlowNode
) {
  const config = node.config;

  switch (node.node_subtype) {
    case 'send_text': {
      let channelId = execution.channel_id;
      
      // Fallback: se não tem canal, buscar um aleatório
      if (!channelId) {
        console.log('[execute-flow-node] Canal não definido na execução, buscando aleatório...');
        const { data: channels } = await supabase
          .from('whatsapp_channels')
          .select('id, name')
          .eq('tenant_id', execution.tenant_id)
          .eq('status', 'connected')
          .eq('is_deleted', false);
        
        if (channels && channels.length > 0) {
          const randomIndex = Math.floor(Math.random() * channels.length);
          channelId = channels[randomIndex].id;
          console.log('[execute-flow-node] Canal aleatório selecionado:', channels[randomIndex].name);
          
          // Atualizar execução com o canal selecionado
          await supabase
            .from('flow_executions')
            .update({ channel_id: channelId })
            .eq('id', execution.id);
        }
      }
      
      if (!channelId) {
        await logExecution(supabase, execution.id, node.id, 'error',
          'Nenhum canal WhatsApp disponível para enviar mensagem');
        break;
      }

      let message = (config.message as string) || '';
      message = replaceVariables(message, execution);

      const textResult = await sendWhatsAppMessage(
        supabase,
        channelId,
        execution.contact?.phone || '',
        message,
        'text'
      );

      if (textResult.success) {
        // Salvar mensagem no histórico
        await supabase.from('messages').insert({
          conversation_id: execution.conversation_id,
          content: message,
          sender_type: 'system',
          message_type: 'text',
          whatsapp_message_id: textResult.messageId,
          status: 'sent',
          tenant_id: execution.tenant_id
        });
        await logExecution(supabase, execution.id, node.id, 'info',
          `Mensagem enviada: ${message.substring(0, 50)}...`);
      } else {
        await logExecution(supabase, execution.id, node.id, 'error',
          `Erro ao enviar mensagem: ${textResult.error}`);
      }
      break;
    }

    case 'send_image':
    case 'send_video':
    case 'send_audio':
    case 'send_document': {
      let mediaChannelId = execution.channel_id;
      
      // Fallback: se não tem canal, buscar um aleatório
      if (!mediaChannelId) {
        console.log('[execute-flow-node] Canal não definido para mídia, buscando aleatório...');
        const { data: channels } = await supabase
          .from('whatsapp_channels')
          .select('id, name')
          .eq('tenant_id', execution.tenant_id)
          .eq('status', 'connected')
          .eq('is_deleted', false);
        
        if (channels && channels.length > 0) {
          const randomIndex = Math.floor(Math.random() * channels.length);
          mediaChannelId = channels[randomIndex].id;
          console.log('[execute-flow-node] Canal aleatório para mídia:', channels[randomIndex].name);
          
          await supabase
            .from('flow_executions')
            .update({ channel_id: mediaChannelId })
            .eq('id', execution.id);
        }
      }
      
      if (!mediaChannelId) {
        await logExecution(supabase, execution.id, node.id, 'error',
          'Nenhum canal WhatsApp disponível para enviar mídia');
        break;
      }

      const mediaType = node.node_subtype.replace('send_', '') as 'image' | 'video' | 'audio' | 'document';
      const mediaUrl = (config.media_url as string) || (config.url as string) || '';
      let caption = (config.caption as string) || '';
      caption = replaceVariables(caption, execution);

      const mediaResult = await sendWhatsAppMessage(
        supabase,
        mediaChannelId,
        execution.contact?.phone || '',
        caption,
        mediaType,
        mediaUrl,
        config.filename as string
      );

      if (mediaResult.success) {
        await supabase.from('messages').insert({
          conversation_id: execution.conversation_id,
          content: caption || `[${mediaType}]`,
          sender_type: 'system',
          message_type: mediaType,
          media_url: mediaUrl,
          whatsapp_message_id: mediaResult.messageId,
          status: 'sent',
          tenant_id: execution.tenant_id
        });
        await logExecution(supabase, execution.id, node.id, 'info',
          `${mediaType} enviado com sucesso`);
      } else {
        await logExecution(supabase, execution.id, node.id, 'error',
          `Erro ao enviar ${mediaType}: ${mediaResult.error}`);
      }
      break;
    }

    case 'add_tag':
      if (config.tag_id) {
        await supabase.from('contact_tags').upsert({
          contact_id: execution.contact_id,
          tag_id: config.tag_id as string,
          tenant_id: execution.tenant_id,
        }, { onConflict: 'contact_id,tag_id' });
        await logExecution(supabase, execution.id, node.id, 'info', 'Tag adicionada');
      }
      break;

    case 'remove_tag':
      if (config.tag_id) {
        await supabase.from('contact_tags')
          .delete()
          .eq('contact_id', execution.contact_id)
          .eq('tag_id', config.tag_id as string);
        await logExecution(supabase, execution.id, node.id, 'info', 'Tag removida');
      }
      break;

    case 'set_lead_status':
      if (config.status) {
        await supabase
          .from('contacts')
          .update({ lead_status: config.status as string })
          .eq('id', execution.contact_id);
        await logExecution(supabase, execution.id, node.id, 'info',
          `Status alterado para: ${config.status}`);
      }
      break;

    case 'assign_agent':
      if (config.user_id && execution.conversation_id) {
        await supabase
          .from('conversations')
          .update({ assigned_to: config.user_id as string })
          .eq('id', execution.conversation_id);
        await logExecution(supabase, execution.id, node.id, 'info', 'Atendente atribuído');
      }
      break;

    case 'transfer_department':
      if (config.department_id && execution.conversation_id) {
        await supabase
          .from('conversations')
          .update({
            department_id: config.department_id as string,
            assigned_to: null
          })
          .eq('id', execution.conversation_id);
        await logExecution(supabase, execution.id, node.id, 'info', 'Transferido para departamento');
      }
      break;

    case 'close_conversation':
      if (execution.conversation_id) {
        await supabase
          .from('conversations')
          .update({
            status: 'closed',
            closed_at: new Date().toISOString()
          })
          .eq('id', execution.conversation_id);
        await logExecution(supabase, execution.id, node.id, 'info', 'Conversa fechada');
      }
      break;

    case 'add_note':
      if (config.note && execution.conversation_id) {
        let noteContent = config.note as string;
        noteContent = replaceVariables(noteContent, execution);

        await supabase.from('internal_notes').insert({
          conversation_id: execution.conversation_id,
          content: noteContent,
          tenant_id: execution.tenant_id,
        });
        await logExecution(supabase, execution.id, node.id, 'info', 'Nota adicionada');
      }
      break;

    case 'http_request':
      try {
        const bodyData = config.body as Record<string, unknown> || {};
        
        // Substituir variáveis em cada valor string do body
        const processedBody: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(bodyData)) {
          if (typeof value === 'string') {
            processedBody[key] = replaceVariables(value, execution);
          } else {
            processedBody[key] = value;
          }
        }
        
        // Adicionar dados do contato e execução ao body
        const enrichedBody = {
          ...processedBody,
          contact_id: execution.contact_id,
          contact_phone: execution.contact?.phone,
          contact_name: execution.contact?.full_name,
          conversation_id: execution.conversation_id,
          variables: execution.variables,
        };

        const response = await fetch(config.url as string, {
          method: (config.method as string) || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(enrichedBody),
        });

        await logExecution(supabase, execution.id, node.id, 'info',
          `Webhook chamado: ${response.status}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        await logExecution(supabase, execution.id, node.id, 'error',
          `Erro no webhook: ${errorMessage}`);
      }
      break;
  }
}

async function evaluateCondition(
  supabase: any,
  execution: FlowExecution,
  node: FlowNode
): Promise<boolean> {
  const config = node.config;
  const variable = config.variable as string;
  const operator = config.operator as string;
  const value = config.value as string;

  let actualValue = '';
  switch (variable) {
    case '{{nome}}':
      actualValue = execution.contact?.full_name || '';
      break;
    case '{{primeiro_nome}}':
      actualValue = (execution.contact?.full_name || '').split(' ')[0] || '';
      break;
    case '{{telefone}}':
      actualValue = execution.contact?.phone || '';
      break;
    case '{{mensagem}}':
      actualValue = (execution.variables?.mensagem_original as string) || '';
      break;
    case '{{ultima_resposta}}':
      actualValue = (execution.variables?.ultima_resposta as string) || '';
      break;
    case '{{lead_status}}':
      const { data: contact } = await supabase
        .from('contacts')
        .select('lead_status')
        .eq('id', execution.contact_id)
        .single();
      actualValue = contact?.lead_status || '';
      break;
  }

  switch (operator) {
    case 'equals':
      return actualValue.toLowerCase() === (value || '').toLowerCase();
    case 'not_equals':
      return actualValue.toLowerCase() !== (value || '').toLowerCase();
    case 'contains':
      return actualValue.toLowerCase().includes((value || '').toLowerCase());
    case 'not_contains':
      return !actualValue.toLowerCase().includes((value || '').toLowerCase());
    case 'starts_with':
      return actualValue.toLowerCase().startsWith((value || '').toLowerCase());
    case 'is_empty':
      return !actualValue || actualValue.trim() === '';
    case 'is_not_empty':
      return !!actualValue && actualValue.trim() !== '';
    default:
      return false;
  }
}

async function executeDelay(
  supabase: any,
  executionId: string,
  node: FlowNode
) {
  const config = node.config;

  switch (node.node_subtype) {
    case 'wait_time':
      const amount = (config.amount as number) || 5;
      const unit = (config.unit as string) || 'seconds';

      let milliseconds = amount * 1000;
      if (unit === 'minutes') milliseconds *= 60;
      if (unit === 'hours') milliseconds *= 3600;

      const waitingUntilTime = new Date(Date.now() + milliseconds);

      await supabase
        .from('flow_executions')
        .update({
          status: 'waiting_delay',
          waiting_until: waitingUntilTime.toISOString(),
        })
        .eq('id', executionId);

      await logExecution(supabase, executionId, node.id, 'info',
        `Aguardando ${amount} ${unit}`);
      break;

    case 'wait_reply':
      const timeoutMinutes = (config.timeout_minutes as number) || 60;
      const waitingUntilReply = new Date(Date.now() + timeoutMinutes * 60 * 1000);

      await supabase
        .from('flow_executions')
        .update({
          status: 'waiting_reply',
          waiting_for: 'reply',
          waiting_until: waitingUntilReply.toISOString(),
        })
        .eq('id', executionId);

      await logExecution(supabase, executionId, node.id, 'info',
        `Aguardando resposta (timeout: ${timeoutMinutes} min)`);
      break;
  }
}
