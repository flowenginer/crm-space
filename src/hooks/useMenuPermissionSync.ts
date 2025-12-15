/**
 * Hook para sincronizar permissões automaticamente quando menus são criados
 * 
 * Quando um novo menu é criado com rota, este hook pode criar automaticamente
 * a permissão correspondente no formato {route_key}.view
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Categoria padrão para permissões criadas a partir de menus
export const CUSTOM_MENU_CATEGORY = 'custom_menus';

/**
 * Extrai um slug a partir de uma rota
 * Ex: /my-reports → my_reports
 * Ex: /orders/settings → orders_settings
 */
export function routeToSlug(route: string): string {
  return route
    .replace(/^\//, '') // Remove barra inicial
    .replace(/\//g, '_') // Substitui barras por underscore
    .replace(/-/g, '_')  // Substitui hífens por underscore
    .toLowerCase();
}

/**
 * Gera uma permission_key a partir de uma rota
 * Ex: /my-reports → custom_menus.my_reports
 */
export function routeToPermissionKey(route: string): string {
  const slug = routeToSlug(route);
  return `${CUSTOM_MENU_CATEGORY}.${slug}`;
}

interface CreateMenuPermissionInput {
  menuTitle: string;
  route: string;
}

/**
 * Hook para criar permissão associada a um menu
 */
export function useCreateMenuPermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ menuTitle, route }: CreateMenuPermissionInput) => {
      const permissionKey = routeToPermissionKey(route);
      
      // Verificar se já existe
      const { data: existing } = await supabase
        .from('permission_definitions')
        .select('id')
        .eq('permission_key', permissionKey)
        .maybeSingle();

      if (existing) {
        console.log(`[MenuPermissionSync] Permission ${permissionKey} already exists`);
        return { created: false, permissionKey };
      }

      // Criar nova permissão
      const { error } = await supabase
        .from('permission_definitions')
        .insert({
          category: CUSTOM_MENU_CATEGORY,
          permission_key: permissionKey,
          permission_name: `Acessar ${menuTitle}`,
          description: `Permissão de acesso ao menu ${menuTitle}`,
        });

      if (error) throw error;
      
      console.log(`[MenuPermissionSync] ✅ Created permission: ${permissionKey}`);
      return { created: true, permissionKey };
    },
    onSuccess: (result) => {
      if (result.created) {
        queryClient.invalidateQueries({ queryKey: ['permission-definitions'] });
        queryClient.invalidateQueries({ queryKey: ['permission-definitions-sync'] });
      }
    },
    onError: (error: any) => {
      console.error('[MenuPermissionSync] Error creating permission:', error);
      toast.error('Erro ao criar permissão: ' + error.message);
    },
  });
}

/**
 * Hook para buscar todas as permissões (incluindo dinâmicas do banco)
 */
export function useDynamicPermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('permission_definitions')
        .select('permission_key, permission_name, category')
        .order('category', { ascending: true })
        .order('permission_name', { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}
