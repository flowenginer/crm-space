import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ConversationCounts {
  all: number;
  mine: number;
  unassigned: number;
  unread: number;
}

interface ChannelCounts {
  [channelId: string]: number;
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
    staleTime: 30000, // 30 seconds cache
    refetchInterval: 60000, // Refetch every minute
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
    staleTime: 30000,
    refetchInterval: 60000,
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
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
