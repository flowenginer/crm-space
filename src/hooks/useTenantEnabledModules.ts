import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';

export function useTenantEnabledModules() {
  const queryClient = useQueryClient();
  const { tenantId } = useUserStore();

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

  return useQuery({
    queryKey: ['tenant-enabled-modules', tenantId],
    queryFn: async () => {
      console.log('[useTenantEnabledModules] Fetching modules for tenant:', tenantId);
      
      const { data, error } = await supabase.rpc('get_current_tenant_modules');
      
      if (error) {
        console.error('[useTenantEnabledModules] Error:', error);
        throw error;
      }
      
      // Retorna um Set para buscas O(1)
      const modules = new Set((data || []).map((row: { module_key: string }) => row.module_key));
      console.log('[useTenantEnabledModules] Enabled modules for tenant', tenantId, ':', Array.from(modules));
      return modules;
    },
    enabled: !!tenantId, // Só executa quando tenantId está disponível
    staleTime: 30 * 1000,      // 30 segundos
    gcTime: 5 * 60 * 1000,     // 5 minutos
    refetchOnWindowFocus: true,
  });
}
