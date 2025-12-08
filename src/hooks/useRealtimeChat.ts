import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface TypingUser {
  userId: string;
  userName: string;
  conversationId: string;
}

// Debounce helper to prevent excessive invalidations
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number) {
  let timeoutId: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
}

export function useRealtimeMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    // Debounced invalidation to prevent rapid-fire updates
    const invalidateMessages = debounce(() => {
      // Invalidate both old and new query keys for compatibility
      queryClient.invalidateQueries({ queryKey: ['messages-paginated', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      
      // Also invalidate conversation counts (new messages may change unread status)
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['sort-filter-counts'] });
    }, 300);

    // Subscribe to new messages in the current conversation
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          invalidateMessages();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          // Refresh messages on update (reactions, deletions, etc.)
          invalidateMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);
}

export function useRealtimeConversations() {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Invalidação imediata para mudanças críticas (transferências)
    const invalidateImmediately = () => {
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
    };

    // Debounced invalidation para outras mudanças (150ms - mais responsivo)
    const invalidateConversations = debounce(() => {
      // Invalidate paginated queries (primary)
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
      // Also invalidate legacy query key for compatibility
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // Invalidate last-messages for filter updates
      queryClient.invalidateQueries({ queryKey: ['last-messages'] });
      
      // REALTIME: Invalidate ALL count hooks for real-time updates
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['channel-counts'] });
      queryClient.invalidateQueries({ queryKey: ['date-filter-counts'] });
      queryClient.invalidateQueries({ queryKey: ['department-counts'] });
      queryClient.invalidateQueries({ queryKey: ['origin-counts'] });
      queryClient.invalidateQueries({ queryKey: ['tag-counts'] });
      queryClient.invalidateQueries({ queryKey: ['sort-filter-counts'] });
    }, 150);

    // Subscribe to conversation updates
    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          // Se assigned_to mudou (transferência), invalidar imediatamente
          const oldAssignedTo = (payload.old as any)?.assigned_to;
          const newAssignedTo = (payload.new as any)?.assigned_to;
          const oldStatus = (payload.old as any)?.status;
          const newStatus = (payload.new as any)?.status;
          
          // Se a conversa foi fechada, invalidar IMEDIATAMENTE
          if (newStatus === 'closed' && oldStatus !== 'closed') {
            console.log('Conversation closed - immediate refresh');
            invalidateImmediately();
          } else if (oldAssignedTo !== newAssignedTo) {
            console.log('Conversation transferred - immediate refresh');
            invalidateImmediately();
          } else {
            invalidateConversations();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          invalidateConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

// Hook para escutar eventos de conversa em tempo real (transferências, fechamentos)
export function useRealtimeConversationEvents(conversationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`conv-events:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_events',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          // Invalidar imediatamente quando há novo evento
          queryClient.invalidateQueries({ queryKey: ['conversation-events', conversationId] });
          queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
          queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);
}

export function useTypingIndicator(conversationId: string | null) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<number>(0);

  useEffect(() => {
    if (!conversationId) {
      setTypingUsers([]);
      return;
    }

    const channel = supabase.channel(`typing:${conversationId}`, {
      config: {
        presence: {
          key: conversationId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const users: TypingUser[] = [];
        
        Object.values(presenceState).forEach((presences) => {
          (presences as any[]).forEach((presence) => {
            if (presence.isTyping && presence.conversationId === conversationId) {
              users.push({
                userId: presence.userId,
                userName: presence.userName,
                conversationId: presence.conversationId,
              });
            }
          });
        });
        
        setTypingUsers(users);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('User left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          channelRef.current = channel;
        }
      });

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [conversationId]);

  const startTyping = useCallback(async () => {
    if (!channelRef.current || !conversationId) return;

    // Throttle typing broadcasts (max once per 2 seconds)
    const now = Date.now();
    if (now - lastTypingRef.current < 2000) return;
    lastTypingRef.current = now;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user profile for name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      await channelRef.current.track({
        isTyping: true,
        userId: user.id,
        userName: profile?.full_name || 'Agente',
        conversationId,
      });

      // Auto-stop typing after 3 seconds
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping();
      }, 3000);
    } catch (error) {
      console.error('Error broadcasting typing:', error);
    }
  }, [conversationId]);

  const stopTyping = useCallback(async () => {
    if (!channelRef.current) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await channelRef.current.track({
        isTyping: false,
        userId: user.id,
        userName: '',
        conversationId,
      });
    } catch (error) {
      console.error('Error stopping typing:', error);
    }
  }, [conversationId]);

  return { typingUsers, startTyping, stopTyping };
}
