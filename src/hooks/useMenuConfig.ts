import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrentTenantId } from '@/hooks/useTenant';

export interface MenuItem {
  id: string;
  title: string;
  href: string | null;
  icon: string;
  parent_id: string | null;
  position: number;
  permission: string | null;
  roles: string[] | null;
  is_active: boolean;
  show_badge: string | null;
  created_at: string;
  updated_at: string;
  tenant_id?: string;
  module_key?: string | null;  // Nova coluna para identificação única do módulo
  children?: MenuItem[];
}

export interface MenuItemInput {
  title: string;
  href?: string | null;
  icon: string;
  parent_id?: string | null;
  position?: number;
  permission?: string | null;
  roles?: string[] | null;
  is_active?: boolean;
  show_badge?: string | null;
}

// Hook para buscar todos os itens de menu - FILTRADO POR TENANT
export function useMenuItems() {
  const { data: tenantId, isLoading: tenantLoading } = useCurrentTenantId();
  
  return useQuery({
    queryKey: ['menu-items', tenantId],
    queryFn: async () => {
      let tid = tenantId;
      
      // Fallback: get tenantId directly if not available
      if (!tid) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('tenant_id')
            .eq('id', user.id)
            .single();
          tid = profile?.tenant_id;
        }
      }
      
      if (!tid) return [];
      
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('tenant_id', tid)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as MenuItem[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    enabled: !tenantLoading,
  });
}

// Hook para buscar menu hierárquico (com children)
export function useMenuHierarchy() {
  const { data: items, ...rest } = useMenuItems();

  const hierarchy = items ? buildMenuHierarchy(items) : [];

  return { data: hierarchy, items, ...rest };
}

// Função para construir hierarquia de menu
function buildMenuHierarchy(items: MenuItem[]): MenuItem[] {
  const itemMap = new Map<string, MenuItem>();
  const roots: MenuItem[] = [];

  // Primeiro, criar map de todos os itens
  items.forEach(item => {
    itemMap.set(item.id, { ...item, children: [] });
  });

  // Depois, construir hierarquia
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

  // Função recursiva para ordenar todos os níveis de children
  const sortChildrenRecursive = (item: MenuItem) => {
    if (item.children && item.children.length > 0) {
      item.children.sort((a, b) => a.position - b.position);
      item.children.forEach(sortChildrenRecursive);
    }
  };

  roots.forEach(sortChildrenRecursive);
  return roots.sort((a, b) => a.position - b.position);
}

// Hook para criar item de menu
export function useCreateMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MenuItemInput) => {
      // Buscar próxima posição se não fornecida
      if (input.position === undefined) {
        let query = supabase
          .from('menu_items')
          .select('position')
          .order('position', { ascending: false })
          .limit(1);

        if (input.parent_id) {
          query = query.eq('parent_id', input.parent_id);
        } else {
          query = query.is('parent_id', null);
        }

        const { data: existing } = await query;
        input.position = (existing?.[0]?.position || 0) + 1;
      }

      const { data, error } = await supabase
        .from('menu_items')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      toast.success('Item de menu criado');
    },
    onError: (error: any) => {
      toast.error('Erro ao criar item: ' + error.message);
    },
  });
}

// Hook para atualizar item de menu
export function useUpdateMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MenuItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('menu_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      toast.success('Item de menu atualizado');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar item: ' + error.message);
    },
  });
}

// Hook para deletar item de menu
export function useDeleteMenuItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('menu_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
      toast.success('Item de menu removido');
    },
    onError: (error: any) => {
      toast.error('Erro ao remover item: ' + error.message);
    },
  });
}

// Hook para reordenar itens
export function useReorderMenuItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { id: string; position: number; parent_id?: string | null }[]) => {
      // Atualizar posições em batch
      const updates = items.map(item => 
        supabase
          .from('menu_items')
          .update({ position: item.position, parent_id: item.parent_id ?? null })
          .eq('id', item.id)
      );

      const results = await Promise.all(updates);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu-items'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao reordenar: ' + error.message);
    },
  });
}
