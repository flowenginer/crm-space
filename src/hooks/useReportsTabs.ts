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

// Get all menu items with /reports?tab= href, regardless of parent hierarchy
export const useReportsTabs = () => {
  return useQuery({
    queryKey: ['reports-tabs'],
    queryFn: async () => {
      // Fetch ALL menu items with href starting with /reports?tab=
      const { data: allReportsTabs, error } = await supabase
        .from('menu_items')
        .select('id, title, href, parent_id, is_active, position')
        .like('href', '/reports?tab=%')
        .eq('is_active', true)
        .order('position');

      if (error) {
        console.error('Error fetching reports tabs:', error);
        return [];
      }

      return (allReportsTabs || []) as MenuTabItem[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
