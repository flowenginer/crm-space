import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConversationEvent {
  id: string;
  conversation_id: string;
  event_type: 'transfer' | 'close' | 'reopen' | 'auto_reassign' | 'share' | 'share_cancelled';
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
    // Close event data
    active_time_seconds?: number;
    total_time_seconds?: number;
    // Reopen event data
    previous_close_reason?: string;
    previous_closed_at?: string;
    trigger?: 'client_message' | 'manual';
    // Share event data
    shared_with_user_id?: string;
    shared_with_department_id?: string;
    // Share cancelled event data
    cancelled_share_with_user_id?: string;
    cancelled_share_with_user_name?: string;
    cancelled_share_with_department_id?: string;
    cancelled_share_with_department_name?: string;
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
      console.log('[Transfer] Starting transfer:', { conversationId, toUserId, toDepartmentId, note });
      
      // Obter dados do usuário atual ANTES da transferência
      const { data: { user } } = await supabase.auth.getUser();
      const fromUserId = user?.id;
      console.log('[Transfer] Current user:', fromUserId);

      // Usar a função RPC SECURITY DEFINER para transferência
      console.log('[Transfer] Calling RPC transfer_conversation...');
      const { data, error } = await supabase.rpc('transfer_conversation', {
        p_conversation_id: conversationId,
        p_to_user_id: toUserId || null,
        p_to_department_id: toDepartmentId || null,
        p_note: note || null,
      });

      console.log('[Transfer] RPC result:', { data, error });

      if (error) {
        console.error('[Transfer] RPC error:', error);
        throw new Error(error.message || 'Falha ao transferir conversa');
      }

      // Verificar se a função retornou JSONB com sucesso
      const rpcData = data as unknown as { success?: boolean; message?: string } | boolean | null;
      if (rpcData && typeof rpcData === 'object' && 'success' in rpcData) {
        if (!rpcData.success) {
          console.error('[Transfer] RPC returned failure:', rpcData);
          throw new Error(rpcData.message || 'Falha ao transferir conversa');
        }
      }

      // BROADCAST: Enviar notificação instantânea para o destinatário
      if (toUserId) {
        try {
          // Buscar dados completos da conversa para enviar no broadcast
          const { data: conversationData } = await supabase
            .from('conversations')
            .select(`
              id, status, unread_count, is_unread, last_message_preview, last_message_at,
              assigned_to, department_id, channel_id, is_new_transfer, lead_status, priority,
              contact:contacts(id, full_name, phone, avatar_url, origin, lead_status)
            `)
            .eq('id', conversationId)
            .single();

          if (conversationData) {
            console.log('⚡ [Transfer] Sending broadcast to recipient:', toUserId);
            
            await supabase.channel('live-transfers').send({
              type: 'broadcast',
              event: 'conversation-transferred',
              payload: {
                conversationId,
                toUserId,
                fromUserId,
                conversationData
              }
            });
          }
        } catch (broadcastError) {
          // Não falhar a transferência se o broadcast falhar
          console.warn('[Transfer] Broadcast failed (fallback to postgres_changes):', broadcastError);
        }
      }

      return { success: data, fromUserId };
    },
    onMutate: async (variables) => {
      // ATUALIZAÇÃO OTIMISTA: Remover a conversa do cache ANTES da API responder
      console.log('🚀 [Transfer] Optimistic update - removing from cache:', variables.conversationId);
      
      queryClient.setQueriesData(
        { queryKey: ['conversations-paginated'] },
        (oldData: any) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              conversations: page.conversations?.filter((c: any) => c.id !== variables.conversationId) || []
            }))
          };
        }
      );
    },
    onSuccess: (_, variables) => {
      // Invalidar todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['conversation-events', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-direct', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-details', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
    },
    onError: (error, variables) => {
      // Se a transferência falhar, invalidar para restaurar o estado
      console.error('[Transfer] Error - restoring cache:', error);
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
    },
  });
}
