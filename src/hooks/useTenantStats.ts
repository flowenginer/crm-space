import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';

interface TenantStats {
  usersCount: number;
  contactsCount: number;
  conversationsCount: number;
}

/**
 * Hook para buscar estatísticas do tenant atual
 */
export function useTenantStats() {
  const { tenantId } = useUserStore();

  return useQuery({
    queryKey: ['tenant-stats', tenantId],
    queryFn: async (): Promise<TenantStats> => {
      if (!tenantId) {
        return { usersCount: 0, contactsCount: 0, conversationsCount: 0 };
      }

      // Buscar contagem de usuários
      const { count: usersCount, error: usersError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (usersError) {
        console.error('Error fetching users count:', usersError);
      }

      // Buscar contagem de contatos
      const { count: contactsCount, error: contactsError } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (contactsError) {
        console.error('Error fetching contacts count:', contactsError);
      }

      // Buscar contagem de conversas
      const { count: conversationsCount, error: conversationsError } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);

      if (conversationsError) {
        console.error('Error fetching conversations count:', conversationsError);
      }

      return {
        usersCount: usersCount || 0,
        contactsCount: contactsCount || 0,
        conversationsCount: conversationsCount || 0,
      };
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
