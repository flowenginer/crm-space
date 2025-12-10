import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useConversionStatusIds } from './useCompanySettings';

const CACHE_TIME = 5 * 60 * 1000; // 5 minutes
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

/**
 * Hook otimizado para cachear conversion status names
 * Evita queries repetidas para buscar nomes de status de conversão
 */
export function useConversionStatusNames() {
  const { conversionStatusIds } = useConversionStatusIds();

  return useQuery({
    queryKey: ['conversion_status_names', conversionStatusIds],
    queryFn: async (): Promise<string[]> => {
      if (!conversionStatusIds || conversionStatusIds.length === 0) {
        return [];
      }

      // First try to use the RPC if available
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_conversion_status_names');
      
      if (!rpcError && rpcData) {
        return rpcData as string[];
      }

      // Fallback to direct query
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('name')
        .in('id', conversionStatusIds);

      if (error) {
        console.error('Error fetching conversion status names:', error);
        return [];
      }

      return data?.map(s => s.name) || [];
    },
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
    enabled: conversionStatusIds.length > 0,
  });
}
