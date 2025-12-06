import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Conversation, AssignmentFilter } from './useConversations';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from 'date-fns';

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

// Server-side sorting options
export type ServerSortFilter = 'newest' | 'oldest' | 'unread';

// All sort filter options (some are local-only)
export type SortFilter = ServerSortFilter | 'not_replied' | 'client_not_replied';

export interface ConversationFilters {
  assignment?: AssignmentFilter;
  sortBy?: ServerSortFilter;
  channelId?: string;
  isUnread?: boolean;
  // Filtros avançados - aplicados no servidor
  departmentId?: string;
  agentId?: string;
  origin?: 'meta_ads' | 'whatsapp' | 'all';
  dateFilter?: string;
  customDateFrom?: Date;
  customDateTo?: Date;
  tagIds?: string[];
}

// Helper para calcular datas do filtro
function getDateRange(dateFilter: string, customFrom?: Date, customTo?: Date): { start: Date; end: Date } | null {
  const now = new Date();
  
  switch (dateFilter) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case 'this_week':
      return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfDay(now) };
    case 'last_week':
      return { start: startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }), end: endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }) };
    case 'this_month':
      return { start: startOfMonth(now), end: endOfDay(now) };
    case 'last_month':
      return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
    case 'custom':
      if (customFrom) {
        return { 
          start: startOfDay(customFrom), 
          end: customTo ? endOfDay(customTo) : endOfDay(customFrom) 
        };
      }
      return null;
    default:
      return null;
  }
}

export function usePaginatedConversations(filters?: ConversationFilters) {
  const { 
    assignment, 
    sortBy = 'newest', 
    channelId, 
    isUnread,
    departmentId,
    agentId,
    origin,
    dateFilter,
    customDateFrom,
    customDateTo,
    tagIds,
  } = filters || {};
  
  return useInfiniteQuery({
    queryKey: ['conversations-paginated', assignment, sortBy, channelId, isUnread, departmentId, agentId, origin, dateFilter, customDateFrom?.toISOString(), customDateTo?.toISOString(), tagIds?.join(',')],
    queryFn: async ({ pageParam = 0 }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Se há filtro de data, precisamos usar INNER JOIN para filtrar no servidor
      const hasDateFilter = dateFilter && dateFilter !== 'all';
      const dateRange = hasDateFilter ? getDateRange(dateFilter, customDateFrom, customDateTo) : null;
      
      // Use !inner para forçar INNER JOIN quando filtrando por data
      const contactJoin = hasDateFilter && dateRange 
        ? 'contact:contacts!inner(id, full_name, phone, email, avatar_url, is_online, is_typing, first_contact_at, created_at, origin, origin_campaign, referral_data)'
        : 'contact:contacts(id, full_name, phone, email, avatar_url, is_online, is_typing, first_contact_at, created_at, origin, origin_campaign, referral_data)';
      
      const CONVERSATION_FIELDS_DYNAMIC = `
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
        ${contactJoin},
        assignee:profiles!conversations_assigned_to_fkey(id, full_name),
        channel:whatsapp_channels(id, name)
      `;
      
      let query = supabase
        .from('conversations')
        .select(CONVERSATION_FIELDS_DYNAMIC)
        .eq('status', 'open');

      // Apply assignment filter
      if (assignment === 'mine' && user) {
        query = query.eq('assigned_to', user.id);
      } else if (assignment === 'unassigned') {
        query = query.is('assigned_to', null);
      }

      // Apply channel filter
      if (channelId && channelId !== 'all') {
        if (channelId === 'no_channel') {
          query = query.is('channel_id', null);
        } else {
          query = query.eq('channel_id', channelId);
        }
      }

      // Apply unread filter
      if (isUnread) {
        query = query.eq('is_unread', true);
      }

      // *** FILTROS AVANÇADOS - SERVIDOR ***
      
      // Filtro por departamento
      if (departmentId && departmentId !== 'all') {
        query = query.eq('department_id', departmentId);
      }

      // Filtro por agente/atendente
      if (agentId && agentId !== 'all') {
        query = query.eq('assigned_to', agentId);
      }

      // Filtro por origem (Meta Ads / Orgânico)
      if (origin && origin !== 'all') {
        if (origin === 'meta_ads') {
          query = query.eq('referral_source', 'meta_ads');
        } else if (origin === 'whatsapp') {
          // Orgânico = não é meta_ads (pode ser null ou qualquer outro valor)
          query = query.or('referral_source.is.null,referral_source.neq.meta_ads');
        }
      }

      // *** FILTRO DE DATA - SERVIDOR (usando INNER JOIN) ***
      if (hasDateFilter && dateRange) {
        const startISO = dateRange.start.toISOString();
        const endISO = dateRange.end.toISOString();
        query = query
          .gte('contact.first_contact_at', startISO)
          .lte('contact.first_contact_at', endISO);
      }

      // Apply sorting - THIS IS THE KEY: sorting happens on the SERVER
      switch (sortBy) {
        case 'oldest':
          query = query.order('last_message_at', { ascending: true, nullsFirst: false });
          break;
        case 'unread':
          // Unread first (is_unread desc), then by date
          query = query
            .order('is_unread', { ascending: false })
            .order('last_message_at', { ascending: false, nullsFirst: false });
          break;
        case 'newest':
        default:
          query = query.order('last_message_at', { ascending: false, nullsFirst: false });
          break;
      }

      // Apply pagination
      query = query.range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

      const { data, error } = await query;

      if (error) throw error;
      
      return {
        conversations: (data || []) as unknown as Conversation[],
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
