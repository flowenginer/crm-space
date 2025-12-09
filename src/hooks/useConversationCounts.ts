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
  pending: number;
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

// Helper to get timezone
async function getTimezone(): Promise<string> {
  const { data: settings } = await supabase
    .from('company_settings')
    .select('timezone')
    .limit(1)
    .maybeSingle();
  return settings?.timezone || 'America/Sao_Paulo';
}

/**
 * Hook OTIMIZADO que busca todas as contagens em UMA única chamada RPC
 * Agora suporta todos os filtros!
 */
export function useAllConversationCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['all-conversation-counts', filters],
    queryFn: async (): Promise<AllConversationCounts> => {
      const { data: { user } } = await supabase.auth.getUser();
      const timezone = await getTimezone();
      
      // Chamar função RPC com todos os filtros
      const { data, error } = await (supabase.rpc as any)('get_all_conversation_counts', {
        p_user_id: user?.id || null,
        p_timezone: timezone,
        p_department_id: filters?.departmentId || null,
        p_agent_id: filters?.agentId || null,
        p_channel_id: filters?.channelId && filters.channelId !== 'no_channel' ? filters.channelId : null,
        p_origin: filters?.origin && filters.origin !== 'all' ? filters.origin : null,
        p_date_filter: filters?.dateFilter || null,
        p_status_filter: filters?.statusFilter || 'active',
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
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para buscar contagens REAIS de conversas - OTIMIZADO
 * Usa a função RPC com todos os filtros
 */
export function useConversationTotalCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['conversation-total-counts', filters],
    queryFn: async (): Promise<ConversationCounts> => {
      const { data: { user } } = await supabase.auth.getUser();
      const timezone = await getTimezone();
      
      // Get user's profile for pending count
      let userDepartmentIds: string[] = [];
      let isAdminOrSupervisor = false;
      
      if (user) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('department_id, role')
          .eq('id', user.id)
          .single();
        
        isAdminOrSupervisor = userProfile?.role === 'admin' || userProfile?.role === 'supervisor';
        
        if (!isAdminOrSupervisor) {
          const { data: userDepts } = await supabase
            .from('user_departments')
            .select('department_id')
            .eq('user_id', user.id);
          
          userDepartmentIds = [
            ...(userDepts?.map(ud => ud.department_id) || []),
            userProfile?.department_id
          ].filter(Boolean) as string[];
        }
      }
      
      // Usar a função RPC com todos os filtros
      const { data, error } = await (supabase.rpc as any)('get_all_conversation_counts', {
        p_user_id: user?.id || null,
        p_timezone: timezone,
        p_department_id: filters?.departmentId || null,
        p_agent_id: filters?.agentId || null,
        p_channel_id: filters?.channelId && filters.channelId !== 'no_channel' ? filters.channelId : null,
        p_origin: filters?.origin && filters.origin !== 'all' ? filters.origin : null,
        p_date_filter: filters?.dateFilter || null,
        p_status_filter: filters?.statusFilter || 'active',
      });
      
      if (error) throw error;
      
      const result = data as any;
      
      // Calculate pending count separately with same filters
      let pendingCount = 0;
      let pendingQuery = supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'pending'])
        .is('assigned_to', null)
        .not('department_id', 'is', null);
      
      // Apply same filters to pending
      if (filters?.departmentId) {
        pendingQuery = pendingQuery.eq('department_id', filters.departmentId);
      }
      if (filters?.channelId && filters.channelId !== 'no_channel') {
        pendingQuery = pendingQuery.eq('channel_id', filters.channelId);
      } else if (filters?.channelId === 'no_channel') {
        pendingQuery = pendingQuery.is('channel_id', null);
      }
      if (filters?.origin === 'meta_ads') {
        pendingQuery = pendingQuery.eq('referral_source', 'meta_ads');
      } else if (filters?.origin === 'organic') {
        pendingQuery = pendingQuery.or('referral_source.is.null,referral_source.neq.meta_ads');
      }
      
      if (isAdminOrSupervisor) {
        const { count } = await pendingQuery;
        pendingCount = count || 0;
      } else if (userDepartmentIds.length > 0) {
        const { count } = await pendingQuery.in('department_id', userDepartmentIds);
        pendingCount = count || 0;
      }
      
      return {
        all: result?.total || 0,
        mine: result?.mine || 0,
        unassigned: result?.unassigned || 0,
        unread: result?.unread || 0,
        pending: pendingCount,
      };
    },
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para buscar contagens por canal - OTIMIZADO com filtros
 */
