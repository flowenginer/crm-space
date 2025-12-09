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
    // Invalidação imediata para mudanças críticas (transferências, fechamentos)
    const invalidateImmediately = () => {
      console.log('🔄 [Realtime] Invalidating ALL conversation queries immediately');
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
      queryClient.invalidateQueries({ queryKey: ['channel-counts'] });
      queryClient.invalidateQueries({ queryKey: ['sort-filter-counts'] });
    };

    // Debounced invalidation para outras mudanças (150ms - mais responsivo)
    const invalidateConversations = debounce(() => {
      console.log('📨 [Realtime] Debounced invalidation triggered');
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-counts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['last-messages'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
      queryClient.invalidateQueries({ queryKey: ['channel-counts'] });
      queryClient.invalidateQueries({ queryKey: ['date-filter-counts'] });
      queryClient.invalidateQueries({ queryKey: ['department-counts'] });
      queryClient.invalidateQueries({ queryKey: ['origin-counts'] });
      queryClient.invalidateQueries({ queryKey: ['tag-counts'] });
      queryClient.invalidateQueries({ queryKey: ['sort-filter-counts'] });
    }, 150);

    // Helper para obter o ID do usuário atual
    const getCurrentUserId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id;
    };

    console.log('📡 [Realtime] Setting up conversation channels...');

    // Channel 1: Subscribe to conversation updates
    const conversationsChannel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
        },
        async (payload) => {
          console.log('🔔 [Realtime] Conversation UPDATE received:', {
            id: (payload.new as any)?.id,
            oldAssignedTo: (payload.old as any)?.assigned_to,
            newAssignedTo: (payload.new as any)?.assigned_to,
            oldStatus: (payload.old as any)?.status,
            newStatus: (payload.new as any)?.status,
          });

          const oldAssignedTo = (payload.old as any)?.assigned_to;
          const newAssignedTo = (payload.new as any)?.assigned_to;
          const oldStatus = (payload.old as any)?.status;
          const newStatus = (payload.new as any)?.status;
          const conversationId = (payload.new as any)?.id;
          
          // Fechamento = invalidação imediata
          if (newStatus === 'closed' && oldStatus !== 'closed') {
            console.log('✅ [Realtime] Conversation CLOSED - immediate refresh');
            invalidateImmediately();
            return;
          }
          
          // Transferência = atualização otimista + invalidação
          if (oldAssignedTo !== newAssignedTo) {
            console.log('✅ [Realtime] Conversation TRANSFERRED - checking user');
            
            const currentUserId = await getCurrentUserId();
            
            // Se EU recebi a conversa, adicionar ao meu cache
            if (newAssignedTo === currentUserId) {
              console.log('🎯 [Realtime] Conversa transferida PARA MIM - adicionando ao cache');
              
              // Buscar dados completos da conversa
              const { data: fullConversation } = await supabase
                .from('conversations')
                .select(`
                  id, status, unread_count, is_unread, last_message_preview, last_message_at,
                  assigned_to, department_id, channel_id, is_new_transfer, lead_status, priority,
                  contact:contacts(id, full_name, phone, avatar_url, origin, lead_status)
                `)
                .eq('id', conversationId)
                .single();
              
              if (fullConversation) {
                // Adicionar conversa ao cache local imediatamente
                queryClient.setQueriesData(
                  { queryKey: ['conversations-paginated'] },
                  (oldData: any) => {
                    if (!oldData?.pages) return oldData;
                    
                    // Verificar se já existe
                    const exists = oldData.pages.some((page: any) => 
                      page.conversations?.some((c: any) => c.id === conversationId)
                    );
                    
                    if (exists) return oldData;
                    
                    // Adicionar no início da primeira página
                    const newPages = [...oldData.pages];
                    if (newPages[0]) {
                      newPages[0] = {
                        ...newPages[0],
                        conversations: [fullConversation, ...(newPages[0].conversations || [])]
                      };
                    }
                    return { ...oldData, pages: newPages };
                  }
                );
              }
            }
            
            // Se EU enviei a conversa, remover do meu cache
            if (oldAssignedTo === currentUserId) {
              console.log('📤 [Realtime] Conversa transferida DE MIM - removendo do cache');
              queryClient.setQueriesData(
                { queryKey: ['conversations-paginated'] },
                (oldData: any) => {
                  if (!oldData?.pages) return oldData;
                  return {
                    ...oldData,
                    pages: oldData.pages.map((page: any) => ({
                      ...page,
                      conversations: page.conversations?.filter((c: any) => c.id !== conversationId) || []
                    }))
                  };
                }
              );
            }
            
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
        (payload) => {
          console.log('🔔 [Realtime] New conversation INSERT:', (payload.new as any)?.id);
          invalidateConversations();
        }
      )
      .subscribe((status) => {
        console.log('📡 [Realtime] conversations-updates channel status:', status);
      });

    // Channel 2: Subscribe to conversation_events for transfer/close events
    // This is a backup mechanism - when a transfer happens, an event is inserted
    // Even if the UPDATE event is missed, we catch the INSERT in conversation_events
    const eventsChannel = supabase
      .channel('global-conversation-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_events',
        },
        (payload) => {
          const eventType = (payload.new as any)?.event_type;
          const conversationId = (payload.new as any)?.conversation_id;
          
          console.log('🔔 [Realtime] Conversation EVENT received:', { eventType, conversationId });
          
          // Para eventos de transferência, fechamento ou reabertura, invalidar imediatamente
          if (['transfer', 'close', 'reopen'].includes(eventType)) {
            console.log(`✅ [Realtime] Critical event "${eventType}" - immediate refresh for ALL users`);
            invalidateImmediately();
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 [Realtime] global-conversation-events channel status:', status);
      });

    // Channel 3: BROADCAST channel para transferências instantâneas (mais rápido que postgres_changes)
    const transferBroadcastChannel = supabase
      .channel('live-transfers')
      .on('broadcast', { event: 'conversation-transferred' }, async (payload) => {
        const { toUserId, fromUserId, conversationId, conversationData } = payload.payload;
        const currentUserId = await getCurrentUserId();
        
        console.log('⚡ [Broadcast] Transfer received:', { toUserId, fromUserId, conversationId, currentUserId });
        
        if (!currentUserId) return;
        
        // Se EU recebi a conversa
        if (toUserId === currentUserId && conversationData) {
          console.log('🎯 [Broadcast] Conversa transferida PARA MIM:', conversationId);
          
          // Adicionar conversa ao cache IMEDIATAMENTE
          queryClient.setQueriesData(
            { queryKey: ['conversations-paginated'] },
            (oldData: any) => {
              if (!oldData?.pages) return oldData;
              
              // Verificar se já existe
              const exists = oldData.pages.some((page: any) => 
                page.conversations?.some((c: any) => c.id === conversationId)
              );
              
              if (exists) return oldData;
              
              // Adicionar no início da primeira página
              const newPages = [...oldData.pages];
              if (newPages[0]) {
                newPages[0] = {
                  ...newPages[0],
                  conversations: [conversationData, ...(newPages[0].conversations || [])]
                };
              }
              return { ...oldData, pages: newPages };
            }
          );
          
          // Atualizar contagens
          queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
        }
        
        // Se EU enviei a conversa (backup, normalmente já removido localmente)
        if (fromUserId === currentUserId) {
          console.log('📤 [Broadcast] Confirmação: conversa transferida de mim:', conversationId);
          queryClient.setQueriesData(
            { queryKey: ['conversations-paginated'] },
            (oldData: any) => {
              if (!oldData?.pages) return oldData;
              return {
                ...oldData,
                pages: oldData.pages.map((page: any) => ({
                  ...page,
                  conversations: page.conversations?.filter((c: any) => c.id !== conversationId) || []
                }))
              };
            }
          );
        }
      })
      .subscribe((status) => {
        console.log('📡 [Realtime] live-transfers broadcast channel status:', status);
      });

    return () => {
      console.log('🔌 [Realtime] Cleaning up conversation channels');
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(transferBroadcastChannel);
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
