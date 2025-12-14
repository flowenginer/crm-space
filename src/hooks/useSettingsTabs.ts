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

// Get all menu items that are children of "Configurações" menu with /settings?tab= href
export const useSettingsTabs = () => {
  return useQuery({
    queryKey: ['settings-tabs'],
    queryFn: async () => {
      // First, find the "Configurações" root menu
      const { data: configMenu, error: configError } = await supabase
        .from('menu_items')
        .select('id')
        .eq('title', 'Configurações')
        .is('parent_id', null)
        .single();

      if (configError || !configMenu) {
        console.error('Could not find Configurações menu:', configError);
        return [];
      }

      // Get all menu items with /settings?tab= href that are direct children of Configurações
      const { data: submenus, error: submenusError } = await supabase
        .from('menu_items')
        .select('id, title, href, parent_id, is_active, position')
        .eq('parent_id', configMenu.id)
        .eq('is_active', true)
        .order('position');

      if (submenusError) {
        console.error('Error fetching settings submenus:', submenusError);
        return [];
      }

      // Filter only items that have /settings?tab= in their href
      return (submenus || []).filter(
        (item): item is MenuTabItem => 
          item.href?.startsWith('/settings?tab=') === true
      );
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};
