import { supabase } from '@/integrations/supabase/client';

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
  contact?: { full_name: string | null; phone: string; email?: string } | null;
}

export class FlowEngine {
  
  // Verificar triggers quando mensagem chega
  async checkTriggers(
    messageContent: string,
    conversationId: string,
    contactId: string,
    channelId: string,
    isNewContact: boolean = false
  ) {
    // Buscar fluxos ativos
    const { data: flows } = await supabase
      .from('chatbot_flows')
      .select('id, channel_ids')
      .eq('is_active', true);
    
    // Filtrar fluxos pelo canal
    const matchingFlows = (flows || []).filter(flow => {
      const channelIds = flow.channel_ids as string[] | null;
      return !channelIds || channelIds.length === 0 || channelIds.includes(channelId);
    });
    
    for (const flow of matchingFlows) {
      // Buscar trigger node
      const { data: triggerNode } = await supabase
        .from('flow_nodes')
        .select('*')
        .eq('flow_id', flow.id)
        .eq('node_type', 'trigger')
        .single();
      
      if (!triggerNode) continue;
      
      // Verificar se trigger corresponde
      const shouldTrigger = this.evaluateTrigger(triggerNode as FlowNode, messageContent, isNewContact);
      
      if (shouldTrigger) {
        await this.startExecution(flow.id, conversationId, contactId, channelId, messageContent);
      }
    }
  }
  
  evaluateTrigger(node: FlowNode, messageContent: string, isNewContact: boolean): boolean {
    const config = node.config;
    
    switch (node.node_subtype) {
      case 'keyword':
        const keywords = (config?.keywords as string[]) || [];
        const matchType = (config?.match_type as string) || 'contains';
        
        return keywords.some((kw: string) => {
          const msg = messageContent.toLowerCase();
          const keyword = kw.toLowerCase();
          
          switch (matchType) {
            case 'equals': return msg === keyword;
            case 'starts_with': return msg.startsWith(keyword);
            default: return msg.includes(keyword);
          }
        });
        
      case 'new_contact':
        return isNewContact;
        
      case 'first_message':
        return true; // TODO: Check if it's actually first message
        
      default:
        return false;
    }
  }
  
  async startExecution(
    flowId: string,
    conversationId: string,
    contactId: string,
    channelId: string,
    triggerMessage: string
  ) {
    // Verificar se já existe execução ativa para essa conversa
    const { data: existingExecution } = await supabase
      .from('flow_executions')
      .select('id')
      .eq('flow_id', flowId)
      .eq('conversation_id', conversationId)
      .eq('status', 'running')
      .single();
    
    if (existingExecution) {
      console.log('Flow already running for this conversation');
      return;
    }
    
    // Criar execução
    const { data: execution } = await supabase
      .from('flow_executions')
      .insert({
        flow_id: flowId,
        conversation_id: conversationId,
        contact_id: contactId,
        channel_id: channelId,
        status: 'running',
        variables: { mensagem_original: triggerMessage },
      })
      .select()
      .single();
    
    if (!execution) return;
    
    // Atualizar estatísticas
    await supabase
      .from('chatbot_flows')
      .update({ total_executions: (flow?.total_executions || 0) + 1 })
      .eq('id', flowId);
    
    // Buscar primeiro nó após trigger
    const { data: triggerNode } = await supabase
      .from('flow_nodes')
      .select('id')
      .eq('flow_id', flowId)
      .eq('node_type', 'trigger')
      .single();
    
    if (!triggerNode) return;
    
    // Buscar conexão do trigger
    const { data: connection } = await supabase
      .from('flow_connections')
      .select('target_node_id')
      .eq('source_node_id', triggerNode.id)
      .single();
    
    if (connection) {
      await this.executeNode(execution.id, connection.target_node_id);
    }
  }
  
