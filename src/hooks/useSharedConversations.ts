import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export type PermissionLevel = 'view' | 'edit';

export interface SharedConversation {
  id: string;
  conversation_id: string;
  shared_by: string;
  shared_with: string | null;
  department_id: string | null;
  note: string | null;
  shared_at: string;
  permission_level: PermissionLevel;
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
          id, conversation_id, shared_by, shared_with, department_id, note, shared_at, permission_level,
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
            queryClient.invalidateQueries({ queryKey: ['my-shares'] });
            queryClient.invalidateQueries({ queryKey: ['my-all-shares'] });
            queryClient.invalidateQueries({ queryKey: ['shared-conversations-details'] });
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

// Get shared conversation IDs for filtering (conversations shared WITH me)
export function useSharedConversationIds() {
  const { data: sharedConversations } = useSharedConversations();
  return sharedConversations?.map(sc => sc.conversation_id) || [];
}

// Fetch ALL conversation IDs shared BY current user (owner perspective)
export function useMyAllShares() {
  return useQuery({
    queryKey: ['my-all-shares'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('shared_conversations')
        .select('conversation_id')
        .eq('shared_by', user.id);

      if (error) throw error;
      return data?.map(d => d.conversation_id) || [];
    },
    staleTime: 30000,
  });
}

// Get ALL shared conversation IDs (both directions: shared WITH me + shared BY me)
// This is used to move conversations from "Todas" to "Compartilhadas" for both users
export function useAllSharedConversationIds() {
  const { data: sharedConversations } = useSharedConversations(); // Shared WITH me
  const { data: sharedByMe } = useMyAllShares(); // Shared BY me
  
  const idsWithMe = sharedConversations?.map(sc => sc.conversation_id) || [];
  const idsByMe = sharedByMe || [];
  
  // Combine without duplicates
  return [...new Set([...idsWithMe, ...idsByMe])];
}

// Fetch shares made BY current user for a specific conversation (for owner to manage)
export function useMySharesForConversation(conversationId: string | null) {
  return useQuery({
    queryKey: ['my-shares', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('shared_conversations')
        .select(`
          id, conversation_id, shared_by, shared_with, department_id, note, shared_at, permission_level,
          shared_with_profile:profiles!shared_conversations_shared_with_fkey(id, full_name, avatar_url),
          department:departments!shared_conversations_department_id_fkey(id, name)
        `)
        .eq('conversation_id', conversationId)
        .eq('shared_by', user.id)
        .order('shared_at', { ascending: false });

      if (error) throw error;
      return data as SharedConversation[];
    },
    enabled: !!conversationId,
    staleTime: 30000,
  });
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
      permissionLevel?: PermissionLevel;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Verify user is the conversation owner
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .select('assigned_to')
        .eq('id', params.conversationId)
        .single();
      
      if (convError) throw convError;
      if (conversation.assigned_to !== user.id) {
        throw new Error('Apenas o atendente responsável pode compartilhar esta conversa');
      }

      const { error } = await supabase
        .from('shared_conversations')
        .insert({
          conversation_id: params.conversationId,
          shared_by: user.id,
          shared_with: params.sharedWith || null,
          department_id: params.departmentId || null,
          note: params.note || null,
          permission_level: params.permissionLevel || 'view',
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
          permission_level: params.permissionLevel || 'view',
        }
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shared-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['shared-conversation-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-events'] });
      queryClient.invalidateQueries({ queryKey: ['my-shares', variables.conversationId] });
    },
  });
}

// Remove a specific share (owner canceling)
export function useRemoveShare() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shareId: string) => {
      const { error } = await supabase
        .from('shared_conversations')
        .delete()
        .eq('id', shareId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['shared-conversation-counts'] });
      queryClient.invalidateQueries({ queryKey: ['my-shares'] });
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
      queryClient.invalidateQueries({ queryKey: ['my-shares'] });
    },
  });
}

// Check if conversation is shared with current user
export function useIsSharedWithMe(conversationId: string) {
  const { data: sharedConversations } = useSharedConversations();
  return sharedConversations?.some(sc => sc.conversation_id === conversationId) ?? false;
}

// Check permission level for a shared conversation
export function useMySharePermission(conversationId: string | null) {
  const { data: sharedConversations } = useSharedConversations();
  
  const share = conversationId 
    ? sharedConversations?.find(sc => sc.conversation_id === conversationId)
    : undefined;
    
  return {
    isShared: !!share,
    canEdit: share?.permission_level === 'edit',
    permissionLevel: share?.permission_level || null,
  };
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
