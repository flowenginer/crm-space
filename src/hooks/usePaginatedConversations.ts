import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Conversation, AssignmentFilter } from './useConversations';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, subDays } from 'date-fns';

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

export type StatusFilter = 'active' | 'open' | 'pending' | 'closed' | 'all';

export type AssignmentFilterExtended = 'all' | 'mine' | 'unassigned' | 'pending';

export interface ConversationFilters {
  assignment?: AssignmentFilterExtended;
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
  // Busca por telefone ou nome - direto no banco
  searchQuery?: string;
  // Filtro de status da conversa
  statusFilter?: StatusFilter;
}

// Helper para obter início/fim do dia no timezone local convertido para UTC
function getTimezoneAdjustedDate(date: Date, timezone: string, isEnd: boolean = false): Date {
  // Formatar a data no timezone especificado
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  // Obter a data local no timezone
  const parts = formatter.formatToParts(date);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '2024');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '1') - 1;
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  
  // Calcular offset do timezone
  const nowInTz = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = date.getTime() - nowInTz.getTime();
  
  // Criar a data correta: queremos o início/fim do dia no timezone, convertido para UTC
  const targetDate = new Date(year, month, day, isEnd ? 23 : 0, isEnd ? 59 : 0, isEnd ? 59 : 0);
  return new Date(targetDate.getTime() + offsetMs);
}

