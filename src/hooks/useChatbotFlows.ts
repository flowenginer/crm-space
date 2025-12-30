import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ChatbotFlow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_draft: boolean;
  channel_ids: string[];
  run_once_per_contact: boolean;
  priority: number;
  total_executions: number;
  total_completions: number;
  total_errors: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  nodes?: { count: number }[];
  creator?: { full_name: string | null } | null;
}

export interface FlowNode {
  id: string;
  flow_id: string;
  name: string | null;
  node_type: string;
  node_subtype: string;
  position_x: number;
  position_y: number;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FlowConnection {
  id: string;
  flow_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string;
  created_at: string;
}

export interface FlowNodeTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  node_type: string;
  node_subtype: string;
  default_config: Record<string, unknown>;
  icon: string | null;
  color: string | null;
  is_system: boolean;
  created_at: string;
}

export interface FlowExecution {
  id: string;
  flow_id: string | null;
  conversation_id: string | null;
  contact_id: string | null;
  channel_id: string | null;
  current_node_id: string | null;
  status: string;
  variables: Record<string, unknown>;
  waiting_until: string | null;
  waiting_for: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  last_activity_at: string;
  contact?: { full_name: string | null; phone: string } | null;
}

// Listar fluxos
export function useChatbotFlows() {
  return useQuery({
    queryKey: ['chatbot-flows'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_flows')
        .select(`
          *,
          nodes:flow_nodes(count),
          creator:profiles!chatbot_flows_created_by_fkey(full_name)
        `)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as ChatbotFlow[];
    },
    staleTime: 30000,
  });
}

// Buscar fluxo por ID
export function useChatbotFlow(flowId: string | null) {
  return useQuery({
    queryKey: ['chatbot-flow', flowId],
    queryFn: async () => {
      if (!flowId) return null;
      
      const { data, error } = await supabase
        .from('chatbot_flows')
        .select('*')
        .eq('id', flowId)
        .single();
      
      if (error) throw error;
      return data as ChatbotFlow;
    },
    enabled: !!flowId,
  });
}

// Buscar nós do fluxo
export function useFlowNodes(flowId: string | null) {
  return useQuery({
    queryKey: ['flow-nodes', flowId],
    queryFn: async () => {
      if (!flowId) return [];
      
      const { data, error } = await supabase
        .from('flow_nodes')
        .select('*')
        .eq('flow_id', flowId)
        .order('created_at');
      
      if (error) throw error;
      return (data || []) as FlowNode[];
    },
    enabled: !!flowId,
  });
}

// Buscar conexões do fluxo
export function useFlowConnections(flowId: string | null) {
  return useQuery({
    queryKey: ['flow-connections', flowId],
    queryFn: async () => {
      if (!flowId) return [];
      
      const { data, error } = await supabase
        .from('flow_connections')
        .select('*')
        .eq('flow_id', flowId);
      
      if (error) throw error;
      return (data || []) as FlowConnection[];
    },
    enabled: !!flowId,
  });
}

// Buscar templates de nós
export function useNodeTemplates() {
  return useQuery({
    queryKey: ['node-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flow_node_templates')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      
      if (error) throw error;
      return (data || []) as FlowNodeTemplate[];
    },
    staleTime: 300000, // 5 minutos
  });
}

// Criar fluxo
export function useCreateFlow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Buscar tenant_id do usuário para garantir isolamento por tenant
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      
      const { data: flow, error } = await supabase
        .from('chatbot_flows')
        .insert({
          name: data.name,
          description: data.description || null,
          created_by: user?.id || null,
          tenant_id: tenantId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return flow as ChatbotFlow;
    },
    onSuccess: () => {
      toast.success('Fluxo criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar fluxo: ' + error.message);
    },
  });
}

// Atualizar fluxo
export function useUpdateFlow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; is_active?: boolean }) => {
      const { error } = await supabase
        .from('chatbot_flows')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] });
    },
  });
}

// Duplicar fluxo
export function useDuplicateFlow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (flowId: string) => {
      // Buscar fluxo original
      const { data: original } = await supabase
        .from('chatbot_flows')
        .select('*')
        .eq('id', flowId)
        .single();
      
      if (!original) throw new Error('Fluxo não encontrado');
      
      const { data: { user } } = await supabase.auth.getUser();
      
      // Buscar tenant_id do usuário para garantir isolamento por tenant
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
      
      // Criar cópia
      const { data: newFlow, error: flowError } = await supabase
        .from('chatbot_flows')
        .insert({
          name: `${original.name} (cópia)`,
          description: original.description,
          is_active: false,
          is_draft: true,
          channel_ids: original.channel_ids,
          run_once_per_contact: original.run_once_per_contact,
          priority: original.priority,
          created_by: user?.id || null,
          tenant_id: tenantId || original.tenant_id,
        })
        .select()
        .single();
      
      if (flowError) throw flowError;
      
      // Copiar nós
      const { data: nodes } = await supabase
        .from('flow_nodes')
        .select('*')
        .eq('flow_id', flowId);
      
      if (nodes && nodes.length > 0) {
        const nodeIdMap: Record<string, string> = {};
        
        for (const node of nodes) {
          const { data: newNode } = await supabase
            .from('flow_nodes')
            .insert({
              flow_id: newFlow.id,
              name: node.name,
              node_type: node.node_type,
              node_subtype: node.node_subtype,
              position_x: node.position_x,
              position_y: node.position_y,
              config: node.config,
            })
            .select()
            .single();
          
          if (newNode) {
            nodeIdMap[node.id] = newNode.id;
          }
        }
        
        // Copiar conexões
        const { data: connections } = await supabase
          .from('flow_connections')
          .select('*')
          .eq('flow_id', flowId);
        
        if (connections && connections.length > 0) {
          const newConnections = connections.map(conn => ({
            flow_id: newFlow.id,
            source_node_id: nodeIdMap[conn.source_node_id],
            target_node_id: nodeIdMap[conn.target_node_id],
            source_handle: conn.source_handle,
          })).filter(c => c.source_node_id && c.target_node_id);
          
          if (newConnections.length > 0) {
            await supabase.from('flow_connections').insert(newConnections);
          }
        }
      }
      
      return newFlow as ChatbotFlow;
    },
    onSuccess: () => {
      toast.success('Fluxo duplicado!');
      queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao duplicar: ' + error.message);
    },
  });
}

// Excluir fluxo
export function useDeleteFlow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (flowId: string) => {
      const { error } = await supabase
        .from('chatbot_flows')
        .delete()
        .eq('id', flowId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Fluxo excluído!');
      queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir: ' + error.message);
    },
  });
}

// Toggle ativo/inativo
export function useToggleFlowActive() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ flowId, isActive }: { flowId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('chatbot_flows')
        .update({ 
          is_active: isActive,
          is_draft: false,
          published_at: isActive ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', flowId);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(variables.isActive ? 'Fluxo ativado!' : 'Fluxo desativado!');
      queryClient.invalidateQueries({ queryKey: ['chatbot-flows'] });
    },
  });
}

// Buscar execuções do fluxo
export function useFlowExecutions(flowId: string | null) {
  return useQuery({
    queryKey: ['flow-executions', flowId],
    queryFn: async () => {
      if (!flowId) return [];
      
      const { data, error } = await supabase
        .from('flow_executions')
        .select(`
          *,
          contact:contacts(full_name, phone)
        `)
        .eq('flow_id', flowId)
        .order('started_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return (data || []) as FlowExecution[];
    },
    enabled: !!flowId,
  });
}
