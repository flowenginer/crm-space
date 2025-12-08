import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConversationEvent {
  id: string;
  conversation_id: string;
  event_type: 'transfer' | 'close' | 'reopen';
  actor_id: string | null;
  data: {
    from_user_id?: string;
    from_user_name?: string;
    to_user_id?: string;
    to_user_name?: string;
    to_department_id?: string;
    to_department_name?: string;
    note?: string;
    close_reason?: string;
    is_return?: boolean;
  };
  created_at: string;
  actor?: {
    full_name: string | null;
  };
}

export function useConversationEvents(conversationId: string | null) {
  return useQuery({
    queryKey: ['conversation-events', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from('conversation_events')
        .select(`
          *,
          actor:profiles!conversation_events_actor_id_fkey(full_name)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as ConversationEvent[];
    },
    enabled: !!conversationId,
  });
}

interface TransferConversationParams {
  conversationId: string;
  toUserId?: string | null;
  toUserName?: string | null;
  toDepartmentId?: string | null;
  toDepartmentName?: string | null;
  note?: string;
}

export function useReturnConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      toUserId,
      toUserName,
    }: {
      conversationId: string;
      toUserId: string;
      toUserName: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data: actorProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      // Update the conversation - set status to "open" when returning to an agent
      const { data: updateResult, error: updateError } = await supabase
        .from('conversations')
        .update({
          assigned_to: toUserId,
          status: 'open', // Muda para "open" ao atribuir a um atendente
          transferred_at: new Date().toISOString(),
          transferred_from: user.id,
          transfer_note: 'Devolução de transferência',
        })
        .eq('id', conversationId)
        .select('id');

      if (updateError) throw updateError;
      
      if (!updateResult || updateResult.length === 0) {
        throw new Error('Falha ao devolver conversa. Verifique suas permissões.');
      }

      // Create the return transfer event
      const { error: eventError } = await supabase
        .from('conversation_events')
        .insert({
          conversation_id: conversationId,
          event_type: 'transfer',
          actor_id: user.id,
          data: {
            from_user_id: user.id,
            from_user_name: actorProfile?.full_name || 'Usuário',
            to_user_id: toUserId,
            to_user_name: toUserName,
            note: 'Devolução de transferência',
            is_return: true,
          },
        });

      if (eventError) throw eventError;

      return { success: true };
    },
    onSuccess: (_, variables) => {
      // Invalidar todas as queries relacionadas imediatamente
      queryClient.invalidateQueries({ queryKey: ['conversation-events', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-direct', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-details', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
    },
  });
}

export function useTransferConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      toUserId,
      toDepartmentId,
      note,
    }: TransferConversationParams) => {
      // Usar a função RPC SECURITY DEFINER para transferência
      const { data, error } = await supabase.rpc('transfer_conversation', {
        p_conversation_id: conversationId,
        p_to_user_id: toUserId || null,
        p_to_department_id: toDepartmentId || null,
        p_note: note || null,
      });

      if (error) {
        console.error('[Transfer] RPC error:', error);
        throw new Error(error.message || 'Falha ao transferir conversa');
      }

      return { success: data };
    },
    onSuccess: (_, variables) => {
      // Invalidar todas as queries relacionadas imediatamente
      queryClient.invalidateQueries({ queryKey: ['conversation-events', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-direct', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-details', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
    },
  });
}
