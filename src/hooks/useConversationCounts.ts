import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, startOfWeek, startOfMonth, subDays, subWeeks, subMonths, endOfDay, endOfWeek, endOfMonth } from 'date-fns';

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
  
  // Criar data com hora 00:00 ou 23:59:59 no timezone local
  const timeStr = isEnd ? '23:59:59' : '00:00:00';
  const localDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${timeStr}`;
  
  // Usar Intl para converter para UTC
  const localDate = new Date(localDateStr);
  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  
  // Calcular offset do timezone
  const nowInTz = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = date.getTime() - nowInTz.getTime();
  
  // Criar a data correta: queremos o início/fim do dia no timezone, convertido para UTC
  const targetDate = new Date(year, month, day, isEnd ? 23 : 0, isEnd ? 59 : 0, isEnd ? 59 : 0);
  return new Date(targetDate.getTime() + offsetMs);
}

// Filters interface for contextual counts
export interface CountFilters {
  departmentId?: string;
  agentId?: string;
  origin?: 'meta_ads' | 'organic' | 'all';
  dateFilter?: string;
  customDateFrom?: Date;
  customDateTo?: Date;
  channelId?: string;
  sortFilter?: string; // 'unread', 'not_replied', 'client_not_replied'
  tagId?: string; // Filter by specific tag
  statusFilter?: 'active' | 'open' | 'pending' | 'closed' | 'all'; // Conversation status filter
}

// Helper to apply status filter to a query
const applyStatusFilter = (query: any, statusFilter?: string) => {
  if (!statusFilter || statusFilter === 'active') {
    // Default: show open + pending
    return query.in('status', ['open', 'pending']);
  } else if (statusFilter === 'all') {
    // All: no status filter
    return query;
  } else {
    // Specific status: open, pending, or closed
    return query.eq('status', statusFilter);
  }
};

interface ConversationCounts {
  all: number;
  mine: number;
  unassigned: number;
  unread: number;
}

interface ChannelCounts {
  [channelId: string]: number;
}

interface DateFilterCounts {
  today: number;
  yesterday: number;
  this_week: number;
  last_week: number;
  this_month: number;
  last_month: number;
}

interface DepartmentCounts {
  [departmentId: string]: number;
}

interface OriginCounts {
  meta_ads: number;
  organic: number;
}

// Helper to apply common filters to a query
const applyFilters = (query: any, filters: CountFilters) => {
  if (filters.departmentId) {
    query = query.eq('department_id', filters.departmentId);
  }
  if (filters.agentId) {
    query = query.eq('assigned_to', filters.agentId);
  }
  if (filters.channelId && filters.channelId !== 'no_channel') {
    query = query.eq('channel_id', filters.channelId);
  } else if (filters.channelId === 'no_channel') {
    query = query.is('channel_id', null);
  }
  return query;
};

/**
 * Hook para buscar contagens REAIS de conversas do banco de dados
 * Usa queries COUNT(*) otimizadas - não carrega todas as conversas
 * Aceita filtros para contagens contextuais
 * INCLUI TODOS OS FILTROS: data, sortFilter (unread), tagId, etc.
 */
export function useConversationTotalCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['conversation-total-counts', filters],
    queryFn: async (): Promise<ConversationCounts> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Se tiver filtro de data, precisamos fazer join com contacts
      const needsContactJoin = filters?.dateFilter && filters.dateFilter !== 'all';
      // Se tiver filtro de tag, precisamos buscar contact_ids primeiro
      const needsTagFilter = filters?.tagId;
      
      // Preparar filtro de data se necessário
      let dateStartISO: string | undefined;
      let dateEndISO: string | undefined;
      
      if (needsContactJoin) {
        // Buscar timezone da empresa
        const { data: settings } = await supabase
          .from('company_settings')
          .select('timezone')
          .limit(1)
          .maybeSingle();
        
        const timezone = settings?.timezone || 'America/Sao_Paulo';
        const now = new Date();
        
        // Calcular datas com base no filtro
        if (filters?.dateFilter === 'today') {
          dateStartISO = getTimezoneAdjustedDate(now, timezone, false).toISOString();
          dateEndISO = getTimezoneAdjustedDate(now, timezone, true).toISOString();
        } else if (filters?.dateFilter === 'yesterday') {
          const yesterday = subDays(now, 1);
          dateStartISO = getTimezoneAdjustedDate(yesterday, timezone, false).toISOString();
          dateEndISO = getTimezoneAdjustedDate(yesterday, timezone, true).toISOString();
        } else if (filters?.dateFilter === 'this_week') {
          const weekStart = startOfWeek(now, { weekStartsOn: 0 });
          dateStartISO = getTimezoneAdjustedDate(weekStart, timezone, false).toISOString();
          dateEndISO = getTimezoneAdjustedDate(now, timezone, true).toISOString();
        } else if (filters?.dateFilter === 'last_week') {
          const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
          const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
          dateStartISO = getTimezoneAdjustedDate(lastWeekStart, timezone, false).toISOString();
          dateEndISO = getTimezoneAdjustedDate(lastWeekEnd, timezone, true).toISOString();
        } else if (filters?.dateFilter === 'this_month') {
          const monthStart = startOfMonth(now);
          dateStartISO = getTimezoneAdjustedDate(monthStart, timezone, false).toISOString();
          dateEndISO = getTimezoneAdjustedDate(now, timezone, true).toISOString();
        } else if (filters?.dateFilter === 'last_month') {
          const lastMonthStart = startOfMonth(subMonths(now, 1));
          const lastMonthEnd = endOfMonth(subMonths(now, 1));
          dateStartISO = getTimezoneAdjustedDate(lastMonthStart, timezone, false).toISOString();
          dateEndISO = getTimezoneAdjustedDate(lastMonthEnd, timezone, true).toISOString();
        } else if (filters?.dateFilter === 'custom' && filters.customDateFrom && filters.customDateTo) {
          dateStartISO = getTimezoneAdjustedDate(filters.customDateFrom, timezone, false).toISOString();
          dateEndISO = getTimezoneAdjustedDate(filters.customDateTo, timezone, true).toISOString();
        }
      }
      
      // Se tiver filtro de tag, buscar contact_ids primeiro
      let tagContactIds: string[] | undefined;
      if (needsTagFilter) {
        const { data: tagData } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .eq('tag_id', filters!.tagId!);
        tagContactIds = tagData?.map(t => t.contact_id) || [];
        if (tagContactIds.length === 0) {
          // Sem contatos com essa tag = 0 conversas
          return { all: 0, mine: 0, unassigned: 0, unread: 0 };
        }
      }
      
      // Build base queries - usar join com contacts se filtro de data ativo
      const buildBaseQuery = () => {
        let baseQuery;
        if (needsContactJoin) {
          baseQuery = supabase.from('conversations')
            .select('id, contact:contacts!inner(first_contact_at)', { count: 'exact', head: true })
            .gte('contact.first_contact_at', dateStartISO!)
            .lte('contact.first_contact_at', dateEndISO!);
        } else {
          baseQuery = supabase.from('conversations').select('*', { count: 'exact', head: true });
        }
        // Apply status filter
        return applyStatusFilter(baseQuery, filters?.statusFilter);
      };
      
      let allQuery = buildBaseQuery();
      let mineQuery = user ? buildBaseQuery().eq('assigned_to', user.id) : null;
      let unassignedQuery = buildBaseQuery().is('assigned_to', null);
      let unreadQuery = buildBaseQuery().eq('is_unread', true);
      
      // Apply basic filters (department, agent, channel)
      if (filters) {
        allQuery = applyFilters(allQuery, filters);
        if (mineQuery) mineQuery = applyFilters(mineQuery, filters);
        unassignedQuery = applyFilters(unassignedQuery, filters);
        unreadQuery = applyFilters(unreadQuery, filters);
        
        // Origin filter
        if (filters.origin === 'meta_ads') {
          allQuery = allQuery.eq('referral_source', 'meta_ads');
          if (mineQuery) mineQuery = mineQuery.eq('referral_source', 'meta_ads');
          unassignedQuery = unassignedQuery.eq('referral_source', 'meta_ads');
          unreadQuery = unreadQuery.eq('referral_source', 'meta_ads');
        } else if (filters.origin === 'organic') {
          allQuery = allQuery.or('referral_source.is.null,referral_source.neq.meta_ads');
          if (mineQuery) mineQuery = mineQuery.or('referral_source.is.null,referral_source.neq.meta_ads');
          unassignedQuery = unassignedQuery.or('referral_source.is.null,referral_source.neq.meta_ads');
          unreadQuery = unreadQuery.or('referral_source.is.null,referral_source.neq.meta_ads');
        }
        
        // SortFilter 'unread' - aplicar is_unread = true em todas as queries
        if (filters.sortFilter === 'unread') {
          allQuery = allQuery.eq('is_unread', true);
          if (mineQuery) mineQuery = mineQuery.eq('is_unread', true);
          unassignedQuery = unassignedQuery.eq('is_unread', true);
          // unreadQuery já tem is_unread = true
        }
        
        // Tag filter - filtrar por contact_id
        if (tagContactIds && tagContactIds.length > 0) {
          allQuery = allQuery.in('contact_id', tagContactIds);
          if (mineQuery) mineQuery = mineQuery.in('contact_id', tagContactIds);
          unassignedQuery = unassignedQuery.in('contact_id', tagContactIds);
          unreadQuery = unreadQuery.in('contact_id', tagContactIds);
        }
      }
      
      // Fetch all counts in parallel for efficiency
      const [allResult, mineResult, unassignedResult, unreadResult] = await Promise.all([
        allQuery,
        mineQuery ? mineQuery : Promise.resolve({ count: 0 }),
        unassignedQuery,
        unreadQuery,
      ]);

      return {
        all: allResult.count || 0,
        mine: (mineResult as any).count || 0,
        unassigned: unassignedResult.count || 0,
        unread: unreadResult.count || 0,
      };
    },
    staleTime: 10000, // 10 seconds cache
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Hook para buscar contagens por canal - contextual
 */
export function useChannelCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['channel-counts', filters],
    queryFn: async (): Promise<ChannelCounts> => {
      let query = applyStatusFilter(supabase.from('conversations').select('channel_id'), filters?.statusFilter);
      
      // Apply filters (excluding channelId since we're grouping by it)
      if (filters) {
        if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
        if (filters.agentId) query = query.eq('assigned_to', filters.agentId);
        if (filters.origin === 'meta_ads') {
          query = query.eq('referral_source', 'meta_ads');
        } else if (filters.origin === 'organic') {
          query = query.or('referral_source.is.null,referral_source.neq.meta_ads');
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const counts: ChannelCounts = {};
      data?.forEach(conv => {
        const channelId = conv.channel_id || 'no_channel';
        counts[channelId] = (counts[channelId] || 0) + 1;
      });
      
      return counts;
    },
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

/**
 * Hook para buscar contagens por data do primeiro contato - contextual
 * USA TIMEZONE DA EMPRESA para calcular corretamente "Hoje", "Ontem", etc.
 */
export function useDateFilterCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['date-filter-counts', filters],
    queryFn: async (): Promise<DateFilterCounts> => {
      // Buscar timezone da empresa
      const { data: settings } = await supabase
        .from('company_settings')
        .select('timezone')
        .limit(1)
        .single();
      
      const timezone = settings?.timezone || 'America/Sao_Paulo';
      const now = new Date();
      
      // Calcular datas usando o timezone da empresa
      const todayStart = getTimezoneAdjustedDate(now, timezone, false);
      const todayEnd = getTimezoneAdjustedDate(now, timezone, true);
      
      const yesterday = subDays(now, 1);
      const yesterdayStart = getTimezoneAdjustedDate(yesterday, timezone, false);
      const yesterdayEnd = getTimezoneAdjustedDate(yesterday, timezone, true);
      
      const weekStart = startOfWeek(now, { weekStartsOn: 0 });
      const thisWeekStart = getTimezoneAdjustedDate(weekStart, timezone, false);
      
      const lastWeekStartDate = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
      const lastWeekEndDate = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
      const lastWeekStart = getTimezoneAdjustedDate(lastWeekStartDate, timezone, false);
      const lastWeekEnd = getTimezoneAdjustedDate(lastWeekEndDate, timezone, true);
      
      const monthStart = startOfMonth(now);
      const thisMonthStart = getTimezoneAdjustedDate(monthStart, timezone, false);
      
      const lastMonthStartDate = startOfMonth(subMonths(now, 1));
      const lastMonthEndDate = endOfMonth(subMonths(now, 1));
      const lastMonthStart = getTimezoneAdjustedDate(lastMonthStartDate, timezone, false);
      const lastMonthEnd = getTimezoneAdjustedDate(lastMonthEndDate, timezone, true);
      
      // Build base query with filters (excluding date filters)
      const buildQuery = () => {
        let query = applyStatusFilter(supabase.from('conversations').select('id, contact:contacts!inner(first_contact_at)', { count: 'exact', head: true }), filters?.statusFilter);
        if (filters) {
          if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
          if (filters.agentId) query = query.eq('assigned_to', filters.agentId);
          if (filters.channelId && filters.channelId !== 'no_channel') query = query.eq('channel_id', filters.channelId);
          else if (filters.channelId === 'no_channel') query = query.is('channel_id', null);
          if (filters.origin === 'meta_ads') query = query.eq('referral_source', 'meta_ads');
          else if (filters.origin === 'organic') query = query.or('referral_source.is.null,referral_source.neq.meta_ads');
        }
        return query;
      };
      
      // Execute all count queries in parallel usando ISO strings
      const [todayResult, yesterdayResult, thisWeekResult, lastWeekResult, thisMonthResult, lastMonthResult] = await Promise.all([
        buildQuery().gte('contact.first_contact_at', todayStart.toISOString()).lte('contact.first_contact_at', todayEnd.toISOString()),
        buildQuery().gte('contact.first_contact_at', yesterdayStart.toISOString()).lte('contact.first_contact_at', yesterdayEnd.toISOString()),
        buildQuery().gte('contact.first_contact_at', thisWeekStart.toISOString()).lte('contact.first_contact_at', todayEnd.toISOString()),
        buildQuery().gte('contact.first_contact_at', lastWeekStart.toISOString()).lte('contact.first_contact_at', lastWeekEnd.toISOString()),
        buildQuery().gte('contact.first_contact_at', thisMonthStart.toISOString()).lte('contact.first_contact_at', todayEnd.toISOString()),
        buildQuery().gte('contact.first_contact_at', lastMonthStart.toISOString()).lte('contact.first_contact_at', lastMonthEnd.toISOString()),
      ]);
      
      return {
        today: todayResult.count || 0,
        yesterday: yesterdayResult.count || 0,
        this_week: thisWeekResult.count || 0,
        last_week: lastWeekResult.count || 0,
        this_month: thisMonthResult.count || 0,
        last_month: lastMonthResult.count || 0,
      };
    },
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

/**
 * Hook para buscar contagens por departamento - contextual
 */
export function useDepartmentCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['department-counts', filters],
    queryFn: async (): Promise<DepartmentCounts> => {
      let query = applyStatusFilter(supabase.from('conversations').select('department_id'), filters?.statusFilter).not('department_id', 'is', null);
      
      // Apply filters (excluding departmentId since we're grouping by it)
      if (filters) {
        if (filters.agentId) query = query.eq('assigned_to', filters.agentId);
        if (filters.channelId && filters.channelId !== 'no_channel') query = query.eq('channel_id', filters.channelId);
        else if (filters.channelId === 'no_channel') query = query.is('channel_id', null);
        if (filters.origin === 'meta_ads') query = query.eq('referral_source', 'meta_ads');
        else if (filters.origin === 'organic') query = query.or('referral_source.is.null,referral_source.neq.meta_ads');
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const counts: DepartmentCounts = {};
      data?.forEach(conv => {
        if (conv.department_id) {
          counts[conv.department_id] = (counts[conv.department_id] || 0) + 1;
        }
      });
      
      return counts;
    },
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

/**
 * Hook para buscar contagens por origem do lead (Meta Ads / Orgânico) - contextual
 */
export function useOriginCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['origin-counts', filters],
    queryFn: async (): Promise<OriginCounts> => {
      let query = applyStatusFilter(supabase.from('conversations').select('id, referral_source, contact:contacts(origin)'), filters?.statusFilter);
      
      // Apply filters (excluding origin since we're grouping by it)
      if (filters) {
        if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
        if (filters.agentId) query = query.eq('assigned_to', filters.agentId);
        if (filters.channelId && filters.channelId !== 'no_channel') query = query.eq('channel_id', filters.channelId);
        else if (filters.channelId === 'no_channel') query = query.is('channel_id', null);
      }
      
      const { data: allConversations, error } = await query;
      if (error) throw error;
      
      let metaAdsCount = 0;
      let organicCount = 0;
      
      allConversations?.forEach(conv => {
        const isMetaAds = conv.referral_source === 'meta_ads' || 
                         (conv.contact as any)?.origin === 'meta_ads';
        if (isMetaAds) {
          metaAdsCount++;
        } else {
          organicCount++;
        }
      });
      
      return {
        meta_ads: metaAdsCount,
        organic: organicCount,
      };
    },
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

/**
 * Hook para buscar contagens de etiquetas em conversas - contextual
 * Usa função RPC otimizada para evitar URLs muito longas
 */
export function useTagCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['tag-counts', filters],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.rpc('get_conversation_tag_counts', {
        p_department_id: filters?.departmentId || null,
        p_agent_id: filters?.agentId || null,
        p_channel_id: filters?.channelId && filters.channelId !== 'no_channel' ? filters.channelId : null,
        p_origin: filters?.origin && filters.origin !== 'all' ? filters.origin : null,
      });

      if (error) {
        console.error('Error fetching tag counts:', error);
        throw error;
      }
      
      return (data as Record<string, number>) || {};
    },
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

/**
 * Hook para buscar contagens por agente - contextual
 */
export function useAgentCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['agent-counts', filters],
    queryFn: async (): Promise<Record<string, number>> => {
      let query = applyStatusFilter(supabase.from('conversations').select('assigned_to'), filters?.statusFilter).not('assigned_to', 'is', null);
      
      // Apply filters (excluding agentId since we're grouping by it)
      if (filters) {
        if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
        if (filters.channelId && filters.channelId !== 'no_channel') query = query.eq('channel_id', filters.channelId);
        else if (filters.channelId === 'no_channel') query = query.is('channel_id', null);
        if (filters.origin === 'meta_ads') query = query.eq('referral_source', 'meta_ads');
        else if (filters.origin === 'organic') query = query.or('referral_source.is.null,referral_source.neq.meta_ads');
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(conv => {
        if (conv.assigned_to) {
          counts[conv.assigned_to] = (counts[conv.assigned_to] || 0) + 1;
        }
      });
      
      return counts;
    },
    staleTime: 10000,
    refetchInterval: 30000,
  });
}

/**
 * Hook para buscar contagens de filtros de ordenação (não lidas, não respondidas, etc) - contextual
 */
export function useSortFilterCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['sort-filter-counts', filters],
    queryFn: async () => {
      let query = applyStatusFilter(supabase.from('conversations').select('*', { count: 'exact', head: true }), filters?.statusFilter).eq('is_unread', true);
      
      // Apply filters
      if (filters) {
        query = applyFilters(query, filters);
        if (filters.origin === 'meta_ads') query = query.eq('referral_source', 'meta_ads');
        else if (filters.origin === 'organic') query = query.or('referral_source.is.null,referral_source.neq.meta_ads');
      }
      
      const { count: unreadCount } = await query;
      
      return {
        unread: unreadCount || 0,
        not_replied: 0, // Will be calculated from loaded data
        client_not_replied: 0, // Will be calculated from loaded data
      };
    },
    staleTime: 10000,
    refetchInterval: 30000,
  });
}
