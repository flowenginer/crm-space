import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser, useCurrentUserProfile, useCurrentUserDepartments, useIsAdminOrSupervisor } from './useCurrentUser';

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

// OTIMIZAÇÃO: Cache de timezone em sessionStorage
const TIMEZONE_CACHE_KEY = 'app_timezone';
const TIMEZONE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

interface TimezoneCache {
  value: string;
  timestamp: number;
}

async function getTimezone(): Promise<string> {
  // Tentar obter do cache primeiro
  try {
    const cached = sessionStorage.getItem(TIMEZONE_CACHE_KEY);
    if (cached) {
      const { value, timestamp }: TimezoneCache = JSON.parse(cached);
      if (Date.now() - timestamp < TIMEZONE_CACHE_DURATION) {
        return value;
      }
    }
  } catch {
    // Ignore cache errors
  }
  
  const { data: settings } = await supabase
    .from('company_settings')
    .select('timezone')
    .limit(1)
    .maybeSingle();
  
  const timezone = settings?.timezone || 'America/Sao_Paulo';
  
  // Salvar no cache
  try {
    const cache: TimezoneCache = { value: timezone, timestamp: Date.now() };
    sessionStorage.setItem(TIMEZONE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage errors
  }
  
  return timezone;
}

// OTIMIZAÇÃO: staleTime e refetchInterval aumentados para 5 minutos
// Contagens de filtros não precisam de atualização em tempo real
const FILTER_COUNTS_STALE_TIME = 5 * 60 * 1000; // 5 minutos
const FILTER_COUNTS_REFETCH_INTERVAL = 5 * 60 * 1000; // 5 minutos

/**
 * Hook OTIMIZADO que busca todas as contagens em UMA única chamada RPC
 * Agora suporta todos os filtros!
 */
export function useAllConversationCounts(filters?: CountFilters) {
  const { data: user } = useCurrentUser();
  
  return useQuery({
    queryKey: ['all-conversation-counts', filters, user?.id],
    queryFn: async (): Promise<AllConversationCounts> => {
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
      
      // Mapeamento correto: banco retorna { totals: {...}, channels: {...}, dates: {...}, ... }
      return {
        total: result?.totals?.all || 0,
        mine: result?.totals?.mine || 0,
        unassigned: result?.totals?.unassigned || 0,
        unread: result?.totals?.unread || 0,
        byChannel: result?.channels || {},
        byDepartment: result?.departments || {},
        byAgent: result?.byAgent || {},
        byOrigin: result?.origins || { meta_ads: 0, organic: 0 },
        byDate: {
          today: result?.dates?.today || 0,
          yesterday: result?.dates?.yesterday || 0,
          thisWeek: result?.dates?.this_week || 0,
          lastWeek: result?.dates?.last_week || 0,
          thisMonth: result?.dates?.this_month || 0,
          lastMonth: result?.dates?.last_month || 0,
        },
      };
    },
    enabled: !!user?.id,
    staleTime: FILTER_COUNTS_STALE_TIME,
    refetchInterval: FILTER_COUNTS_REFETCH_INTERVAL,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para buscar contagens REAIS de conversas - OTIMIZADO
 * Usa a função RPC com todos os filtros
 */
/**
 * Hook para buscar contagens REAIS de conversas - OTIMIZADO
 * MELHORIA: Usa hooks centralizados para user/profile/departments
 * Evita chamadas duplicadas ao auth.getUser() e queries de profile
 */
export function useConversationTotalCounts(filters?: CountFilters) {
  const { data: user } = useCurrentUser();
  const { data: profile } = useCurrentUserProfile();
  const { data: userDepartments } = useCurrentUserDepartments();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'supervisor';
  
  return useQuery({
    queryKey: ['conversation-total-counts', filters, user?.id, isAdmin, userDepartments],
    queryFn: async (): Promise<ConversationCounts> => {
      const timezone = await getTimezone();
      
      // Usar a função RPC com todos os filtros - inclui pending count
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
      
      // OTIMIZAÇÃO: Usar pending do RPC se disponível, senão calcular
      // A função get_all_conversation_counts já retorna pending baseado no usuário
      let pendingCount = result?.totals?.pending || 0;
      
      // Se não vier do RPC, calcular (fallback para RPCs antigos)
      if (pendingCount === 0 && (isAdmin || (userDepartments && userDepartments.length > 0))) {
        let pendingQuery = supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .in('status', ['open', 'pending'])
          .is('assigned_to', null)
          .not('department_id', 'is', null);
        
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
        
        if (isAdmin) {
          const { count } = await pendingQuery;
          pendingCount = count || 0;
        } else if (userDepartments && userDepartments.length > 0) {
          const { count } = await pendingQuery.in('department_id', userDepartments);
          pendingCount = count || 0;
        }
      }
      
      return {
        all: result?.totals?.all || 0,
        mine: result?.totals?.mine || 0,
        unassigned: result?.totals?.unassigned || 0,
        unread: result?.totals?.unread || 0,
        pending: pendingCount,
      };
    },
    enabled: !!user?.id,
    staleTime: 120000, // 2 min
    refetchInterval: 180000, // 3 min
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
    staleTime: FILTER_COUNTS_STALE_TIME,
    refetchInterval: FILTER_COUNTS_REFETCH_INTERVAL,
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
      });
      
      if (error) throw error;
      
      const result = data as any;
      return {
        today: result?.today || 0,
        yesterday: result?.yesterday || 0,
        this_week: result?.this_week || 0,
        last_week: result?.last_week || 0,
        this_month: result?.this_month || 0,
        last_month: result?.last_month || 0,
      };
    },
    staleTime: FILTER_COUNTS_STALE_TIME,
    refetchInterval: FILTER_COUNTS_REFETCH_INTERVAL,
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
    staleTime: FILTER_COUNTS_STALE_TIME,
    refetchInterval: FILTER_COUNTS_REFETCH_INTERVAL,
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
    staleTime: FILTER_COUNTS_STALE_TIME,
    refetchInterval: FILTER_COUNTS_REFETCH_INTERVAL,
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
    staleTime: FILTER_COUNTS_STALE_TIME,
    refetchInterval: FILTER_COUNTS_REFETCH_INTERVAL,
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
    staleTime: FILTER_COUNTS_STALE_TIME,
    refetchInterval: FILTER_COUNTS_REFETCH_INTERVAL,
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
    staleTime: FILTER_COUNTS_STALE_TIME,
    refetchInterval: FILTER_COUNTS_REFETCH_INTERVAL,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para buscar contagem de conversas sem etiqueta
 */
export function useNoTagCount(filters?: CountFilters) {
  return useQuery({
    queryKey: ['no-tag-count', filters],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('get_no_tag_conversation_count', {
        p_department_id: filters?.departmentId || null,
        p_agent_id: filters?.agentId || null,
        p_channel_id: filters?.channelId && filters.channelId !== 'no_channel' ? filters.channelId : null,
        p_origin: filters?.origin && filters.origin !== 'all' ? filters.origin : null,
      });

      if (error) {
        console.error('Error fetching no tag count:', error);
        throw error;
      }
      return (data as number) || 0;
    },
    staleTime: FILTER_COUNTS_STALE_TIME,
    refetchInterval: FILTER_COUNTS_REFETCH_INTERVAL,
    refetchOnWindowFocus: false,
  });
}