export function useChannelCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['channel-counts', filters],
    queryFn: async (): Promise<ChannelCounts> => {
      const timezone = await getTimezone();
      
      const { data, error } = await (supabase.rpc as any)('get_channel_counts', {
        p_department_id: filters?.departmentId || null,
        p_agent_id: filters?.agentId || null,
        p_origin: filters?.origin && filters.origin !== 'all' ? filters.origin : null,
        p_date_filter: filters?.dateFilter || null,
        p_timezone: timezone,
      });
      
      if (error) throw error;
      return (data as ChannelCounts) || {};
    },
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para buscar contagens por data - OTIMIZADO com filtros
 */
export function useDateFilterCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['date-filter-counts', filters],
    queryFn: async (): Promise<DateFilterCounts> => {
      const timezone = await getTimezone();
      
      const { data, error } = await (supabase.rpc as any)('get_date_filter_counts', {
        p_timezone: timezone,
        p_department_id: filters?.departmentId || null,
        p_agent_id: filters?.agentId || null,
        p_channel_id: filters?.channelId && filters.channelId !== 'no_channel' ? filters.channelId : null,
        p_origin: filters?.origin && filters.origin !== 'all' ? filters.origin : null,
        p_status_filter: filters?.statusFilter || 'active',
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
    },
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para buscar contagens por departamento - OTIMIZADO com filtros
 */
export function useDepartmentCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['department-counts', filters],
    queryFn: async (): Promise<DepartmentCounts> => {
      const timezone = await getTimezone();
      
      const { data, error } = await (supabase.rpc as any)('get_department_counts', {
        p_agent_id: filters?.agentId || null,
        p_channel_id: filters?.channelId && filters.channelId !== 'no_channel' ? filters.channelId : null,
        p_origin: filters?.origin && filters.origin !== 'all' ? filters.origin : null,
        p_date_filter: filters?.dateFilter || null,
        p_timezone: timezone,
      });
      
      if (error) throw error;
      return (data as DepartmentCounts) || {};
    },
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para buscar contagens por origem - OTIMIZADO com filtros
 */
export function useOriginCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['origin-counts', filters],
    queryFn: async (): Promise<OriginCounts> => {
      const timezone = await getTimezone();
      
      const { data, error } = await (supabase.rpc as any)('get_origin_counts', {
        p_department_id: filters?.departmentId || null,
        p_agent_id: filters?.agentId || null,
        p_channel_id: filters?.channelId && filters.channelId !== 'no_channel' ? filters.channelId : null,
        p_date_filter: filters?.dateFilter || null,
        p_timezone: timezone,
      });
      
      if (error) throw error;
      const result = data as any;
      return { 
        meta_ads: result?.meta_ads || 0, 
        organic: result?.organic || 0 
      };
    },
    staleTime: 30000,
    refetchInterval: 60000,
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
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para buscar contagens por agente - OTIMIZADO com filtros
 */
export function useAgentCounts(filters?: CountFilters) {
  return useQuery({
    queryKey: ['agent-counts', filters],
    queryFn: async (): Promise<Record<string, number>> => {
      const timezone = await getTimezone();
      
      const { data, error } = await (supabase.rpc as any)('get_agent_counts', {
        p_department_id: filters?.departmentId || null,
        p_channel_id: filters?.channelId && filters.channelId !== 'no_channel' ? filters.channelId : null,
        p_origin: filters?.origin && filters.origin !== 'all' ? filters.origin : null,
        p_date_filter: filters?.dateFilter || null,
        p_timezone: timezone,
      });
      
      if (error) throw error;
      return (data as Record<string, number>) || {};
    },
    staleTime: 30000,
    refetchInterval: 60000,
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
    staleTime: 30000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });
}
