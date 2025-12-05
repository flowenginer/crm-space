import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Conversation {
  id: string;
  contact_id: string;
  channel_id: string | null;
  assigned_to: string | null;
  department_id: string | null;
  status: string | null;
  is_unread: boolean | null;
  unread_count: number | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  lead_status: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_by: string | null;
  referral_source: string | null;
  referral_data: {
    ctwaClid?: string;
    sourceId?: string;
    sourceType?: string;
    sourceUrl?: string;
    headline?: string;
    body?: string;
    mediaType?: string;
    imageUrl?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    showAdAttribution?: boolean;
    adName?: string;
    campaignName?: string;
  } | null;
  contact?: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    avatar_url: string | null;
    is_online: boolean | null;
    is_typing: boolean | null;
    first_contact_at: string | null;
    created_at: string;
    origin?: string | null;
    origin_campaign?: string | null;
    referral_data?: any | null;
  } | null;
  assignee?: { id: string; full_name: string | null } | null;
  channel?: { id: string; name: string } | null;
}

export interface MessageReaction {
  emoji: string;
  user_id: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  contact_id: string | null;
  is_from_me: boolean | null;
  content: string | null;
  message_type: string | null;
  media_url: string | null;
  media_mime_type: string | null;
  status: string | null;
  whatsapp_message_id: string | null;
  created_at: string;
  reply_to_message_id: string | null;
  reactions: MessageReaction[] | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  reply_to?: Message[] | null;
}

export type AssignmentFilter = 'all' | 'mine' | 'unassigned';

// Campos específicos para otimização - evita SELECT *
const CONVERSATION_FIELDS = `
  id, contact_id, channel_id, assigned_to, department_id,
  status, is_unread, unread_count, last_message_at, last_message_preview,
  lead_status, created_at, updated_at, closed_at, closed_by,
  referral_source, referral_data,
  contact:contacts(id, full_name, phone, email, avatar_url, is_online, is_typing, first_contact_at, created_at, origin, origin_campaign, referral_data),
  assignee:profiles!conversations_assigned_to_fkey(id, full_name),
  channel:whatsapp_channels(id, name)
`;

