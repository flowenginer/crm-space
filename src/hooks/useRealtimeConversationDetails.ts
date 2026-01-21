import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook para escutar mudanças em tempo real nos detalhes de uma conversa.
 * Invalida as queries quando houver mudanças no contato (lead_status, tags, etc.)
 * ou quando a conversa for transferida/modificada.
 * 
 * OTIMIZADO: Usa um único canal Realtime com múltiplos listeners ao invés de 3 canais separados.
 * Isso reduz conexões WebSocket e melhora performance para agentes com múltiplas conversas abertas.
 * 
 * CORREÇÃO: Agora também escuta mensagens novas e força refetch imediato.
 */
export function useRealtimeConversationDetails(
  conversationId: string | null,
  contactId: string | null
) {
  const queryClient = useQueryClient();
  const lastInvalidationRef = useRef<number>(0);

  useEffect(() => {
    if (!conversationId || !contactId) return;

    const invalidateConversationDetails = () => {
      // Debounce: evita múltiplas invalidações em sequência rápida
      const now = Date.now();
      if (now - lastInvalidationRef.current < 500) {
        return;
      }
      lastInvalidationRef.current = now;

      console.log('🔔 [Realtime] Invalidating conversation details for:', conversationId);
      queryClient.invalidateQueries({ 
        queryKey: ['conversation-details', conversationId],
        refetchType: 'active'
      });
      queryClient.invalidateQueries({ 
        queryKey: ['conversation-direct', conversationId],
        refetchType: 'active'
      });
    };

    // CORREÇÃO: Força refetch IMEDIATO de mensagens (sem debounce)
    const forceRefetchMessages = () => {
      console.log('🔄 [Realtime] Force refetching messages for:', conversationId);
      queryClient.refetchQueries({ 
        queryKey: ['messages-paginated', conversationId],
        type: 'active'
      });
      queryClient.refetchQueries({ 
        queryKey: ['messages', conversationId],
        type: 'active'
      });
    };

    // Sincronizar auth antes de criar canal
    const setupChannel = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        console.log('📡 [RealtimeDetails] Syncing auth token before channel setup');
        supabase.realtime.setAuth(session.access_token);
      }

      // OTIMIZAÇÃO: Um único canal com múltiplos listeners
      // Reduz de 3 conexões WebSocket para 1
      const unifiedChannel = supabase
        .channel(`conversation-unified:${conversationId}`)
        // Listener para mudanças no contato
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'contacts',
            filter: `id=eq.${contactId}`,
          },
          (payload) => {
            console.log('🔔 [Realtime] Contact updated:', payload.new);
            invalidateConversationDetails();
          }
        )
        // Listener para tags adicionadas
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'contact_tags',
            filter: `contact_id=eq.${contactId}`,
          },
          () => {
            console.log('🔔 [Realtime] Tag added to contact');
            invalidateConversationDetails();
          }
        )
        // Listener para tags removidas
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'contact_tags',
            filter: `contact_id=eq.${contactId}`,
          },
          () => {
            console.log('🔔 [Realtime] Tag removed from contact');
            invalidateConversationDetails();
          }
        )
        // Listener para mudanças na conversa
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'conversations',
            filter: `id=eq.${conversationId}`,
          },
          (payload) => {
            console.log('🔔 [Realtime] Conversation updated:', payload.new);
            invalidateConversationDetails();
          }
        )
        // CORREÇÃO: Listener ADICIONAL para mensagens novas - backup do useRealtimeMessages
        // Isso garante que mensagens apareçam mesmo se o outro canal falhar
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            console.log('📨 [RealtimeDetails] New message backup listener triggered:', {
              messageId: (payload.new as any)?.id,
              content: (payload.new as any)?.content?.substring(0, 30)
            });
            // Força refetch IMEDIATO
            forceRefetchMessages();
          }
        )
        .subscribe((status, err) => {
          console.log(`[Realtime] Unified channel status:`, status);
          if (status === 'CHANNEL_ERROR') {
            console.error('[Realtime] Channel error:', err);
          }
        });

      return unifiedChannel;
    };

    let channelRef: ReturnType<typeof supabase.channel> | null = null;
    
    setupChannel().then(channel => {
      channelRef = channel;
    });

    return () => {
      if (channelRef) {
        supabase.removeChannel(channelRef);
      }
    };
  }, [conversationId, contactId, queryClient]);
}