  async executeNode(executionId: string, nodeId: string) {
    // Buscar nó
    const { data: node } = await supabase
      .from('flow_nodes')
      .select('*')
      .eq('id', nodeId)
      .single();
    
    if (!node) return;
    
    // Buscar execução com dados do contato
    const { data: execution } = await supabase
      .from('flow_executions')
      .select(`
        *,
        contact:contacts(full_name, phone, email)
      `)
      .eq('id', executionId)
      .single();
    
    if (!execution) return;
    
    // Atualizar nó atual
    await supabase
      .from('flow_executions')
      .update({ 
        current_node_id: nodeId,
        last_activity_at: new Date().toISOString()
      })
      .eq('id', executionId);
    
    // Log
    await this.logExecution(executionId, nodeId, 'info', `Executando nó: ${node.node_subtype}`);
    
    const flowNode = node as unknown as FlowNode;
    
    // Executar baseado no tipo
    switch (flowNode.node_type) {
      case 'action':
        await this.executeAction(execution as FlowExecution, flowNode);
        break;
      case 'condition':
        const result = await this.evaluateCondition(execution as FlowExecution, flowNode);
        // Buscar próximo nó baseado no resultado
        const handleId = result ? 'yes' : 'no';
        const { data: condConnection } = await supabase
          .from('flow_connections')
          .select('target_node_id')
          .eq('source_node_id', nodeId)
          .eq('source_handle', handleId)
          .single();
        
        if (condConnection) {
          await this.executeNode(executionId, condConnection.target_node_id);
        }
        return;
      case 'delay':
        await this.executeDelay(executionId, flowNode);
        return; // Delay interrompe execução
      case 'end':
        await supabase
          .from('flow_executions')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', executionId);
        await this.logExecution(executionId, nodeId, 'info', 'Fluxo finalizado');
        return;
    }
    
    // Buscar próximo nó (para nós que não são condition)
    const { data: nextConnection } = await supabase
      .from('flow_connections')
      .select('target_node_id')
      .eq('source_node_id', nodeId)
      .single();
    
    if (nextConnection) {
      await this.executeNode(executionId, nextConnection.target_node_id);
    } else {
      // Finalizar
      await supabase
        .from('flow_executions')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', executionId);
    }
  }
  
