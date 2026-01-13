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
      .subscribe((status) => {
        console.log(`[Realtime] Unified channel status:`, status);
      });

    return () => {
      supabase.removeChannel(unifiedChannel);
    };
  }, [conversationId, contactId, queryClient]);
}
