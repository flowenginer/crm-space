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

    // OTIMIZAÇÃO: Debounce aumentado de 300ms para 500ms
    const invalidateMessages = debounce(() => {
      // OTIMIZAÇÃO: Apenas invalidar mensagens da conversa atual
      // Contagens são invalidadas pelo useRealtimeConversations
      queryClient.invalidateQueries({ 
        queryKey: ['messages-paginated', conversationId],
        refetchType: 'active' // Só refetch se query estiver ativa
      });
      queryClient.invalidateQueries({ 
        queryKey: ['messages', conversationId],
        refetchType: 'active'
      });
      // Invalidar também o preview de mensagens (visualizador lateral)
      queryClient.invalidateQueries({ 
        queryKey: ['messages-preview', conversationId],
        refetchType: 'active'
      });
    }, 500);

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
    // OTIMIZAÇÃO: Invalidação imediata apenas para queries ativas
    const invalidateImmediately = () => {
      queryClient.invalidateQueries({ 
        queryKey: ['conversations-paginated'],
        refetchType: 'active'
      });
      queryClient.invalidateQueries({ 
        queryKey: ['conversation-total-counts'],
        refetchType: 'active'
      });
    };

// OTIMIZAÇÃO: Debounce de INSERT reduzido para 300ms (novas conversas devem aparecer rápido)
    const invalidateConversationsInsert = debounce(() => {
      console.log('🔄 [Realtime] Invalidating conversations (INSERT)');
      queryClient.invalidateQueries({ 
        queryKey: ['conversations-paginated'],
        refetchType: 'active'
      });
      queryClient.invalidateQueries({ 
        queryKey: ['conversation-total-counts'],
        refetchType: 'active'
      });
    }, 300);

    // OTIMIZAÇÃO: Debounce de UPDATE mantido em 800ms
    const invalidateConversations = debounce(() => {
      queryClient.invalidateQueries({ 
        queryKey: ['conversations-paginated'],
        refetchType: 'active'
      });
      queryClient.invalidateQueries({ 
        queryKey: ['conversation-total-counts'],
        refetchType: 'active'
      });
    }, 800);

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
          
          // Fechamento = remoção otimista do cache (não invalidar para evitar refetch)
          if (newStatus === 'closed' && oldStatus !== 'closed') {
            console.log('✅ [Realtime] Conversation CLOSED - removing from cache (no refetch)');
            
            // REMOVER a conversa do cache otimisticamente em vez de invalidar
            queryClient.setQueriesData(
              { 
                predicate: (query) => 
                  Array.isArray(query.queryKey) && 
                  query.queryKey[0] === 'conversations-paginated' 
              },
              (oldData: any) => {
                if (!oldData?.pages) return oldData;
                return {
                  ...oldData,
                  pages: oldData.pages.map((page: any) => ({
                    ...page,
                    conversations: (page.conversations || []).filter(
                      (c: any) => c.id !== conversationId
                    ),
                  })),
                };
              }
            );
            
            // Invalidar apenas contagens (não a lista!)
            queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
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
          invalidateConversationsInsert(); // Usar debounce mais rápido para INSERT
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
          
          // Para eventos de transferência ou reabertura, invalidar imediatamente
          // CLOSE é tratado separadamente para evitar refetch da conversa fechada
          if (['transfer', 'reopen'].includes(eventType)) {
            console.log(`✅ [Realtime] Critical event "${eventType}" - immediate refresh for ALL users`);
            invalidateImmediately();
          }
          
          // Para evento de close, remover a conversa do cache em vez de invalidar
          if (eventType === 'close') {
            console.log(`✅ [Realtime] Close event - removing conversation ${conversationId} from cache`);
            
            queryClient.setQueriesData(
              { 
                predicate: (query) => 
                  Array.isArray(query.queryKey) && 
                  query.queryKey[0] === 'conversations-paginated' 
              },
              (oldData: any) => {
                if (!oldData?.pages) return oldData;
                return {
                  ...oldData,
                  pages: oldData.pages.map((page: any) => ({
                    ...page,
                    conversations: (page.conversations || []).filter(
                      (c: any) => c.id !== conversationId
                    ),
                  })),
                };
              }
            );
            
            // Apenas invalidar contagens
            queryClient.invalidateQueries({ queryKey: ['conversation-total-counts'] });
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

    // Channel 4: BROADCAST channel para novas conversas (não depende de RLS)
    const newConversationBroadcastChannel = supabase
      .channel('new-conversations')
      .on('broadcast', { event: 'new-conversation' }, async (payload) => {
        const { tenantId, departmentId, conversationId } = payload.payload;
        
        console.log('⚡ [Broadcast] New conversation received:', { tenantId, departmentId, conversationId });
        
        // Invalidar imediatamente para todos os usuários do tenant
        // O RLS vai filtrar o que cada usuário pode ver
        invalidateConversationsInsert();
      })
      .subscribe((status) => {
        console.log('📡 [Realtime] new-conversations broadcast channel status:', status);
      });

    // Fallback: Polling inteligente a cada 45 segundos (apenas se não houve eventos recentes)
    // OPTIMIZATION: Increased from 15s to 45s, and only poll when tab is visible
    let lastRealtimeEvent = Date.now();
    
    // Atualizar lastRealtimeEvent quando qualquer evento de conversa chegar
    const updateLastEvent = () => {
      lastRealtimeEvent = Date.now();
    };

    const pollInterval = setInterval(() => {
      // OPTIMIZATION: Skip polling if tab is not visible
      if (document.hidden) {
        console.log('🔄 [Polling] Tab hidden, skipping poll');
        return;
      }
      
      const timeSinceLastEvent = Date.now() - lastRealtimeEvent;
      // Só faz polling se não houve evento nos últimos 30 segundos
      if (timeSinceLastEvent > 30000) {
        console.log('🔄 [Polling] No realtime events in 30s, forcing refresh...');
        queryClient.invalidateQueries({ 
          queryKey: ['conversations-paginated'],
          refetchType: 'active'
        });
        queryClient.invalidateQueries({ 
          queryKey: ['conversation-total-counts'],
          refetchType: 'active'
        });
      }
    }, 45000); // OPTIMIZATION: Increased from 15s to 45s

    return () => {
      console.log('🔌 [Realtime] Cleaning up conversation channels');
      clearInterval(pollInterval);
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(eventsChannel);
      supabase.removeChannel(transferBroadcastChannel);
      supabase.removeChannel(newConversationBroadcastChannel);
    };
  }, [queryClient]);
}

// Hook para escutar eventos de conversa em tempo real (transferências, fechamentos)
// OTIMIZADO: Reduzido de 3 invalidações para 1 essencial
export function useRealtimeConversationEvents(conversationId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId) return;

    // Debounce para evitar invalidações em rajada
    let debounceTimeout: NodeJS.Timeout | null = null;
    const debouncedInvalidate = () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        // OTIMIZAÇÃO: Apenas invalidar eventos da conversa específica
        // As outras queries (conversations-paginated, counts) são invalidadas pelo useRealtimeConversations
        queryClient.invalidateQueries({ queryKey: ['conversation-events', conversationId] });
      }, 300);
    };

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
        debouncedInvalidate
      )
      .subscribe();

    return () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
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
