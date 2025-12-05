import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface PinnedConversation {
  id: string;
  user_id: string;
  conversation_id: string;
  pinned_at: string;
}

export function usePinnedConversations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['pinned-conversations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Otimizado: selecionar apenas campos necessários
      const { data, error } = await supabase
        .from('pinned_conversations')
        .select('id, user_id, conversation_id, pinned_at')
        .eq('user_id', user.id)
        .order('pinned_at', { ascending: false });

      if (error) throw error;
      return data as PinnedConversation[];
    },
    staleTime: 60000, // 1 minute cache
  });

  // Realtime subscription with debounce
  useEffect(() => {
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const channel = supabase
      .channel('pinned-conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pinned_conversations'
        },
        () => {
          // Debounce invalidation to prevent excessive re-renders
          if (debounceTimeout) clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['pinned-conversations'] });
          }, 500);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function usePinConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('pinned_conversations')
        .insert({
          user_id: user.id,
          conversation_id: conversationId,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-conversations'] });
    },
  });
}

export function useUnpinConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('pinned_conversations')
        .delete()
        .eq('user_id', user.id)
        .eq('conversation_id', conversationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pinned-conversations'] });
    },
  });
}

export function useTogglePinConversation() {
  const pinMutation = usePinConversation();
  const unpinMutation = useUnpinConversation();
  const { data: pinnedConversations } = usePinnedConversations();

  const isPinned = (conversationId: string) => {
    return pinnedConversations?.some(p => p.conversation_id === conversationId) ?? false;
  };

  const togglePin = async (conversationId: string) => {
    if (isPinned(conversationId)) {
      await unpinMutation.mutateAsync(conversationId);
    } else {
      await pinMutation.mutateAsync(conversationId);
    }
  };

  return {
    isPinned,
    togglePin,
    isLoading: pinMutation.isPending || unpinMutation.isPending,
  };
}
