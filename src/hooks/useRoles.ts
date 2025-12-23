import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';

export interface RoleDefinition {
  id: string;
  role_key: string;
  role_name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  permissions: Record<string, Record<string, boolean>> | null;
  is_system: boolean | null;
  order_position: number | null;
  created_at: string | null;
  tenant_id?: string;
  user_count?: number;
}

export interface PermissionDefinition {
  id: string;
  category: string;
  permission_key: string;
  permission_name: string;
  description: string | null;
}

export function useRoles() {
  const { data: tenantId } = useCurrentTenantId();
  
  return useQuery({
    queryKey: ['role_definitions', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      // Buscar roles APENAS do tenant atual
      const { data: roles, error } = await supabase
        .from('role_definitions')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('order_position', { ascending: true });

      if (error) throw error;

      // Get user count per role - APENAS do tenant atual
      const { data: profiles } = await supabase
        .from('profiles')
        .select('role')
        .eq('tenant_id', tenantId);

      const roleCounts: Record<string, number> = {};
      profiles?.forEach(p => {
        if (p.role) {
          roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
        }
      });

      return (roles as RoleDefinition[]).map(role => ({
        ...role,
        user_count: roleCounts[role.role_key] || 0
      }));
    },
    enabled: !!tenantId,
  });
}

export function usePermissionDefinitions() {
  return useQuery({
    queryKey: ['permission_definitions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permission_definitions')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      return data as PermissionDefinition[];
    },
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();
  
  return useMutation({
    mutationFn: async (role: Omit<RoleDefinition, 'id' | 'created_at' | 'user_count' | 'tenant_id'>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');
      
      const { data, error } = await supabase
        .from('role_definitions')
        .insert({ ...role, tenant_id: tenantId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role_definitions'] });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, role_key, ...updates }: Partial<RoleDefinition> & { id: string; role_key?: string }) => {
      const { data, error } = await supabase
        .from('role_definitions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, role_key };
    },
    onSuccess: (result) => {
      // Invalidate ALL permission-related caches aggressively
      queryClient.invalidateQueries({ queryKey: ['role_definitions'] });
      queryClient.invalidateQueries({ queryKey: ['roleDefinition'] });
      queryClient.invalidateQueries({ queryKey: ['profile-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      
      // Force refetch for immediate effect
      queryClient.refetchQueries({ queryKey: ['role_definitions'] });
      queryClient.refetchQueries({ queryKey: ['roleDefinition'] });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('role_definitions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role_definitions'] });
    },
  });
}
