import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
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
  last_message_is_from_me,
  lead_status,
  created_at,
  referral_source,
  referral_data,
  is_new_transfer,
  transferred_at,
  reopen_count,
  contact:contacts(id, full_name, phone, email, avatar_url, is_online, is_typing, first_contact_at, created_at, origin, origin_campaign, referral_data),
  assignee:profiles!conversations_assigned_to_fkey(id, full_name),
  channel:whatsapp_channels(id, name)
`;

// Server-side sorting options - now includes not_replied and client_not_replied
export type ServerSortFilter = 'newest' | 'oldest' | 'unread' | 'not_replied' | 'client_not_replied';

// All sort filter options (all are now server-side)
export type SortFilter = ServerSortFilter;

export type StatusFilter = 'active' | 'open' | 'pending' | 'closed' | 'all';

export type AssignmentFilterExtended = 'all' | 'mine' | 'unassigned' | 'pending';

export interface ConversationFilters {
  assignment?: AssignmentFilterExtended;
  sortBy?: SortFilter;
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
  // Permissões - para filtrar conversas quando assignment é 'all'
  canViewPending?: boolean;
  canViewUnassigned?: boolean;
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

// OTIMIZAÇÃO: Cache de timezone em sessionStorage para evitar queries repetidas
const TIMEZONE_CACHE_KEY = 'app_timezone';
const TIMEZONE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

interface TimezoneCache {
  value: string;
  timestamp: number;
}

function getCachedTimezone(): string | null {
  try {
    const cached = sessionStorage.getItem(TIMEZONE_CACHE_KEY);
    if (!cached) return null;
    
    const { value, timestamp }: TimezoneCache = JSON.parse(cached);
    if (Date.now() - timestamp > TIMEZONE_CACHE_DURATION) {
      sessionStorage.removeItem(TIMEZONE_CACHE_KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function setCachedTimezone(timezone: string): void {
  try {
    const cache: TimezoneCache = { value: timezone, timestamp: Date.now() };
    sessionStorage.setItem(TIMEZONE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
}

async function getTimezoneWithCache(): Promise<string> {
  const cached = getCachedTimezone();
  if (cached) return cached;
  
  const { data: settings } = await supabase
    .from('company_settings')
    .select('timezone')
    .limit(1)
    .single();
  
  const timezone = settings?.timezone || 'America/Sao_Paulo';
  setCachedTimezone(timezone);
  return timezone;
}

// Helper para calcular datas do filtro COM TIMEZONE
async function getDateRangeWithTimezone(dateFilter: string, customFrom?: Date, customTo?: Date): Promise<{ start: Date; end: Date } | null> {
  // OTIMIZAÇÃO: Usar cache de timezone
  const timezone = await getTimezoneWithCache();
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
        last_message_is_from_me,
        lead_status,
        created_at,
        referral_source,
        referral_data,
        is_new_transfer,
        transferred_at,
        reopen_count,
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
        // Check if user is admin or supervisor
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('department_id, role')
          .eq('id', user.id)
          .single();
        
        const isAdminOrSupervisor = userProfile?.role === 'admin' || userProfile?.role === 'supervisor';
        
        if (isAdminOrSupervisor) {
          // Admin/Supervisor sees ALL pending conversations (no department filter)
          query = query
            .is('assigned_to', null)
            .not('department_id', 'is', null);
        } else {
          // Regular users see only pending from their departments
          const { data: userDepts } = await supabase
            .from('user_departments')
            .select('department_id')
            .eq('user_id', user.id);
          
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
      } else if (assignment === 'all' && user) {
        // When assignment is 'all', apply permission-based filtering
        const canSeePending = filters.canViewPending ?? true;
        const canSeeUnassigned = filters.canViewUnassigned ?? true;
        
        if (!canSeePending && !canSeeUnassigned) {
          // User can only see their own conversations
          query = query.eq('assigned_to', user.id);
        } else if (!canSeePending && canSeeUnassigned) {
          // Can see unassigned (no department) but not pending (has department)
          // Show: assigned to user OR (not assigned AND no department)
          query = query.or(`assigned_to.eq.${user.id},and(assigned_to.is.null,department_id.is.null)`);
        } else if (canSeePending && !canSeeUnassigned) {
          // Can see pending (has department) but not unassigned (no department)
          // Show: assigned to user OR (not assigned AND has department in user's departments)
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('department_id, role')
            .eq('id', user.id)
            .single();
          
          const isAdminOrSupervisor = userProfile?.role === 'admin' || userProfile?.role === 'supervisor';
          
          if (isAdminOrSupervisor) {
            // Admin/Supervisor: show assigned OR has department (not completely unassigned)
            query = query.or(`assigned_to.not.is.null,department_id.not.is.null`);
          } else {
            // Regular user: show assigned to them OR pending in their departments
            const { data: userDepts } = await supabase
              .from('user_departments')
              .select('department_id')
              .eq('user_id', user.id);
            
            const departmentIds = [
              ...(userDepts?.map(ud => ud.department_id) || []),
              userProfile?.department_id
            ].filter(Boolean) as string[];
            
            if (departmentIds.length > 0) {
              // Show: assigned to me OR (not assigned AND department in my departments)
              const deptFilter = departmentIds.map(d => `department_id.eq.${d}`).join(',');
              query = query.or(`assigned_to.eq.${user.id},and(assigned_to.is.null,or(${deptFilter}))`);
            } else {
              // No departments, only show conversations assigned to user
              query = query.eq('assigned_to', user.id);
            }
          }
        }
        // If both canSeePending and canSeeUnassigned are true, no additional filter needed (show all)
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

      // *** BUSCA POR TELEFONE OU NOME - SERVIDOR (com busca sem acentos) ***
      if (searchQuery && searchQuery.length >= 3) {
        // Busca usando função RPC que ignora acentos
        const { data: matchingContacts } = await supabase
          .rpc('search_contacts_unaccent', { p_search_term: searchQuery.trim() });
        
        if (matchingContacts && matchingContacts.length > 0) {
          const contactIds = matchingContacts.map((c: { id: string }) => c.id);
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
        const hasNoTagFilter = tagIds.includes('no_tag');
        const realTagIds = tagIds.filter(id => id !== 'no_tag');
        
        if (hasNoTagFilter && realTagIds.length === 0) {
          // APENAS "sem etiqueta" selecionado - buscar contatos SEM tags
          const { data: contactsWithTags } = await supabase
            .from('contact_tags')
            .select('contact_id');
          
          const contactIdsWithTags = [...new Set(contactsWithTags?.map(ct => ct.contact_id) || [])];
          
          if (contactIdsWithTags.length > 0) {
            // Buscar conversas cujo contact_id NÃO está na lista de contatos com tags
            query = query.not('contact_id', 'in', `(${contactIdsWithTags.join(',')})`);
          }
          // Se não há contatos com tags, não precisa filtrar (todos são "sem etiqueta")
          
        } else if (hasNoTagFilter && realTagIds.length > 0) {
          // "Sem etiqueta" E outras tags selecionadas - buscar ambos (união)
          const { data: taggedContacts } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', realTagIds);
          
          const { data: allTaggedContacts } = await supabase
            .from('contact_tags')
            .select('contact_id');
          
          const contactIdsWithSelectedTags = [...new Set(taggedContacts?.map(tc => tc.contact_id) || [])];
          const allContactIdsWithTags = new Set(allTaggedContacts?.map(tc => tc.contact_id) || []);
          
          // Buscar todos os contact_ids de conversas ativas
          const { data: allConvContacts } = await supabase
            .from('conversations')
            .select('contact_id')
            .in('status', ['open', 'pending']);
          
          // Contatos sem tags = contatos de conversas que NÃO estão em allContactIdsWithTags
          const noTagContactIds = (allConvContacts || [])
            .map(c => c.contact_id)
            .filter(id => !allContactIdsWithTags.has(id));
          
          // União: contatos com as tags selecionadas OU sem nenhuma tag
          const unionContactIds = [...new Set([...contactIdsWithSelectedTags, ...noTagContactIds])];
          
          if (unionContactIds.length > 0) {
            query = query.in('contact_id', unionContactIds);
          } else {
            return { conversations: [] as Conversation[], nextPage: undefined, pageParam: 0 };
          }
          
        } else {
          // Apenas tags específicas (comportamento atual)
          const { data: taggedContacts } = await supabase
            .from('contact_tags')
            .select('contact_id')
            .in('tag_id', tagIds);
          
          if (taggedContacts && taggedContacts.length > 0) {
            const contactIds = [...new Set(taggedContacts.map(tc => tc.contact_id))];
            query = query.in('contact_id', contactIds);
          } else {
            return { conversations: [] as Conversation[], nextPage: undefined, pageParam: 0 };
          }
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
        case 'not_replied':
          // Filter: last message is from client (not from me) - agent hasn't replied
          query = query
            .eq('last_message_is_from_me', false)
            .order('last_message_at', { ascending: false, nullsFirst: false });
          break;
        case 'client_not_replied':
          // Filter: last message is from agent (from me) - client hasn't replied
          query = query
            .eq('last_message_is_from_me', true)
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
    staleTime: 60000, // OTIMIZAÇÃO: 1 minuto de cache
    refetchOnWindowFocus: false,
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
        .select('id, assigned_to, is_unread, channel_id, department_id, status, last_message_is_from_me, contact:contacts(first_contact_at)');
      
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
    staleTime: 2 * 60 * 1000, // OTIMIZAÇÃO: 2 minutos de cache
    refetchOnWindowFocus: false,
  });
}

// Hook to get real counts for sort filters from database
export function useSortFilterCounts(statusFilter: StatusFilter = 'active') {
  return useQuery({
    queryKey: ['sort-filter-counts', statusFilter],
    queryFn: async () => {
      // Build status condition
      const statusCondition = statusFilter === 'active' 
        ? 'status.in.(open,pending)' 
        : statusFilter === 'all' 
          ? undefined 
          : `status.eq.${statusFilter}`;
      
      // Fetch counts in parallel
      const [notRepliedResult, clientNotRepliedResult] = await Promise.all([
        // Not replied: last_message_is_from_me = false
        supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('last_message_is_from_me', false)
          .or(statusCondition || 'status.in.(open,pending,closed)'),
        // Client not replied: last_message_is_from_me = true
        supabase
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .eq('last_message_is_from_me', true)
          .or(statusCondition || 'status.in.(open,pending,closed)'),
      ]);

      return {
        not_replied: notRepliedResult.count || 0,
        client_not_replied: clientNotRepliedResult.count || 0,
      };
    },
    staleTime: 60000, // OTIMIZAÇÃO: 1 minuto de cache
    refetchOnWindowFocus: false,
  });
}