// Helper para calcular datas do filtro COM TIMEZONE
async function getDateRangeWithTimezone(dateFilter: string, customFrom?: Date, customTo?: Date): Promise<{ start: Date; end: Date } | null> {
  // Buscar timezone da empresa
  const { data: settings } = await supabase
    .from('company_settings')
    .select('timezone')
    .limit(1)
    .single();
  
  const timezone = settings?.timezone || 'America/Sao_Paulo';
  const now = new Date();
  
  switch (dateFilter) {
    case 'today':
      return { 
        start: getTimezoneAdjustedDate(now, timezone, false), 
        end: getTimezoneAdjustedDate(now, timezone, true) 
      };
    case 'yesterday':
      const yesterday = subDays(now, 1);
      return { 
        start: getTimezoneAdjustedDate(yesterday, timezone, false), 
        end: getTimezoneAdjustedDate(yesterday, timezone, true) 
      };
    case 'this_week':
      const weekStart = startOfWeek(now, { weekStartsOn: 0 });
      return { 
        start: getTimezoneAdjustedDate(weekStart, timezone, false), 
        end: getTimezoneAdjustedDate(now, timezone, true) 
      };
    case 'last_week':
      const lastWeekStartDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
      const lastWeekEndDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
      return { 
        start: getTimezoneAdjustedDate(lastWeekStartDate, timezone, false), 
        end: getTimezoneAdjustedDate(lastWeekEndDate, timezone, true) 
      };
    case 'this_month':
      const monthStart = startOfMonth(now);
      return { 
        start: getTimezoneAdjustedDate(monthStart, timezone, false), 
        end: getTimezoneAdjustedDate(now, timezone, true) 
      };
    case 'last_month':
      const lastMonthStartDate = startOfMonth(subMonths(now, 1));
      const lastMonthEndDate = endOfMonth(subMonths(now, 1));
      return { 
        start: getTimezoneAdjustedDate(lastMonthStartDate, timezone, false), 
        end: getTimezoneAdjustedDate(lastMonthEndDate, timezone, true) 
      };
    case 'custom':
      if (customFrom) {
        return { 
          start: getTimezoneAdjustedDate(customFrom, timezone, false), 
          end: customTo ? getTimezoneAdjustedDate(customTo, timezone, true) : getTimezoneAdjustedDate(customFrom, timezone, true) 
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
    searchQuery,
    statusFilter = 'active',
  } = filters || {};
  
  return useInfiniteQuery({
    queryKey: ['conversations-paginated', assignment, sortBy, channelId, isUnread, departmentId, agentId, origin, dateFilter, customDateFrom?.toISOString(), customDateTo?.toISOString(), tagIds?.join(','), searchQuery, statusFilter],
    queryFn: async ({ pageParam = 0 }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Se há filtro de data, precisamos usar INNER JOIN para filtrar no servidor
      const hasDateFilter = dateFilter && dateFilter !== 'all';
      const dateRange = hasDateFilter ? await getDateRangeWithTimezone(dateFilter, customDateFrom, customDateTo) : null;
      
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
        .select(CONVERSATION_FIELDS_DYNAMIC);

      // Apply status filter
      switch (statusFilter) {
        case 'open':
          query = query.eq('status', 'open');
          break;
        case 'pending':
          query = query.eq('status', 'pending');
          break;
        case 'closed':
          query = query.eq('status', 'closed');
          break;
        case 'all':
          // No filter - show all statuses
          break;
        case 'active':
        default:
          // Active = open + pending (exclude closed)
          query = query.in('status', ['open', 'pending']);
          break;
      }

      // Apply assignment filter
      if (assignment === 'mine' && user) {
        query = query.eq('assigned_to', user.id);
      } else if (assignment === 'unassigned') {
        query = query.is('assigned_to', null);
      } else if (assignment === 'pending' && user) {
        // Pending = conversations with no assigned user but with a department
        // Filter by user's departments
        const { data: userDepts } = await supabase
          .from('user_departments')
          .select('department_id')
          .eq('user_id', user.id);
        
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('department_id')
          .eq('id', user.id)
          .single();
        
        // Get all department IDs the user belongs to
        const departmentIds = [
          ...(userDepts?.map(ud => ud.department_id) || []),
          userProfile?.department_id
        ].filter(Boolean) as string[];
        
        if (departmentIds.length > 0) {
          query = query
            .is('assigned_to', null)
            .in('department_id', departmentIds);
        } else {
          // User has no departments, return empty
          return {
            conversations: [] as Conversation[],
            nextPage: undefined,
            pageParam: 0,
          };
        }
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

      // *** BUSCA POR TELEFONE OU NOME - SERVIDOR ***
      if (searchQuery && searchQuery.length >= 3) {
        // Busca direta no banco por telefone ou nome do contato
        // Primeiro buscamos os contact_ids que correspondem
        const { data: matchingContacts } = await supabase
          .from('contacts')
          .select('id')
          .or(`phone.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%`)
          .limit(100);
        
        if (matchingContacts && matchingContacts.length > 0) {
          const contactIds = matchingContacts.map(c => c.id);
          query = query.in('contact_id', contactIds);
        } else {
          // Nenhum contato encontrado, retornar vazio
          return {
            conversations: [] as Conversation[],
            nextPage: undefined,
            pageParam: 0,
          };
        }
      }

      // *** FILTRO POR TAGS - SERVIDOR ***
      if (tagIds && tagIds.length > 0) {
        // Buscar contact_ids que têm essas tags
        const { data: taggedContacts } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', tagIds);
        
        if (taggedContacts && taggedContacts.length > 0) {
          // Pegar contact_ids únicos
          const contactIds = [...new Set(taggedContacts.map(tc => tc.contact_id))];
          query = query.in('contact_id', contactIds);
        } else {
          // Nenhum contato com essas tags = retornar vazio
          return {
            conversations: [] as Conversation[],
            nextPage: undefined,
            pageParam: 0,
          };
        }
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
export function useConversationCounts(statusFilter: StatusFilter = 'active') {
  return useInfiniteQuery({
    queryKey: ['conversations-counts', statusFilter],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('conversations')
        .select('id, assigned_to, is_unread, channel_id, department_id, status, contact:contacts(first_contact_at)');
      
      // Apply status filter
      switch (statusFilter) {
        case 'open':
          query = query.eq('status', 'open');
          break;
        case 'pending':
          query = query.eq('status', 'pending');
          break;
        case 'closed':
          query = query.eq('status', 'closed');
          break;
        case 'all':
          // No filter
          break;
        case 'active':
        default:
          query = query.in('status', ['open', 'pending']);
          break;
      }
      
      query = query
        .order('last_message_at', { ascending: false })
        .range(pageParam * 200, (pageParam + 1) * 200 - 1);

      const { data, error } = await query;

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
