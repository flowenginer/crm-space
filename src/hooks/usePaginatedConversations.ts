import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Conversation, AssignmentFilter } from './useConversations';

const PAGE_SIZE = 50;

// Campos otimizados - não usar SELECT *
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
  lead_status,
  created_at,
  referral_source,
  referral_data,
  contact:contacts(id, full_name, phone, email, avatar_url, is_online, is_typing, first_contact_at, created_at, origin, origin_campaign, referral_data),
  assignee:profiles!conversations_assigned_to_fkey(id, full_name),
  channel:whatsapp_channels(id, name)
`;

export function usePaginatedConversations(filter?: AssignmentFilter) {
  return useInfiniteQuery({
    queryKey: ['conversations-paginated', filter],
    queryFn: async ({ pageParam = 0 }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      let query = supabase
        .from('conversations')
        .select(CONVERSATION_FIELDS)
        .eq('status', 'open')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      // Apply assignment filter
      if (filter === 'mine' && user) {
        query = query.eq('assigned_to', user.id);
      } else if (filter === 'unassigned') {
        query = query.is('assigned_to', null);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      return {
        conversations: data as Conversation[],
        nextPage: data?.length === PAGE_SIZE ? pageParam + 1 : undefined,
        pageParam,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 30000, // 30 seconds
  });
}

// Hook para buscar todas as conversas (para contagem de filtros)
// Usa cache mais longo e campos mínimos
export function useConversationCounts() {
  return useInfiniteQuery({
    queryKey: ['conversations-counts'],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, assigned_to, is_unread, channel_id, department_id, status, contact:contacts(first_contact_at)')
        .eq('status', 'open')
        .order('last_message_at', { ascending: false })
        .range(pageParam * 200, (pageParam + 1) * 200 - 1);

      if (error) throw error;
      
      return {
        conversations: data || [],
        nextPage: data?.length === 200 ? pageParam + 1 : undefined,
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    staleTime: 60000, // 1 minute cache
  });
}
