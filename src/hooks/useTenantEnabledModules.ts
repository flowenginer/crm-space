import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';

export function useTenantEnabledModules() {
  const queryClient = useQueryClient();
  const { tenantId } = useUserStore();

  // Função para refetch manual
  const refetchModules = useCallback(() => {
    if (tenantId) {
      console.log('[useTenantEnabledModules] Manual refetch triggered for tenant:', tenantId);
      queryClient.invalidateQueries({ queryKey: ['tenant-enabled-modules', tenantId] });
    }
  }, [queryClient, tenantId]);

  // Realtime listener para invalidar cache quando módulos mudam para ESTE tenant
  useEffect(() => {
    if (!tenantId) return;

    const channel = supabase
      .channel(`tenant-modules-realtime-${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenant_modules',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          console.log('[useTenantEnabledModules] Realtime update detected for tenant:', tenantId, payload);
          queryClient.invalidateQueries({ queryKey: ['tenant-enabled-modules', tenantId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, tenantId]);

  // Refetch quando a aba volta ao foco (fallback se realtime falhar)
  useEffect(() => {
    if (!tenantId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[useTenantEnabledModules] Tab became visible, refetching modules');
        refetchModules();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tenantId, refetchModules]);

  const query = useQuery({
    queryKey: ['tenant-enabled-modules', tenantId],
    queryFn: async () => {
      console.log('[useTenantEnabledModules] Fetching modules for tenant:', tenantId);
      
      const { data, error } = await supabase.rpc('get_current_tenant_modules');
      
      if (error) {
        console.error('[useTenantEnabledModules] Error fetching modules:', error);
        throw error;
      }
      
      // Retorna um Set para buscas O(1)
      const modules = new Set((data || []).map((row: { module_key: string }) => row.module_key));
      console.log('[useTenantEnabledModules] Enabled modules for tenant', tenantId, ':', Array.from(modules));
      return modules;
    },
    enabled: !!tenantId, // Só executa quando tenantId está disponível
    staleTime: 30 * 1000,           // 30 segundos
    gcTime: 5 * 60 * 1000,          // 5 minutos
    refetchOnWindowFocus: true,
    refetchInterval: 60 * 1000,     // Fallback: refetch a cada 60 segundos
    refetchIntervalInBackground: false, // Não fazer polling em background
  });

  return {
    ...query,
    refetchModules, // Expor função de refetch manual
  };
}
