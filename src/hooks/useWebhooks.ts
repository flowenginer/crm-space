import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  auth_type: string;
  auth_token: string | null;
  auth_header_name: string | null;
  auth_header_value: string | null;
  events: string[];
  filters: {
    department_id?: string;
    channel_id?: string;
  };
  is_active: boolean;
  total_sent: number;
  total_success: number;
  total_failed: number;
  last_sent_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status_code: number | null;
  response_body: string | null;
  response_time_ms: number | null;
  status: string;
  attempts: number;
  next_retry_at: string | null;
  error_message: string | null;
  created_at: string;
  delivered_at: string | null;
}

export const WEBHOOK_EVENTS = {
  messages: [
    { key: 'message.received', label: 'Mensagem recebida', description: 'Nova mensagem do cliente' },
    { key: 'message.sent', label: 'Mensagem enviada', description: 'Mensagem enviada pelo atendente' },
    { key: 'message.status', label: 'Status da mensagem', description: 'Status alterado (enviado, entregue, lido)' },
  ],
  contacts: [
    { key: 'contact.created', label: 'Novo contato', description: 'Contato criado no sistema' },
    { key: 'contact.updated', label: 'Contato atualizado', description: 'Dados do contato alterados' },
    { key: 'contact.tag.added', label: 'Tag adicionada', description: 'Tag adicionada ao contato' },
    { key: 'contact.tag.removed', label: 'Tag removida', description: 'Tag removida do contato' },
  ],
  conversations: [
    { key: 'conversation.created', label: 'Nova conversa', description: 'Conversa iniciada' },
    { key: 'conversation.assigned', label: 'Conversa atribuída', description: 'Atribuída a um atendente' },
    { key: 'conversation.transferred', label: 'Conversa transferida', description: 'Transferida para outro atendente' },
    { key: 'conversation.closed', label: 'Conversa fechada', description: 'Conversa encerrada' },
  ],
  deals: [
    { key: 'deal.created', label: 'Novo negócio', description: 'Negócio criado' },
    { key: 'deal.updated', label: 'Negócio atualizado', description: 'Dados do negócio alterados' },
    { key: 'deal.stage.changed', label: 'Mudou de etapa', description: 'Negócio moveu de etapa' },
    { key: 'deal.won', label: 'Negócio ganho', description: 'Negócio marcado como ganho' },
    { key: 'deal.lost', label: 'Negócio perdido', description: 'Negócio marcado como perdido' },
  ],
  channels: [
    { key: 'channel.connected', label: 'Canal conectado', description: 'WhatsApp conectado' },
    { key: 'channel.disconnected', label: 'Canal desconectado', description: 'WhatsApp desconectado' },
  ],
};

export function useWebhooks() {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(w => ({
        ...w,
        events: Array.isArray(w.events) ? w.events : [],
        filters: typeof w.filters === 'object' && w.filters !== null ? w.filters : {},
      })) as WebhookConfig[];
    },
    staleTime: 30000,
  });
}

export function useWebhookDeliveries(webhookId: string | null, page = 1, pageSize = 50) {
  return useQuery({
    queryKey: ['webhook-deliveries', webhookId, page],
    queryFn: async () => {
      if (!webhookId) return { data: [], count: 0 };

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('webhook_deliveries')
        .select('*', { count: 'exact' })
        .eq('webhook_id', webhookId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return { data: data as WebhookDelivery[], count: count || 0 };
    },
    enabled: !!webhookId,
    staleTime: 10000,
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (webhook: Partial<WebhookConfig>) => {
      const { data: userData } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('webhook_configs')
        .insert({
          name: webhook.name,
          url: webhook.url,
          auth_type: webhook.auth_type || 'none',
          auth_token: webhook.auth_token,
          auth_header_name: webhook.auth_header_name,
          auth_header_value: webhook.auth_header_value,
          events: webhook.events || [],
          filters: webhook.filters || {},
          is_active: webhook.is_active ?? true,
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook criado com sucesso');
    },
    onError: (error) => {
      console.error('Error creating webhook:', error);
      toast.error('Erro ao criar webhook');
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<WebhookConfig> & { id: string }) => {
      const { data, error } = await supabase
        .from('webhook_configs')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook atualizado com sucesso');
    },
    onError: (error) => {
      console.error('Error updating webhook:', error);
      toast.error('Erro ao atualizar webhook');
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('webhook_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook excluído com sucesso');
    },
    onError: (error) => {
      console.error('Error deleting webhook:', error);
      toast.error('Erro ao excluir webhook');
    },
  });
}

export function useTestWebhook() {
  return useMutation({
    mutationFn: async (webhook: { url: string; auth_type: string; auth_token?: string; auth_header_name?: string; auth_header_value?: string }) => {
      const response = await supabase.functions.invoke('dispatch-webhook', {
        body: {
          action: 'test',
          webhook,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
  });
}

export function useRetryDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deliveryId: string) => {
      const response = await supabase.functions.invoke('dispatch-webhook', {
        body: {
          action: 'retry',
          deliveryId,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-deliveries'] });
      toast.success('Webhook reenviado');
    },
    onError: (error) => {
      console.error('Error retrying delivery:', error);
      toast.error('Erro ao reenviar webhook');
    },
  });
}
