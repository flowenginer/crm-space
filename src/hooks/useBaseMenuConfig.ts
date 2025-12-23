import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MenuItem } from './useMenuConfig';

// Hook para buscar menu do tenant BASE (para super admin)
// Usado no TenantModulesTree para exibir todos os módulos possíveis
export function useBaseMenuItems() {
  return useQuery({
    queryKey: ['base-menu-items'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_base_menu_items');
      
      if (error) {
        console.error('[useBaseMenuItems] Error:', error);
        throw error;
      }
      
      return (data || []) as MenuItem[];
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
  });
}

// Hook para menu base hierárquico
export function useBaseMenuHierarchy() {
  const { data: items, ...rest } = useBaseMenuItems();
  
  const hierarchy = items ? buildMenuHierarchy(items) : [];
  
  return { data: hierarchy, items, ...rest };
}

// Função para construir hierarquia
function buildMenuHierarchy(items: MenuItem[]): MenuItem[] {
  const itemMap = new Map<string, MenuItem>();
  const roots: MenuItem[] = [];

  items.forEach(item => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  items.forEach(item => {
    const menuItem = itemMap.get(item.id)!;
    if (item.parent_id) {
      const parent = itemMap.get(item.parent_id);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(menuItem);
      }
    } else {
      roots.push(menuItem);
    }
  });

  const sortChildrenRecursive = (item: MenuItem) => {
    if (item.children && item.children.length > 0) {
      item.children.sort((a, b) => a.position - b.position);
      item.children.forEach(sortChildrenRecursive);
    }
  };

  roots.forEach(sortChildrenRecursive);
  return roots.sort((a, b) => a.position - b.position);
}

// Hook para sincronizar menu do tenant base para um tenant alvo
export function useSyncTenantMenu() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (targetTenantId: string) => {
      const { data, error } = await supabase.rpc('sync_menu_items_to_tenant', {
        p_target_tenant_id: targetTenantId,
      });
      
      if (error) throw error;
      return data as { items_copied: number; items_skipped: number; total_in_target: number }[];
    },
    onSuccess: (data) => {
      const result = data?.[0];
      if (result) {
        toast.success(
          `Menu sincronizado: ${result.items_copied} itens copiados, ${result.items_skipped} já existiam. Total: ${result.total_in_target}`
        );
      }
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao sincronizar menu: ' + error.message);
    },
  });
}
