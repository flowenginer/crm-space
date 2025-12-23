import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useTenantEnabledModules() {
  const queryClient = useQueryClient();

  // Realtime listener para invalidar cache quando módulos mudam
  useEffect(() => {
    const channel = supabase
      .channel('tenant-modules-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenant_modules',
        },
        (payload) => {
          console.log('[useTenantEnabledModules] Realtime update detected:', payload);
          queryClient.invalidateQueries({ queryKey: ['tenant-enabled-modules'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['tenant-enabled-modules'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_current_tenant_modules');
      
      if (error) {
        console.error('[useTenantEnabledModules] Error:', error);
        throw error;
      }
      
      // Retorna um Set para buscas O(1)
      const modules = new Set((data || []).map((row: { module_key: string }) => row.module_key));
      console.log('[useTenantEnabledModules] Enabled modules:', Array.from(modules));
      return modules;
    },
    staleTime: 30 * 1000,      // 30 segundos (reduzido)
    gcTime: 5 * 60 * 1000,     // 5 minutos
    refetchOnWindowFocus: true, // Revalidar ao voltar para aba
  });
}
