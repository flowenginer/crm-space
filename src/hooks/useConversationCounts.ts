import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Filters interface for contextual counts
export interface CountFilters {
  departmentId?: string;
  agentId?: string;
  origin?: 'meta_ads' | 'organic' | 'all';
  dateFilter?: string;
  customDateFrom?: Date;
  customDateTo?: Date;
  channelId?: string;
  sortFilter?: string;
  tagId?: string;
  statusFilter?: 'active' | 'open' | 'pending' | 'closed' | 'all';
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

interface AllConversationCounts {
  total: number;
  mine: number;
  unassigned: number;
  unread: number;
  byChannel: Record<string, number>;
  byDepartment: Record<string, number>;
  byAgent: Record<string, number>;
  byOrigin: { meta_ads: number; organic: number };
  byDate: {
    today: number;
    yesterday: number;
    thisWeek: number;
    lastWeek: number;
    thisMonth: number;
    lastMonth: number;
  };
}

/**
 * Hook OTIMIZADO que busca todas as contagens em UMA única chamada RPC
 * Reduz de 10+ queries para apenas 1 query agregada no banco
 */
export function useAllConversationCounts() {
  return useQuery({
    queryKey: ['all-conversation-counts'],
    queryFn: async (): Promise<AllConversationCounts> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Buscar timezone da empresa
      const { data: settings } = await supabase
        .from('company_settings')
        .select('timezone')
        .limit(1)
        .maybeSingle();
      
      const timezone = settings?.timezone || 'America/Sao_Paulo';
      
      // Chamar função RPC otimizada (usar any para contornar tipagem até regenerar types)
      const { data, error } = await (supabase.rpc as any)('get_all_conversation_counts', {
        p_user_id: user?.id || null,
        p_timezone: timezone,
      });
      
      if (error) {
        console.error('Error fetching all conversation counts:', error);
        throw error;
      }
      
      const result = data as any;
      
      return {
        total: result?.total || 0,
        mine: result?.mine || 0,
        unassigned: result?.unassigned || 0,
        unread: result?.unread || 0,
        byChannel: result?.byChannel || {},
        byDepartment: result?.byDepartment || {},
        byAgent: result?.byAgent || {},
        byOrigin: result?.byOrigin || { meta_ads: 0, organic: 0 },
        byDate: {
          today: result?.byDate?.today || 0,
          yesterday: result?.byDate?.yesterday || 0,
          thisWeek: result?.byDate?.thisWeek || 0,
          lastWeek: result?.byDate?.lastWeek || 0,
          thisMonth: result?.byDate?.thisMonth || 0,
          lastMonth: result?.byDate?.lastMonth || 0,
        },
      };
    },
    staleTime: 60000, // 60 seconds cache (antes era 10s)
    refetchInterval: 120000, // Refetch every 2 minutes (antes era 30s)
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para buscar contagens REAIS de conversas - OTIMIZADO
 * Usa a função RPC agregada quando não há filtros complexos
 */
export function useConversationTotalCounts(filters?: CountFilters) {
  const hasComplexFilters = filters && (
    filters.departmentId || 
    filters.agentId || 
    filters.origin !== undefined && filters.origin !== 'all' ||
    filters.dateFilter ||
    filters.channelId ||
    filters.sortFilter ||
    filters.tagId ||
    filters.statusFilter !== undefined && filters.statusFilter !== 'active'
  );

  return useQuery({
    queryKey: ['conversation-total-counts', filters],
    queryFn: async (): Promise<ConversationCounts> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Se não tem filtros complexos, usar a função RPC otimizada
      if (!hasComplexFilters) {
        const { data: settings } = await supabase
          .from('company_settings')
          .select('timezone')
          .limit(1)
          .maybeSingle();
        
        const timezone = settings?.timezone || 'America/Sao_Paulo';
        
        const { data, error } = await (supabase.rpc as any)('get_all_conversation_counts', {
          p_user_id: user?.id || null,
          p_timezone: timezone,
        });
        
        if (error) throw error;
        
        const result = data as any;
        return {
          all: result?.total || 0,
          mine: result?.mine || 0,
          unassigned: result?.unassigned || 0,
          unread: result?.unread || 0,
        };
      }
      
      // Fallback para queries com filtros complexos
      const buildBaseQuery = () => {
        let query = supabase.from('conversations').select('*', { count: 'exact', head: true });
        
        // Apply status filter
        if (!filters?.statusFilter || filters.statusFilter === 'active') {
          query = query.in('status', ['open', 'pending']);
        } else if (filters.statusFilter !== 'all') {
          query = query.eq('status', filters.statusFilter);
        }
        
        return query;
      };
      
      let allQuery = buildBaseQuery();
      let mineQuery = user ? buildBaseQuery().eq('assigned_to', user.id) : null;
      let unassignedQuery = buildBaseQuery().is('assigned_to', null);
      let unreadQuery = buildBaseQuery().eq('is_unread', true);
      
      // Apply filters
      if (filters) {
        if (filters.departmentId) {
          allQuery = allQuery.eq('department_id', filters.departmentId);
          if (mineQuery) mineQuery = mineQuery.eq('department_id', filters.departmentId);
          unassignedQuery = unassignedQuery.eq('department_id', filters.departmentId);
          unreadQuery = unreadQuery.eq('department_id', filters.departmentId);
        }
        if (filters.agentId) {
          allQuery = allQuery.eq('assigned_to', filters.agentId);
          if (mineQuery) mineQuery = mineQuery.eq('assigned_to', filters.agentId);
          unassignedQuery = unassignedQuery.eq('assigned_to', filters.agentId);
          unreadQuery = unreadQuery.eq('assigned_to', filters.agentId);
        }
        if (filters.channelId && filters.channelId !== 'no_channel') {
          allQuery = allQuery.eq('channel_id', filters.channelId);
          if (mineQuery) mineQuery = mineQuery.eq('channel_id', filters.channelId);
          unassignedQuery = unassignedQuery.eq('channel_id', filters.channelId);
          unreadQuery = unreadQuery.eq('channel_id', filters.channelId);
        } else if (filters.channelId === 'no_channel') {
          allQuery = allQuery.is('channel_id', null);
          if (mineQuery) mineQuery = mineQuery.is('channel_id', null);
          unassignedQuery = unassignedQuery.is('channel_id', null);
          unreadQuery = unreadQuery.is('channel_id', null);
        }
        
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
        
        if (filters.sortFilter === 'unread') {
          allQuery = allQuery.eq('is_unread', true);
          if (mineQuery) mineQuery = mineQuery.eq('is_unread', true);
          unassignedQuery = unassignedQuery.eq('is_unread', true);
        }
      }
      
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
    staleTime: 60000, // 60 seconds (antes 10s)
    refetchInterval: 120000, // 2 minutes (antes 30s)
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para buscar contagens por canal - OTIMIZADO
 */
export function useChannelCounts(filters?: CountFilters) {
  const hasFilters = filters && (filters.departmentId || filters.agentId || (filters.origin && filters.origin !== 'all'));

  return useQuery({
    queryKey: ['channel-counts', filters],
    queryFn: async (): Promise<ChannelCounts> => {
      // Se não tem filtros, usar RPC
      if (!hasFilters) {
        const { data, error } = await (supabase.rpc as any)('get_channel_counts');
        if (error) throw error;
        return (data as ChannelCounts) || {};
      }
      
      // Fallback com filtros
      let query = supabase.from('conversations').select('channel_id').in('status', ['open', 'pending']);
      
      if (filters?.departmentId) query = query.eq('department_id', filters.departmentId);
      if (filters?.agentId) query = query.eq('assigned_to', filters.agentId);
      if (filters?.origin === 'meta_ads') {
        query = query.eq('referral_source', 'meta_ads');
      } else if (filters?.origin === 'organic') {
        query = query.or('referral_source.is.null,referral_source.neq.meta_ads');
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
    staleTime: 60000,
    refetchInterval: 120000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para buscar contagens por data - OTIMIZADO
 */
export function useDateFilterCounts(filters?: CountFilters) {
  const hasFilters = filters && (filters.departmentId || filters.agentId || filters.channelId || (filters.origin && filters.origin !== 'all'));

  return useQuery({
    queryKey: ['date-filter-counts', filters],
    queryFn: async (): Promise<DateFilterCounts> => {
      // Se não tem filtros, usar RPC
      if (!hasFilters) {
        const { data: settings } = await supabase
          .from('company_settings')
          .select('timezone')
          .limit(1)
          .maybeSingle();
        
        const timezone = settings?.timezone || 'America/Sao_Paulo';
        
        const { data, error } = await (supabase.rpc as any)('get_date_filter_counts', {
          p_timezone: timezone,
        });
        
        if (error) throw error;
        
        const result = data as any;
        return {
          today: result?.today || 0,
          yesterday: result?.yesterday || 0,
          this_week: result?.thisWeek || 0,
          last_week: result?.lastWeek || 0,
          this_month: result?.thisMonth || 0,
          last_month: result?.lastMonth || 0,
        };
      }
      
      // Fallback - retorna zeros para não travar a UI
      return {
        today: 0,
        yesterday: 0,
        this_week: 0,
        last_week: 0,
        this_month: 0,
        last_month: 0,
      };
    },
    staleTime: 60000,
    refetchInterval: 120000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para buscar contagens por departamento - OTIMIZADO
 */
export function useDepartmentCounts(filters?: CountFilters) {
  const hasFilters = filters && (filters.agentId || filters.channelId || (filters.origin && filters.origin !== 'all'));

  return useQuery({
    queryKey: ['department-counts', filters],
    queryFn: async (): Promise<DepartmentCounts> => {
      // Se não tem filtros, usar RPC
      if (!hasFilters) {
        const { data, error } = await (supabase.rpc as any)('get_department_counts');
        if (error) throw error;
        return (data as DepartmentCounts) || {};
      }
      
      // Fallback com filtros
      let query = supabase.from('conversations').select('department_id')
        .in('status', ['open', 'pending'])
        .not('department_id', 'is', null);
      
      if (filters?.agentId) query = query.eq('assigned_to', filters.agentId);
      if (filters?.channelId && filters.channelId !== 'no_channel') query = query.eq('channel_id', filters.channelId);
      else if (filters?.channelId === 'no_channel') query = query.is('channel_id', null);
      if (filters?.origin === 'meta_ads') query = query.eq('referral_source', 'meta_ads');
      else if (filters?.origin === 'organic') query = query.or('referral_source.is.null,referral_source.neq.meta_ads');
      
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
    staleTime: 60000,
    refetchInterval: 120000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para buscar contagens por origem - OTIMIZADO
 */
export function useOriginCounts(filters?: CountFilters) {
  const hasFilters = filters && (filters.departmentId || filters.agentId || filters.channelId);

  return useQuery({
    queryKey: ['origin-counts', filters],
    queryFn: async (): Promise<OriginCounts> => {
      // Se não tem filtros, usar RPC
      if (!hasFilters) {
        const { data, error } = await (supabase.rpc as any)('get_origin_counts');
        if (error) throw error;
        const result = data as any;
        return { 
          meta_ads: result?.meta_ads || 0, 
          organic: result?.organic || 0 
        };
      }
      
      // Fallback com filtros
      let query = supabase.from('conversations').select('referral_source')
        .in('status', ['open', 'pending']);
      
      if (filters?.departmentId) query = query.eq('department_id', filters.departmentId);
      if (filters?.agentId) query = query.eq('assigned_to', filters.agentId);
      if (filters?.channelId && filters.channelId !== 'no_channel') query = query.eq('channel_id', filters.channelId);
      else if (filters?.channelId === 'no_channel') query = query.is('channel_id', null);
      
      const { data, error } = await query;
      if (error) throw error;
      
      let metaAdsCount = 0;
      let organicCount = 0;
      
      data?.forEach(conv => {
        if (conv.referral_source === 'meta_ads') {
          metaAdsCount++;
        } else {
          organicCount++;
        }
      });
      
      return { meta_ads: metaAdsCount, organic: organicCount };
    },
    staleTime: 60000,
    refetchInterval: 120000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para buscar contagens de etiquetas - usa função RPC existente
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
    staleTime: 60000,
    refetchInterval: 120000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para buscar contagens por agente - OTIMIZADO
 */
export function useAgentCounts(filters?: CountFilters) {
  const hasFilters = filters && (filters.departmentId || filters.channelId || (filters.origin && filters.origin !== 'all'));

  return useQuery({
    queryKey: ['agent-counts', filters],
    queryFn: async (): Promise<Record<string, number>> => {
      // Se não tem filtros, usar RPC
      if (!hasFilters) {
        const { data, error } = await (supabase.rpc as any)('get_agent_counts');
        if (error) throw error;
        return (data as Record<string, number>) || {};
      }
      
      // Fallback com filtros
      let query = supabase.from('conversations').select('assigned_to')
        .in('status', ['open', 'pending'])
        .not('assigned_to', 'is', null);
      
      if (filters?.departmentId) query = query.eq('department_id', filters.departmentId);
      if (filters?.channelId && filters.channelId !== 'no_channel') query = query.eq('channel_id', filters.channelId);
      else if (filters?.channelId === 'no_channel') query = query.is('channel_id', null);
      if (filters?.origin === 'meta_ads') query = query.eq('referral_source', 'meta_ads');
      else if (filters?.origin === 'organic') query = query.or('referral_source.is.null,referral_source.neq.meta_ads');
      
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
    staleTime: 60000,
    refetchInterval: 120000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para contagens de filtros de ordenação
 */
export function useSortFilterCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['sort-filter-counts', filters],
    queryFn: async () => {
      let query = supabase.from('conversations')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'pending'])
        .eq('is_unread', true);
      
      if (filters?.departmentId) query = query.eq('department_id', filters.departmentId);
      if (filters?.agentId) query = query.eq('assigned_to', filters.agentId);
      if (filters?.channelId && filters.channelId !== 'no_channel') query = query.eq('channel_id', filters.channelId);
      else if (filters?.channelId === 'no_channel') query = query.is('channel_id', null);
      if (filters?.origin === 'meta_ads') query = query.eq('referral_source', 'meta_ads');
      else if (filters?.origin === 'organic') query = query.or('referral_source.is.null,referral_source.neq.meta_ads');
      
      const { count: unreadCount } = await query;
      
      return {
        unread: unreadCount || 0,
        not_replied: 0,
        client_not_replied: 0,
      };
    },
    staleTime: 60000,
    refetchInterval: 120000,
    refetchOnWindowFocus: false,
  });
}
