import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContactConversation {
  id: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  close_reason: string | null;
  channel_id: string | null;
  channel_name: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  reopen_count: number;
  message_count: number;
}

export interface ConversationMessage {
  id: string;
  content: string;
  media_type: string | null;
  media_url: string | null;
  is_from_me: boolean;
  status: string;
  created_at: string;
  sender_name: string | null;
}

export function useContactConversationHistory(contactId: string | null) {
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['contact-conversations', contactId],
    queryFn: async (): Promise<ContactConversation[]> => {
      // Get all conversations for this contact
      const { data: convData, error: convError } = await supabase
        .from('conversations')
        .select(`
          id,
          status,
          created_at,
          closed_at,
          close_reason,
          channel_id,
          assigned_to,
          last_message_at,
          last_message_preview,
          reopen_count,
          channel:whatsapp_channels(name),
          assignee:profiles!conversations_assigned_to_fkey(full_name)
        `)
        .eq('contact_id', contactId!)
        .order('created_at', { ascending: false });

      if (convError) {
        console.error('Error fetching contact conversations:', convError);
        throw convError;
      }

      // Get message counts for each conversation
      const conversationIds = convData.map(c => c.id);
      
      const { data: messageCounts, error: countError } = await supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', conversationIds);

      if (countError) {
        console.error('Error fetching message counts:', countError);
      }

      // Count messages per conversation
      const countMap: Record<string, number> = {};
      (messageCounts || []).forEach(m => {
        countMap[m.conversation_id] = (countMap[m.conversation_id] || 0) + 1;
      });

      return convData.map(conv => ({
        id: conv.id,
        status: conv.status || 'open',
        created_at: conv.created_at,
        closed_at: conv.closed_at,
        close_reason: conv.close_reason,
        channel_id: conv.channel_id,
        channel_name: Array.isArray(conv.channel) ? conv.channel[0]?.name : (conv.channel as any)?.name || null,
        assigned_to: conv.assigned_to,
        assigned_to_name: Array.isArray(conv.assignee) ? conv.assignee[0]?.full_name : (conv.assignee as any)?.full_name || null,
        last_message_at: conv.last_message_at,
        last_message_preview: conv.last_message_preview,
        reopen_count: conv.reopen_count || 0,
        message_count: countMap[conv.id] || 0,
      }));
    },
    enabled: !!contactId,
  });

  return {
    conversations,
    conversationsCount: conversations.length,
    isLoading,
  };
}

export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['conversation-messages-history', conversationId],
    queryFn: async (): Promise<ConversationMessage[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          message_type,
          media_url,
          is_from_me,
          status,
          created_at,
          sender:profiles!messages_sender_id_fkey(full_name)
        `)
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching conversation messages:', error);
        throw error;
      }

      return (data || []).map(msg => ({
        id: msg.id,
        content: msg.content || '',
        media_type: msg.message_type, // Map message_type to media_type for UI
        media_url: msg.media_url,
        is_from_me: msg.is_from_me || false,
        status: msg.status || 'sent',
        created_at: msg.created_at,
        sender_name: Array.isArray(msg.sender) ? msg.sender[0]?.full_name : (msg.sender as any)?.full_name || null,
      }));
    },
    enabled: !!conversationId,
  });
}
