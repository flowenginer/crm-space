import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook para escutar mudanças em tempo real nos detalhes de uma conversa.
 * Invalida as queries quando houver mudanças no contato (lead_status, tags, etc.)
 * ou quando a conversa for transferida/modificada.
 */
export function useRealtimeConversationDetails(
  conversationId: string | null,
  contactId: string | null
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!conversationId || !contactId) return;

    const invalidateConversationDetails = () => {
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

    // Canal para mudanças no contato (lead_status, assigned_to, segment_id, etc.)
    const contactChannel = supabase
      .channel(`contact-realtime:${contactId}`)
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
      .subscribe((status) => {
        console.log(`[Realtime] Contact channel status:`, status);
      });

    // Canal para mudanças nas tags do contato
    const tagsChannel = supabase
      .channel(`contact-tags-realtime:${contactId}`)
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
      .subscribe((status) => {
        console.log(`[Realtime] Contact tags channel status:`, status);
      });

    // Canal para mudanças na conversa (transferências, status, etc.)
    const conversationChannel = supabase
      .channel(`conversation-realtime:${conversationId}`)
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
        console.log(`[Realtime] Conversation channel status:`, status);
      });

    return () => {
      supabase.removeChannel(contactChannel);
      supabase.removeChannel(tagsChannel);
      supabase.removeChannel(conversationChannel);
    };
  }, [conversationId, contactId, queryClient]);
}