export function useConversations(filter?: AssignmentFilter) {
  return useQuery({
    queryKey: ['conversations', filter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      let query = supabase
        .from('conversations')
        .select(CONVERSATION_FIELDS)
        .eq('status', 'open')
        .order('last_message_at', { ascending: false });

      // Apply assignment filter
      if (filter === 'mine' && user) {
        query = query.eq('assigned_to', user.id);
      } else if (filter === 'unassigned') {
        query = query.is('assigned_to', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Conversation[];
    },
    staleTime: 30000, // 30 segundos de cache
  });
}

// Campos específicos para mensagens - evita SELECT *
const MESSAGE_FIELDS = `
  id, conversation_id, sender_id, contact_id, is_from_me,
  content, message_type, media_url, media_mime_type, status,
  whatsapp_message_id, created_at, reply_to_message_id,
  reactions, is_deleted, deleted_at
`;

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      // Buscar mensagens com campos específicos
      const { data, error } = await supabase
        .from('messages')
        .select(MESSAGE_FIELDS)
        .eq('conversation_id', conversationId)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Mapear para o tipo Message
      const messages: Message[] = (data || []).map(m => ({
        ...m,
        reactions: (m.reactions as unknown as MessageReaction[]) || null,
        reply_to: null,
      }));
      
      // Se precisar de replies, buscar separadamente com campos específicos
      const replyIds = messages.filter(m => m.reply_to_message_id).map(m => m.reply_to_message_id!);
      
      if (replyIds.length > 0) {
        const { data: replyMessages } = await supabase
          .from('messages')
          .select(MESSAGE_FIELDS)
          .in('id', replyIds);
        
        // Mapear replies às mensagens
        const replyMap = new Map((replyMessages || []).map(m => [m.id, {
          ...m,
          reactions: (m.reactions as unknown as MessageReaction[]) || null,
          reply_to: null,
        } as Message]));
        
        messages.forEach(m => {
          if (m.reply_to_message_id && replyMap.has(m.reply_to_message_id)) {
            m.reply_to = [replyMap.get(m.reply_to_message_id)!];
          }
        });
      }
      
      return messages;
    },
    enabled: !!conversationId,
    staleTime: 10000, // 10 segundos de cache para mensagens
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (message: {
      conversation_id: string;
      content: string;
      is_from_me?: boolean;
      message_type?: string;
      media_url?: string;
      media_mime_type?: string;
      reply_to_message_id?: string;
      whatsapp_message_id?: string;
    }) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: message.conversation_id,
          content: message.content,
          is_from_me: message.is_from_me ?? true,
          message_type: message.message_type || 'text',
          media_url: message.media_url || null,
          media_mime_type: message.media_mime_type || null,
          reply_to_message_id: message.reply_to_message_id || null,
          whatsapp_message_id: message.whatsapp_message_id || null,
          status: 'sent',
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation last message (fire and forget for speed)
      const preview = message.message_type === 'image' 
        ? '📷 Imagem' 
        : message.message_type === 'audio'
        ? '🎵 Áudio'
        : message.message_type === 'video'
        ? '🎬 Vídeo'
        : message.message_type === 'document'
        ? '📄 Documento'
        : message.content.substring(0, 100);

      supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: preview,
        })
        .eq('id', message.conversation_id)
        .then(() => {});

      return data;
    },
    // Optimistic update for instant UI feedback
    onMutate: async (newMessage) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['messages', newMessage.conversation_id] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<Message[]>(['messages', newMessage.conversation_id]);

      // Optimistically update to the new value
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: newMessage.conversation_id,
        sender_id: null,
        contact_id: null,
        is_from_me: newMessage.is_from_me ?? true,
        content: newMessage.content,
        message_type: newMessage.message_type || 'text',
        media_url: newMessage.media_url || null,
        media_mime_type: newMessage.media_mime_type || null,
        status: 'sending',
        whatsapp_message_id: null,
        created_at: new Date().toISOString(),
        reply_to_message_id: newMessage.reply_to_message_id || null,
        reactions: null,
        is_deleted: false,
        deleted_at: null,
        reply_to: null,
      };

      queryClient.setQueryData<Message[]>(
        ['messages', newMessage.conversation_id],
        (old) => [...(old || []), optimisticMessage]
      );

      return { previousMessages };
    },
    onError: (err, newMessage, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(['messages', newMessage.conversation_id], context.previousMessages);
      }
    },
    onSettled: (_, __, variables) => {
      // Always refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['messages-paginated', variables.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
    },
  });
}

// Update message with WhatsApp message ID (for status tracking)
export async function updateMessageWhatsAppId(messageId: string, whatsappMessageId: string) {
  const { error } = await supabase
    .from('messages')
    .update({ whatsapp_message_id: whatsappMessageId })
    .eq('id', messageId);
  
  if (error) console.error('Error updating whatsapp_message_id:', error);
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      messageId, 
      conversationId,
      whatsappMessageId,
      channelId,
      contactPhone 
    }: { 
      messageId: string; 
      conversationId: string;
      whatsappMessageId?: string | null;
      channelId?: string | null;
      contactPhone?: string | null;
    }) => {
      // Try to delete on WhatsApp first if we have the necessary info
      if (whatsappMessageId && channelId && contactPhone) {
        try {
          // Format remoteJid for Evolution/UAZAPI
          const remoteJid = contactPhone.replace(/\D/g, '') + '@s.whatsapp.net';
          
          console.log('[DeleteMessage] Deleting on WhatsApp:', { whatsappMessageId, channelId, remoteJid });
          
          const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
            body: {
              action: 'deleteMessage',
              channelId,
              whatsappMessageId,
              remoteJid,
              phone: contactPhone,
            }
          });
          
          if (error) {
            console.error('[DeleteMessage] WhatsApp delete error:', error);
          } else if (!data?.success) {
            console.warn('[DeleteMessage] WhatsApp delete failed:', data?.error);
          } else {
            console.log('[DeleteMessage] WhatsApp delete success');
          }
        } catch (e) {
          console.error('[DeleteMessage] Error calling WhatsApp delete:', e);
          // Continue to delete locally even if WhatsApp delete fails
        }
      }

      // Delete locally (soft delete)
      const { error } = await supabase
        .from('messages')
        .update({ 
          is_deleted: true, 
          deleted_at: new Date().toISOString(),
          content: 'Mensagem apagada'
        })
        .eq('id', messageId);

      if (error) throw error;
      return { messageId, conversationId };
    },
    onSuccess: (variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['messages-paginated', variables.conversationId] });
    },
  });
}

