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

// Get all menu items that are children of "Relatórios" menu with /reports?tab= href
export const useReportsTabs = () => {
  return useQuery({
    queryKey: ['reports-tabs'],
    queryFn: async () => {
      // First, find the "Relatórios" root menu
      const { data: reportsMenu, error: reportsError } = await supabase
        .from('menu_items')
        .select('id')
        .eq('title', 'Relatórios')
        .is('parent_id', null)
        .single();

      if (reportsError || !reportsMenu) {
        console.error('Could not find Relatórios menu:', reportsError);
        return [];
      }

      // Get all menu items with /reports?tab= href that are direct children of Relatórios
      const { data: submenus, error: submenusError } = await supabase
        .from('menu_items')
        .select('id, title, href, parent_id, is_active, position')
        .eq('parent_id', reportsMenu.id)
        .eq('is_active', true)
        .order('position');

      if (submenusError) {
        console.error('Error fetching reports submenus:', submenusError);
        return [];
      }

      // Filter only items that have /reports?tab= in their href
      return (submenus || []).filter(
        (item): item is MenuTabItem => 
          item.href?.startsWith('/reports?tab=') === true
      );
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
