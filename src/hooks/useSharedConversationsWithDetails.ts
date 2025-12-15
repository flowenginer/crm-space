import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Conversation } from './useConversations';
import { useAllSharedConversationIds } from './useSharedConversations';

const CONVERSATION_FIELDS = `
  id,
  contact_id,
  channel_id,
  assigned_to,
  department_id,
  status,
  is_unread,
  unread_count,
  last_message_at,
  last_message_preview,
  last_message_is_from_me,
  lead_status,
  created_at,
  referral_source,
  referral_data,
  is_new_transfer,
  transferred_at,
  reopen_count,
  contact:contacts(id, full_name, phone, email, avatar_url, is_online, is_typing, first_contact_at, created_at, origin, origin_campaign, referral_data, segment_id, segment:segments(id, name, color)),
  assignee:profiles!conversations_assigned_to_fkey(id, full_name),
  channel:whatsapp_channels(id, name)
`;

/**
 * Fetches full conversation details for all shared conversations
 * This includes both conversations shared WITH the user AND shared BY the user
 * This is needed because shared conversations may not be loaded via the normal
 * pagination which filters by assignment
 */
export function useSharedConversationsWithDetails() {
  // Use combined IDs (shared with me + shared by me)
  const allSharedConversationIds = useAllSharedConversationIds();

  return useQuery({
    queryKey: ['shared-conversations-details', allSharedConversationIds],
    queryFn: async () => {
      if (!allSharedConversationIds || allSharedConversationIds.length === 0) {
        return [] as Conversation[];
      }

      const { data, error } = await supabase
        .from('conversations')
        .select(CONVERSATION_FIELDS)
        .in('id', allSharedConversationIds)
        .order('last_message_at', { ascending: false });

      if (error) throw error;
      return data as Conversation[];
    },
    enabled: allSharedConversationIds.length > 0,
    staleTime: 30000, // 30 seconds cache
  });
}
