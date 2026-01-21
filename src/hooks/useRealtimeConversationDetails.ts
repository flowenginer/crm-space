import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook para escutar mudanças em tempo real nos detalhes de uma conversa.
 * Invalida as queries quando houver mudanças no contato (lead_status, tags, etc.)
 * ou quando a conversa for transferida/modificada.
 * 
 * OTIMIZADO: Usa um único canal Realtime com múltiplos listeners.
 * CORREÇÃO: Adiciona mensagens ao cache otimisticamente + guard contra unmount.
 */
export function useRealtimeConversationDetails(
  conversationId: string | null,
  contactId: string | null
) {
  const queryClient = useQueryClient();
  const lastInvalidationRef = useRef<number>(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (!conversationId || !contactId) return;

    const invalidateConversationDetails = () => {
      if (!isMountedRef.current) return;
      
      // Debounce: evita múltiplas invalidações em sequência rápida
      const now = Date.now();
      if (now - lastInvalidationRef.current < 500) {
        return;
      }
      lastInvalidationRef.current = now;

      console.log('🔔 [RealtimeDetails] Invalidating conversation details for:', conversationId);
      queryClient.invalidateQueries({ 
        queryKey: ['conversation-details', conversationId],
        refetchType: 'active'
      });
      queryClient.invalidateQueries({ 
        queryKey: ['conversation-direct', conversationId],
        refetchType: 'active'
      });
    };

    // UPDATE OTIMISTA: Adicionar mensagem diretamente no cache
    const addMessageToCache = (newMessage: any) => {
      if (!isMountedRef.current) return;
      
      console.log('💾 [RealtimeDetails] Backup: Adding message to cache:', {
        id: newMessage.id,
        content: newMessage.content?.substring(0, 30)
      });

      queryClient.setQueryData(
        ['messages-paginated', conversationId],
        (oldData: any) => {
          if (!oldData?.pages?.length) return oldData;
          
          // Verificar se mensagem já existe
          const messageExists = oldData.pages.some((page: any) =>
            page.messages?.some((m: any) => m.id === newMessage.id)
          );
          
          if (messageExists) {
            console.log('⚠️ [RealtimeDetails] Message already in cache');
            return oldData;
          }
          
          const newPages = [...oldData.pages];
          const formattedMessage = {
            id: newMessage.id,
            conversation_id: newMessage.conversation_id,
            sender_id: newMessage.sender_id,
            contact_id: newMessage.contact_id,
            is_from_me: newMessage.is_from_me,
            content: newMessage.content,
            message_type: newMessage.message_type || 'text',
            media_url: newMessage.media_url,
            media_mime_type: newMessage.media_mime_type,
            status: newMessage.status,
            whatsapp_message_id: newMessage.whatsapp_message_id,
            created_at: newMessage.created_at,
            reply_to_message_id: newMessage.reply_to_message_id,
            reactions: newMessage.reactions || null,
            is_deleted: newMessage.is_deleted || false,
            deleted_at: newMessage.deleted_at,
            reply_to: null,
          };
          
          if (newPages[0]) {
            newPages[0] = {
              ...newPages[0],
              messages: [...(newPages[0].messages || []), formattedMessage]
            };
          }
          
          return { ...oldData, pages: newPages };
        }
      );
    };

    const setupChannel = async () => {
      // Cleanup canal anterior
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      if (!isMountedRef.current) return;
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }

      if (!isMountedRef.current) return;

      const channel = supabase
        .channel(`conv-details:${conversationId}:${Date.now()}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'contacts',
            filter: `id=eq.${contactId}`,
          },
          (payload) => {
            console.log('🔔 [RealtimeDetails] Contact updated:', payload.new);
            invalidateConversationDetails();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'contact_tags',
            filter: `contact_id=eq.${contactId}`,
          },
          () => {
            console.log('🔔 [RealtimeDetails] Tag added');
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
            console.log('🔔 [RealtimeDetails] Tag removed');
            invalidateConversationDetails();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'conversations',
            filter: `id=eq.${conversationId}`,
          },
          (payload) => {
            console.log('🔔 [RealtimeDetails] Conversation updated');
            invalidateConversationDetails();
          }
        )
        // BACKUP: Listener adicional para mensagens - update otimista
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            console.log('📨 [RealtimeDetails] Backup INSERT received:', {
              messageId: (payload.new as any)?.id
            });
            addMessageToCache(payload.new);
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ [RealtimeDetails] Channel subscribed for:', conversationId);
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ [RealtimeDetails] Channel error:', err);
          }
        });

      channelRef.current = channel;
    };

    setupChannel();

    return () => {
      isMountedRef.current = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [conversationId, contactId, queryClient]);
}