  async executeAction(execution: FlowExecution, node: FlowNode) {
    const config = node.config;
    
    switch (node.node_subtype) {
      case 'send_text':
        // Substituir variáveis
        let message = (config.message as string) || '';
        message = message.replace(/\{\{nome\}\}/g, execution.contact?.full_name || '');
        message = message.replace(/\{\{telefone\}\}/g, execution.contact?.phone || '');
        message = message.replace(/\{\{email\}\}/g, execution.contact?.email || '');
        
        // TODO: Integrar com WhatsApp service
        console.log('Sending message:', message);
        
        await this.logExecution(execution.id, node.id, 'info', 
          `Mensagem enviada: ${message.substring(0, 50)}...`);
        break;
        
      case 'add_tag':
        if (config.tag_id) {
          await supabase.from('contact_tags').upsert({
            contact_id: execution.contact_id,
            tag_id: config.tag_id as string,
          }, { onConflict: 'contact_id,tag_id' });
          await this.logExecution(execution.id, node.id, 'info', 'Tag adicionada');
        }
        break;
        
      case 'remove_tag':
        if (config.tag_id) {
          await supabase.from('contact_tags')
            .delete()
            .eq('contact_id', execution.contact_id)
            .eq('tag_id', config.tag_id as string);
          await this.logExecution(execution.id, node.id, 'info', 'Tag removida');
        }
        break;
        
      case 'set_lead_status':
        if (config.status) {
          await supabase
            .from('contacts')
            .update({ lead_status: config.status as string })
            .eq('id', execution.contact_id);
          await this.logExecution(execution.id, node.id, 'info', 
            `Status alterado para: ${config.status}`);
        }
        break;
        
      case 'assign_agent':
        if (config.user_id) {
          await supabase
            .from('conversations')
            .update({ assigned_to: config.user_id as string })
            .eq('id', execution.conversation_id);
          await this.logExecution(execution.id, node.id, 'info', 'Atendente atribuído');
        }
        break;
        
      case 'transfer_department':
        if (config.department_id) {
          await supabase
            .from('conversations')
            .update({ 
              department_id: config.department_id as string,
              assigned_to: null 
            })
            .eq('id', execution.conversation_id);
          await this.logExecution(execution.id, node.id, 'info', 'Transferido para departamento');
        }
        break;
        
      case 'close_conversation':
        await supabase
          .from('conversations')
          .update({ 
            status: 'closed',
            closed_at: new Date().toISOString()
          })
          .eq('id', execution.conversation_id);
        await this.logExecution(execution.id, node.id, 'info', 'Conversa fechada');
        break;
        
      case 'add_note':
        if (config.note) {
          const { data: { user } } = await supabase.auth.getUser();
          await supabase.from('internal_notes').insert({
            conversation_id: execution.conversation_id,
            content: config.note as string,
            author_id: user?.id || execution.contact_id,
          });
          await this.logExecution(execution.id, node.id, 'info', 'Nota adicionada');
        }
        break;
        
      case 'http_request':
        try {
          const response = await fetch(config.url as string, {
            method: (config.method as string) || 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config.body || {}),
          });
          await this.logExecution(execution.id, node.id, 'info', 
            `Webhook chamado: ${response.status}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Erro desconhecido';
          await this.logExecution(execution.id, node.id, 'error', 
            `Erro no webhook: ${message}`);
        }
        break;
    }
  }
  
  async evaluateCondition(execution: FlowExecution, node: FlowNode): Promise<boolean> {
    const config = node.config;
    const variable = config.variable as string;
    const operator = config.operator as string;
    const value = config.value as string;
    
    // Resolver variável
    let actualValue = '';
    switch (variable) {
      case '{{nome}}':
        actualValue = execution.contact?.full_name || '';
        break;
      case '{{telefone}}':
        actualValue = execution.contact?.phone || '';
        break;
      case '{{mensagem}}':
        actualValue = (execution.variables?.mensagem_original as string) || '';
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
    
    // Avaliar operador
    switch (operator) {
      case 'equals':
        return actualValue.toLowerCase() === value.toLowerCase();
      case 'not_equals':
        return actualValue.toLowerCase() !== value.toLowerCase();
      case 'contains':
        return actualValue.toLowerCase().includes(value.toLowerCase());
      case 'not_contains':
        return !actualValue.toLowerCase().includes(value.toLowerCase());
      case 'starts_with':
        return actualValue.toLowerCase().startsWith(value.toLowerCase());
      case 'is_empty':
        return !actualValue || actualValue.trim() === '';
      case 'is_not_empty':
        return !!actualValue && actualValue.trim() !== '';
      default:
        return false;
    }
  }
  
  async executeDelay(executionId: string, node: FlowNode) {
    const config = node.config;
    
    switch (node.node_subtype) {
      case 'wait_time':
        const amount = (config.amount as number) || 5;
        const unit = (config.unit as string) || 'seconds';
        
        let milliseconds = amount * 1000;
        if (unit === 'minutes') milliseconds *= 60;
        if (unit === 'hours') milliseconds *= 3600;
        
        const waitingUntil = new Date(Date.now() + milliseconds);
        
        await supabase
          .from('flow_executions')
          .update({ 
            status: 'waiting_delay',
            waiting_until: waitingUntil.toISOString(),
          })
          .eq('id', executionId);
        break;
        
      case 'wait_reply':
        await supabase
          .from('flow_executions')
          .update({ 
            status: 'waiting_reply',
            waiting_for: 'reply',
          })
          .eq('id', executionId);
        break;
    }
  }
  
  async logExecution(executionId: string, nodeId: string, logType: string, message: string) {
    await supabase.from('flow_execution_logs').insert({
      execution_id: executionId,
      node_id: nodeId,
      log_type: logType,
      message: message,
    });
  }
  
  // Continuar execuções após delay
  async processDelayedExecutions() {
    const { data: executions } = await supabase
      .from('flow_executions')
      .select('*')
      .eq('status', 'waiting_delay')
      .lt('waiting_until', new Date().toISOString());
    
    for (const execution of executions || []) {
      if (execution.current_node_id) {
        // Buscar próximo nó
        const { data: connection } = await supabase
          .from('flow_connections')
          .select('target_node_id')
          .eq('source_node_id', execution.current_node_id)
          .single();
        
        if (connection) {
          await supabase
            .from('flow_executions')
            .update({ status: 'running' })
            .eq('id', execution.id);
          
          await this.executeNode(execution.id, connection.target_node_id);
        }
      }
    }
  }
  
  // Continuar execução quando cliente responder
  async handleReply(conversationId: string, messageContent: string) {
    const { data: execution } = await supabase
      .from('flow_executions')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('status', 'waiting_reply')
      .single();
    
    if (!execution || !execution.current_node_id) return;
    
    // Atualizar variáveis
    await supabase
      .from('flow_executions')
      .update({ 
        status: 'running',
        variables: { 
          ...execution.variables as Record<string, unknown>,
          ultima_resposta: messageContent 
        },
      })
      .eq('id', execution.id);
    
    // Buscar próximo nó
    const { data: connection } = await supabase
      .from('flow_connections')
      .select('target_node_id')
      .eq('source_node_id', execution.current_node_id)
      .single();
    
    if (connection) {
      await this.executeNode(execution.id, connection.target_node_id);
    }
  }
}

export const flowEngine = new FlowEngine();
