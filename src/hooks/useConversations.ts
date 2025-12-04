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
  contact?: {
    id: string;
    full_name: string;
    phone: string;
    email: string | null;
    avatar_url: string | null;
    is_online: boolean | null;
  } | null;
  assignee?: { id: string; full_name: string | null } | null;
  channel?: { id: string; name: string } | null;
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
}

export type AssignmentFilter = 'all' | 'mine' | 'unassigned';

export function useConversations(filter?: AssignmentFilter) {
  return useQuery({
    queryKey: ['conversations', filter],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      let query = supabase
        .from('conversations')
        .select(`
          *,
          contact:contacts(id, full_name, phone, email, avatar_url, is_online),
          assignee:profiles!conversations_assigned_to_fkey(id, full_name),
          channel:whatsapp_channels(id, name)
        `)
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
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!conversationId,
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
          status: 'sent',
        })
        .select()
        .single();

      if (error) throw error;

      // Update conversation last message
      const preview = message.message_type === 'image' 
        ? '📷 Imagem' 
        : message.message_type === 'audio'
        ? '🎵 Áudio'
        : message.message_type === 'video'
        ? '🎬 Vídeo'
        : message.message_type === 'document'
        ? '📄 Documento'
        : message.content.substring(0, 100);

      await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: preview,
        })
        .eq('id', message.conversation_id);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
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
    },
  });
}
