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

      // Update the conversation
      const { error: updateError } = await supabase
        .from('conversations')
        .update({
          assigned_to: toUserId,
          transferred_at: new Date().toISOString(),
          transferred_from: user.id,
          transfer_note: 'Devolução de transferência',
        })
        .eq('id', conversationId);

      if (updateError) throw updateError;

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
      queryClient.invalidateQueries({ queryKey: ['conversation-events', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['paginated-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
    },
  });
}

export function useTransferConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      conversationId,
      toUserId,
      toUserName,
      toDepartmentId,
      toDepartmentName,
      note,
    }: TransferConversationParams) => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get current user's profile for the event data
      const { data: actorProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      // Get current conversation to capture the "from" state
      const { data: currentConversation, error: convError } = await supabase
        .from('conversations')
        .select(`
          assigned_to,
          department_id,
          assigned_user:profiles!conversations_assigned_to_fkey(full_name),
          department:departments!conversations_department_id_fkey(name)
        `)
        .eq('id', conversationId)
        .single();

      if (convError) throw convError;

      const fromUserId = currentConversation?.assigned_to;
      const fromUserName = (currentConversation?.assigned_user as any)?.full_name || null;

      // Update the conversation
      const updateData: any = {
        transferred_at: new Date().toISOString(),
        transferred_from: fromUserId || user.id,
        transfer_note: note || null,
      };

      if (toUserId) {
        updateData.assigned_to = toUserId;
      } else if (toDepartmentId) {
        updateData.assigned_to = null; // Unassign when transferring to department
        updateData.department_id = toDepartmentId;
      }

      const { error: updateError } = await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conversationId);

      if (updateError) throw updateError;

      // Create the transfer event
      const eventData: ConversationEvent['data'] = {
        from_user_id: fromUserId || user.id,
        from_user_name: fromUserName || actorProfile?.full_name || 'Usuário',
        note,
      };

      if (toUserId) {
        eventData.to_user_id = toUserId;
        eventData.to_user_name = toUserName || 'Usuário';
      }

      if (toDepartmentId) {
        eventData.to_department_id = toDepartmentId;
        eventData.to_department_name = toDepartmentName || 'Departamento';
      }

      const { error: eventError } = await supabase
        .from('conversation_events')
        .insert({
          conversation_id: conversationId,
          event_type: 'transfer',
          actor_id: user.id,
          data: eventData,
        });

      if (eventError) throw eventError;

      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-events', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['paginated-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation', variables.conversationId] });
    },
  });
}
