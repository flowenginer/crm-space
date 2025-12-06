import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, startOfWeek, startOfMonth, subDays, subWeeks, subMonths, endOfDay, endOfWeek, endOfMonth, format } from 'date-fns';

// Filters interface for contextual counts
export interface CountFilters {
  departmentId?: string;
  agentId?: string;
  origin?: 'meta_ads' | 'organic' | 'all';
  dateFilter?: string;
  customDateFrom?: Date;
  customDateTo?: Date;
  channelId?: string;
}

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
 */
export function useConversationTotalCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['conversation-total-counts', filters],
    queryFn: async (): Promise<ConversationCounts> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Build base queries with filters
      let allQuery = supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'open');
      let mineQuery = user ? supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('assigned_to', user.id) : null;
      let unassignedQuery = supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'open').is('assigned_to', null);
      let unreadQuery = supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('is_unread', true);
      
      // Apply filters
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
      let query = supabase.from('conversations').select('channel_id').eq('status', 'open');
      
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
 */
export function useDateFilterCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['date-filter-counts', filters],
    queryFn: async (): Promise<DateFilterCounts> => {
      const now = new Date();
      
      // Format dates for PostgreSQL
      const todayStart = format(startOfDay(now), 'yyyy-MM-dd');
      const todayEnd = format(endOfDay(now), "yyyy-MM-dd'T'23:59:59");
      
      const yesterdayStart = format(startOfDay(subDays(now, 1)), 'yyyy-MM-dd');
      const yesterdayEnd = format(endOfDay(subDays(now, 1)), "yyyy-MM-dd'T'23:59:59");
      
      const thisWeekStart = format(startOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const lastWeekStart = format(startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const lastWeekEnd = format(endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 }), "yyyy-MM-dd'T'23:59:59");
      
      const thisMonthStart = format(startOfMonth(now), 'yyyy-MM-dd');
      const lastMonthStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
      const lastMonthEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd'T'23:59:59");
      
      // Build base query with filters (excluding date filters)
      const buildQuery = () => {
        let query = supabase.from('conversations').select('id, contact:contacts!inner(first_contact_at)', { count: 'exact', head: true }).eq('status', 'open');
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
      
      // Execute all count queries in parallel
      const [todayResult, yesterdayResult, thisWeekResult, lastWeekResult, thisMonthResult, lastMonthResult] = await Promise.all([
        buildQuery().gte('contact.first_contact_at', todayStart).lte('contact.first_contact_at', todayEnd),
        buildQuery().gte('contact.first_contact_at', yesterdayStart).lte('contact.first_contact_at', yesterdayEnd),
        buildQuery().gte('contact.first_contact_at', thisWeekStart).lte('contact.first_contact_at', todayEnd),
        buildQuery().gte('contact.first_contact_at', lastWeekStart).lte('contact.first_contact_at', lastWeekEnd),
        buildQuery().gte('contact.first_contact_at', thisMonthStart).lte('contact.first_contact_at', todayEnd),
        buildQuery().gte('contact.first_contact_at', lastMonthStart).lte('contact.first_contact_at', lastMonthEnd),
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
      let query = supabase.from('conversations').select('department_id').eq('status', 'open').not('department_id', 'is', null);
      
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
      let query = supabase.from('conversations').select('id, referral_source, contact:contacts(origin)').eq('status', 'open');
      
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
 */
export function useTagCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['tag-counts', filters],
    queryFn: async (): Promise<Record<string, number>> => {
      let query = supabase.from('conversations').select('contact:contacts(id)').eq('status', 'open');
      
      // Apply filters
      if (filters) {
        if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
        if (filters.agentId) query = query.eq('assigned_to', filters.agentId);
        if (filters.channelId && filters.channelId !== 'no_channel') query = query.eq('channel_id', filters.channelId);
        else if (filters.channelId === 'no_channel') query = query.is('channel_id', null);
        if (filters.origin === 'meta_ads') query = query.eq('referral_source', 'meta_ads');
        else if (filters.origin === 'organic') query = query.or('referral_source.is.null,referral_source.neq.meta_ads');
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const contactIds = data?.map(c => (c.contact as any)?.id).filter(Boolean) || [];
      
      if (contactIds.length === 0) return {};
      
      // Get tag assignments for these contacts
      const { data: tagData, error: tagError } = await supabase
        .from('contact_tags')
        .select('tag_id')
        .in('contact_id', contactIds);
      
      if (tagError) throw tagError;
      
      const counts: Record<string, number> = {};
      tagData?.forEach(ct => {
        counts[ct.tag_id] = (counts[ct.tag_id] || 0) + 1;
      });
      
      return counts;
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
      let query = supabase.from('conversations').select('assigned_to').eq('status', 'open').not('assigned_to', 'is', null);
      
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
      let query = supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('is_unread', true);
      
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
