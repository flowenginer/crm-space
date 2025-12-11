import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface SharedConversation {
  id: string;
  conversation_id: string;
  shared_by: string;
  shared_with: string | null;
  department_id: string | null;
  note: string | null;
  shared_at: string;
  shared_by_profile?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  shared_with_profile?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  department?: {
    id: string;
    name: string;
  };
}

export interface SharedConversationCounts {
  total: number;
  unread: number;
}

// Fetch shared conversations for the current user
export function useSharedConversations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['shared-conversations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get user's departments
      const { data: userDepts } = await supabase
        .from('user_departments')
        .select('department_id')
        .eq('user_id', user.id);
      
      const userDeptIds = userDepts?.map(d => d.department_id) || [];

      // Fetch shared conversations where user is recipient (by user or department)
      let query = supabase
        .from('shared_conversations')
        .select(`
          id, conversation_id, shared_by, shared_with, department_id, note, shared_at,
          shared_by_profile:profiles!shared_conversations_shared_by_fkey(id, full_name, avatar_url),
          shared_with_profile:profiles!shared_conversations_shared_with_fkey(id, full_name, avatar_url),
          department:departments!shared_conversations_department_id_fkey(id, name)
        `)
        .neq('shared_by', user.id) // Exclude own shares
        .order('shared_at', { ascending: false });

      // Filter: shared_with = user OR department_id IN user's departments
      if (userDeptIds.length > 0) {
        query = query.or(`shared_with.eq.${user.id},department_id.in.(${userDeptIds.join(',')})`);
      } else {
        query = query.eq('shared_with', user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as SharedConversation[];
    },
    staleTime: 60000, // 1 minute cache
  });

  // Realtime subscription with debounce
  useEffect(() => {
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const channel = supabase
      .channel('shared-conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_conversations'
        },
        () => {
          if (debounceTimeout) clearTimeout(debounceTimeout);
          debounceTimeout = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['shared-conversations'] });
            queryClient.invalidateQueries({ queryKey: ['shared-conversation-counts'] });
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

// Fetch shared conversation counts
export function useSharedConversationCounts() {
  return useQuery({
    queryKey: ['shared-conversation-counts'],
    queryFn: async (): Promise<SharedConversationCounts> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { total: 0, unread: 0 };

      const { data, error } = await supabase.rpc('get_shared_conversation_count', {
        p_user_id: user.id
      });

      if (error) throw error;
      
      // RPC returns an array with single row
      const result = data?.[0] || { total: 0, unread: 0 };
      return {
        total: Number(result.total) || 0,
        unread: Number(result.unread) || 0
      };
    },
    staleTime: 30000, // 30 seconds cache
  });
}

// Get shared conversation IDs for filtering
export function useSharedConversationIds() {
  const { data: sharedConversations } = useSharedConversations();
  return sharedConversations?.map(sc => sc.conversation_id) || [];
}

// Share conversation mutation
export function useShareConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      conversationId: string;
      sharedWith?: string;
      departmentId?: string;
      note?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('shared_conversations')
        .insert({
          conversation_id: params.conversationId,
          shared_by: user.id,
          shared_with: params.sharedWith || null,
          department_id: params.departmentId || null,
          note: params.note || null,
        });

      if (error) throw error;

      // Create conversation event for history
      await supabase.from('conversation_events').insert({
        conversation_id: params.conversationId,
        event_type: 'share',
        actor_id: user.id,
        data: {
          shared_with_user_id: params.sharedWith || null,
          shared_with_department_id: params.departmentId || null,
          note: params.note || null,
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['shared-conversation-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-events'] });
    },
  });
}

// Unshare / stop following conversation mutation
export function useUnshareConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      conversationId: string;
      sharedBy?: string; // If provided, removes specific share; otherwise, removes all shares for this user
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let query = supabase
        .from('shared_conversations')
        .delete()
        .eq('conversation_id', params.conversationId);

      if (params.sharedBy) {
        // Remove specific share (owner canceling)
        query = query.eq('shared_by', params.sharedBy);
      } else {
        // Remove as recipient (stop following)
        query = query.or(`shared_with.eq.${user.id},shared_by.eq.${user.id}`);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['shared-conversation-counts'] });
    },
  });
}

// Check if conversation is shared with current user
export function useIsSharedWithMe(conversationId: string) {
  const { data: sharedConversations } = useSharedConversations();
  return sharedConversations?.some(sc => sc.conversation_id === conversationId) ?? false;
}

// Toggle for convenience (like pin)
export function useToggleShareConversation() {
  const shareMutation = useShareConversation();
  const unshareMutation = useUnshareConversation();
  const { data: sharedConversations } = useSharedConversations();

  const isSharedWithMe = (conversationId: string) => {
    return sharedConversations?.some(sc => sc.conversation_id === conversationId) ?? false;
  };

  const getShareInfo = (conversationId: string) => {
    return sharedConversations?.find(sc => sc.conversation_id === conversationId);
  };

  return {
    isSharedWithMe,
    getShareInfo,
    share: shareMutation.mutateAsync,
    unshare: unshareMutation.mutateAsync,
    isLoading: shareMutation.isPending || unshareMutation.isPending,
  };
}
