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

      console.log('[Transfer] Starting transfer for conversation:', conversationId);
      console.log('[Transfer] Current user ID:', user.id);

      // Get current user's profile for the event data
      const { data: actorProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      console.log('[Transfer] Actor profile:', actorProfile?.full_name);

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

      if (convError) {
        console.error('[Transfer] Error fetching conversation:', convError);
        throw convError;
      }

      console.log('[Transfer] Current conversation assigned_to:', currentConversation?.assigned_to);
      console.log('[Transfer] Is user the owner?:', currentConversation?.assigned_to === user.id);

      const fromUserId = currentConversation?.assigned_to;
      const fromUserName = (currentConversation?.assigned_user as any)?.full_name || null;

      // Build the transfer event data BEFORE updating the conversation
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

      // IMPORTANT: Create the transfer event FIRST (before updating assigned_to)
      // This is because the RLS policy on conversation_events checks if the current user
      // is the assigned_to of the conversation. If we update first, the user is no longer
      // the assigned_to and the INSERT will fail.
      console.log('[Transfer] Creating transfer event...');
      const { error: eventError } = await supabase
        .from('conversation_events')
        .insert({
          conversation_id: conversationId,
          event_type: 'transfer',
          actor_id: user.id,
          data: eventData,
        });

      if (eventError) {
        console.error('[Transfer] Error creating event:', eventError);
        throw eventError;
      }
      console.log('[Transfer] Event created successfully');

      // Now update the conversation - the event is already recorded
      const updateData: any = {
        transferred_at: new Date().toISOString(),
        transferred_from: fromUserId || user.id,
        transfer_note: note || null,
      };

      // Always set the user if provided
      if (toUserId) {
        updateData.assigned_to = toUserId;
        updateData.status = 'open'; // Muda para "open" ao atribuir a um atendente
      }
      
      // Always set the department if provided
      if (toDepartmentId) {
        updateData.department_id = toDepartmentId;
      }

      console.log('[Transfer] Updating conversation with:', updateData);
      const { data: updateResult, error: updateError } = await supabase
        .from('conversations')
        .update(updateData)
        .eq('id', conversationId)
        .select('id');

      if (updateError) {
        console.error('[Transfer] Error updating conversation:', updateError);
        throw updateError;
      }
      
      // Verify the update actually affected a row
      if (!updateResult || updateResult.length === 0) {
        console.error('[Transfer] No rows updated - RLS policy may have blocked the update');
        throw new Error('Falha ao transferir conversa. Verifique suas permissões.');
      }
      
      console.log('[Transfer] Conversation updated successfully:', updateResult);

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
