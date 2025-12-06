import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, startOfWeek, startOfMonth, subDays, subWeeks, subMonths, endOfDay, endOfWeek, endOfMonth, format } from 'date-fns';

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

/**
 * Hook para buscar contagens REAIS de conversas do banco de dados
 * Usa queries COUNT(*) otimizadas - não carrega todas as conversas
 */
export function useConversationTotalCounts() {
  return useQuery({
    queryKey: ['conversation-total-counts'],
    queryFn: async (): Promise<ConversationCounts> => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch all counts in parallel for efficiency
      const [allResult, mineResult, unassignedResult, unreadResult] = await Promise.all([
        // Total open conversations
        supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open'),
        
        // My conversations
        user ? supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open')
          .eq('assigned_to', user.id) : Promise.resolve({ count: 0 }),
        
        // Unassigned conversations
        supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open')
          .is('assigned_to', null),
        
        // Unread conversations
        supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open')
          .eq('is_unread', true),
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
 * Hook para buscar contagens por canal
 */
export function useChannelCounts() {
  return useQuery({
    queryKey: ['channel-counts'],
    queryFn: async (): Promise<ChannelCounts> => {
      // Get counts grouped by channel
      const { data, error } = await supabase
        .from('conversations')
        .select('channel_id')
        .eq('status', 'open');
      
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
 * Hook para buscar contagens por data do primeiro contato
 * Usa queries COUNT(*) diretas no banco para valores reais
 */
export function useDateFilterCounts() {
  return useQuery({
    queryKey: ['date-filter-counts'],
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
      
      // Execute all count queries in parallel
      const [todayResult, yesterdayResult, thisWeekResult, lastWeekResult, thisMonthResult, lastMonthResult] = await Promise.all([
        // Today - based on contact's first_contact_at
        supabase
          .from('conversations')
          .select('id, contact:contacts!inner(first_contact_at)', { count: 'exact', head: true })
          .eq('status', 'open')
          .gte('contact.first_contact_at', todayStart)
          .lte('contact.first_contact_at', todayEnd),
        
        // Yesterday
        supabase
          .from('conversations')
          .select('id, contact:contacts!inner(first_contact_at)', { count: 'exact', head: true })
          .eq('status', 'open')
          .gte('contact.first_contact_at', yesterdayStart)
          .lte('contact.first_contact_at', yesterdayEnd),
        
        // This week
        supabase
          .from('conversations')
          .select('id, contact:contacts!inner(first_contact_at)', { count: 'exact', head: true })
          .eq('status', 'open')
          .gte('contact.first_contact_at', thisWeekStart)
          .lte('contact.first_contact_at', todayEnd),
        
        // Last week
        supabase
          .from('conversations')
          .select('id, contact:contacts!inner(first_contact_at)', { count: 'exact', head: true })
          .eq('status', 'open')
          .gte('contact.first_contact_at', lastWeekStart)
          .lte('contact.first_contact_at', lastWeekEnd),
        
        // This month
        supabase
          .from('conversations')
          .select('id, contact:contacts!inner(first_contact_at)', { count: 'exact', head: true })
          .eq('status', 'open')
          .gte('contact.first_contact_at', thisMonthStart)
          .lte('contact.first_contact_at', todayEnd),
        
        // Last month
        supabase
          .from('conversations')
          .select('id, contact:contacts!inner(first_contact_at)', { count: 'exact', head: true })
          .eq('status', 'open')
          .gte('contact.first_contact_at', lastMonthStart)
          .lte('contact.first_contact_at', lastMonthEnd),
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
 * Hook para buscar contagens por departamento
 */
export function useDepartmentCounts() {
  return useQuery({
    queryKey: ['department-counts'],
    queryFn: async (): Promise<DepartmentCounts> => {
      // Get all open conversations with department_id
      const { data, error } = await supabase
        .from('conversations')
        .select('department_id')
        .eq('status', 'open')
        .not('department_id', 'is', null);
      
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
 * Hook para buscar contagens por origem do lead (Meta Ads / Orgânico)
 */
export function useOriginCounts() {
  return useQuery({
    queryKey: ['origin-counts'],
    queryFn: async (): Promise<OriginCounts> => {
      // Count Meta Ads - check both conversation referral_source and contact origin
      const { data: allConversations, error } = await supabase
        .from('conversations')
        .select('id, referral_source, contact:contacts(origin)')
        .eq('status', 'open');
      
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
 * Hook para buscar contagens de etiquetas em conversas
 */
export function useTagCounts() {
  return useQuery({
    queryKey: ['tag-counts'],
    queryFn: async (): Promise<Record<string, number>> => {
      // Get tag counts from contact_tags joined with conversations
      const { data, error } = await supabase
        .from('conversations')
        .select('contact:contacts(id)')
        .eq('status', 'open');
      
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
 * Hook para buscar contagens de filtros de ordenação (não lidas, não respondidas, etc)
 */
export function useSortFilterCounts() {
  return useQuery({
    queryKey: ['sort-filter-counts'],
    queryFn: async () => {
      // Fetch unread count
      const { count: unreadCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open')
        .eq('is_unread', true);

      // For not_replied and client_not_replied, we need to check last messages
      // This is more complex and would require a join or subquery
      // For now, we'll return approximate counts based on available data
      
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
