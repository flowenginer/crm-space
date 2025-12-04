import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface TypingUser {
  userId: string;
  userName: string;
  conversationId: string;
}

export function useRealtimeMessages(conversationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

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
        (payload) => {
          console.log('New message received:', payload);
          // Invalidate messages query to refresh the list
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
          
          // Show toast for messages not from the current user
          if (payload.new && !payload.new.is_from_me) {
            toast.info('Nova mensagem recebida', {
              description: payload.new.content?.substring(0, 50) || 'Mídia recebida',
            });
          }
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
          queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
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
    // Subscribe to conversation updates
    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        (payload) => {
          console.log('Conversation updated:', payload);
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
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
