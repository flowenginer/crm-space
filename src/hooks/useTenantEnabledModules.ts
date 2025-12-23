import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useTenantEnabledModules() {
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
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000,   // 10 minutos
    refetchOnWindowFocus: false,
  });
}
