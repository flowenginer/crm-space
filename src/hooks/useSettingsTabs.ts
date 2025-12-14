import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MenuTabItem {
  id: string;
  title: string;
  href: string | null;
  parent_id: string | null;
  is_active: boolean;
  position: number;
}

// Get all menu items with /settings?tab= href, regardless of parent hierarchy
export const useSettingsTabs = () => {
  return useQuery({
    queryKey: ['settings-tabs'],
    queryFn: async () => {
      // Fetch ALL menu items with href starting with /settings?tab=
      const { data: allSettingsTabs, error } = await supabase
        .from('menu_items')
        .select('id, title, href, parent_id, is_active, position')
        .like('href', '/settings?tab=%')
        .eq('is_active', true)
        .order('position');

      if (error) {
        console.error('Error fetching settings tabs:', error);
        return [];
      }

      return (allSettingsTabs || []) as MenuTabItem[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