export function useEditMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      messageId, 
      conversationId,
      newText,
      whatsappMessageId,
      channelId,
      contactPhone 
    }: { 
      messageId: string; 
      conversationId: string;
      newText: string;
      whatsappMessageId?: string | null;
      channelId?: string | null;
      contactPhone?: string | null;
    }) => {
      // Try to edit on WhatsApp first if we have the necessary info
      if (whatsappMessageId && channelId && contactPhone) {
        try {
          // Format remoteJid for Evolution/UAZAPI
          const remoteJid = contactPhone.replace(/\D/g, '') + '@s.whatsapp.net';
          
          console.log('[EditMessage] Editing on WhatsApp:', { whatsappMessageId, channelId, remoteJid, newText });
          
          const { data, error } = await supabase.functions.invoke('whatsapp-instance', {
            body: {
              action: 'editMessage',
              channelId,
              whatsappMessageId,
              remoteJid,
              phone: contactPhone,
              newText,
            }
          });
          
          if (error) {
            console.error('[EditMessage] WhatsApp edit error:', error);
          } else if (!data?.success) {
            console.warn('[EditMessage] WhatsApp edit failed:', data?.error);
            // If the provider doesn't support editing, throw an error
            if (data?.error?.includes('não suporta')) {
              throw new Error(data.error);
            }
          } else {
            console.log('[EditMessage] WhatsApp edit success');
          }
        } catch (e: any) {
          console.error('[EditMessage] Error calling WhatsApp edit:', e);
          throw e;
        }
      }

      // Update locally
      const { error } = await supabase
        .from('messages')
        .update({ 
          content: newText,
        })
        .eq('id', messageId);

      if (error) throw error;
      return { messageId, conversationId };
    },
    onSuccess: (variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['messages-paginated', variables.conversationId] });
    },
  });
}

export function useReactToMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      messageId, 
      conversationId, 
      emoji, 
      userId 
    }: { 
      messageId: string; 
      conversationId: string; 
      emoji: string; 
      userId: string;
    }) => {
      // First get current reactions
      const { data: message, error: fetchError } = await supabase
        .from('messages')
        .select('reactions')
        .eq('id', messageId)
        .single();

      if (fetchError) throw fetchError;

      const currentReactions = (message?.reactions as { emoji: string; user_id: string }[]) || [];
      
      // Check if user already reacted with this emoji
      const existingIndex = currentReactions.findIndex(
        r => r.emoji === emoji && r.user_id === userId
      );

      let newReactions;
      if (existingIndex >= 0) {
        // Remove reaction
        newReactions = currentReactions.filter((_, i) => i !== existingIndex);
      } else {
        // Add reaction
        newReactions = [...currentReactions, { emoji, user_id: userId }];
      }

      const { error } = await supabase
        .from('messages')
        .update({ reactions: newReactions })
        .eq('id', messageId);

      if (error) throw error;
      return { messageId, conversationId };
    },
    onSuccess: (variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['messages-paginated', variables.conversationId] });
    },
  });
}

// Upload file to storage
export async function uploadAttachment(file: File, conversationId: string): Promise<{ url: string; mimeType: string }> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${conversationId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('conversation-attachments')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('conversation-attachments')
    .getPublicUrl(data.path);

  return {
    url: publicUrl,
    mimeType: file.type,
  };
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Conversation> & { id: string }) => {
      const { error } = await supabase
        .from('conversations')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
    },
  });
}
