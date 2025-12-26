import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TenantWithStats {
  id: string;
  name: string;
  slug: string;
  plan_type: string;
  max_users: number;
  max_contacts: number;
  is_active: boolean;
  trial_ends_at: string | null;
  created_at: string;
  user_count: number;
  contact_count: number;
}

export interface TenantModule {
  module_key: string;
  is_enabled: boolean;
}

export interface TenantAdmin {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

export function useSuperAdminTenants() {
  const { data: isSuperAdmin } = useCurrentUserIsSuperAdmin();
  
  return useQuery({
    queryKey: ['super_admin_tenants'],
    queryFn: async (): Promise<TenantWithStats[]> => {
      const { data, error } = await supabase.rpc('get_all_tenants_with_stats');
      
      if (error) {
        console.error('Error fetching tenants:', error);
        throw error;
      }
      
      return (data || []) as TenantWithStats[];
    },
    enabled: isSuperAdmin === true,
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      tenantId,
      name,
      planType,
      maxUsers,
      maxContacts,
      isActive,
      trialEndsAt,
    }: {
      tenantId: string;
      name?: string;
      planType?: string;
      maxUsers?: number;
      maxContacts?: number;
      isActive?: boolean;
      trialEndsAt?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('update_tenant_by_super_admin', {
        p_tenant_id: tenantId,
        p_name: name || null,
        p_plan_type: planType || null,
        p_max_users: maxUsers ?? null,
        p_max_contacts: maxContacts ?? null,
        p_is_active: isActive ?? null,
        p_trial_ends_at: trialEndsAt ?? null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['super_admin_tenants'] });
      toast.success('Tenant atualizado com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error updating tenant:', error);
      toast.error('Erro ao atualizar tenant');
    },
  });
}

export function useCurrentUserIsSuperAdmin() {
  return useQuery({
    queryKey: ['current_user_is_super_admin'],
    queryFn: async (): Promise<boolean> => {
      // Get current user to include in cache key validation
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      
      const { data, error } = await supabase.rpc('current_user_is_super_admin');
      
      if (error) {
        console.error('Error checking super admin status:', error);
        return false;
      }
      
      return data === true;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useTenantModules(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['tenant_modules', tenantId],
    queryFn: async (): Promise<TenantModule[]> => {
      const { data, error } = await supabase.rpc('get_tenant_modules', {
        p_tenant_id: tenantId!
      });
      
      if (error) {
        console.error('Error fetching tenant modules:', error);
        throw error;
      }
      
      return (data || []) as TenantModule[];
    },
    enabled: !!tenantId,
  });
}

export function useUpdateTenantModules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tenantId, modules }: { tenantId: string; modules: string[] }) => {
      const { error } = await supabase.rpc('update_tenant_modules', {
        p_tenant_id: tenantId,
        p_modules: modules
      });
      
      if (error) throw error;
    },
    onSuccess: (_, { tenantId }) => {
      // Invalidar a query do painel super admin
      queryClient.invalidateQueries({ queryKey: ['tenant_modules', tenantId] });
      // Invalidar a query que a Sidebar do tenant usa para exibir os módulos
      queryClient.invalidateQueries({ queryKey: ['tenant-enabled-modules', tenantId] });
      toast.success('Módulos atualizados com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error updating tenant modules:', error);
      toast.error('Erro ao atualizar módulos');
    },
  });
}

export function useTenantAdmin(tenantId: string | undefined) {
  return useQuery({
    queryKey: ['tenant_admin', tenantId],
    queryFn: async (): Promise<TenantAdmin | null> => {
      const { data, error } = await supabase.rpc('get_tenant_admin', {
        p_tenant_id: tenantId!
      });
      
      if (error) {
        console.error('Error fetching tenant admin:', error);
        throw error;
      }
      
      return (data as TenantAdmin[])?.[0] || null;
    },
    enabled: !!tenantId,
  });
}

export function useDeleteTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      const { data, error } = await supabase.rpc('delete_tenant_by_super_admin', {
        p_tenant_id: tenantId
      });

      if (error) throw error;
      return data as { success: boolean; tenant_name: string; message: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['super_admin_tenants'] });
      toast.success(data?.message || 'Tenant deletado com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error deleting tenant:', error);
      toast.error(error.message || 'Erro ao deletar tenant');
    },
  });
}
