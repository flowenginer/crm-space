import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from './useTenant';

interface MenuTabItem {
  id: string;
  title: string;
  href: string | null;
  parent_id: string | null;
  is_active: boolean;
  position: number;
}

// Get all menu items with /settings?tab= href, filtered by current tenant
export const useSettingsTabs = () => {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['settings-tabs', tenantId],
    queryFn: async () => {
      if (!tenantId) {
        console.warn('[useSettingsTabs] No tenant ID available');
        return [];
      }

      // Fetch menu items for current tenant with href starting with /settings?tab=
      const { data: allSettingsTabs, error } = await supabase
        .from('menu_items')
        .select('id, title, href, parent_id, is_active, position')
        .eq('tenant_id', tenantId)
        .like('href', '/settings?tab=%')
        .eq('is_active', true)
        .order('position');

      if (error) {
        console.error('Error fetching settings tabs:', error);
        return [];
      }

      return (allSettingsTabs || []) as MenuTabItem[];
    },
    enabled: !!tenantId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
