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

export function useSuperAdminTenants() {
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
      const { data, error } = await supabase.rpc('current_user_is_super_admin');
      
      if (error) {
        console.error('Error checking super admin status:', error);
        return false;
      }
      
      return data === true;
    },
    staleTime: 5 * 60 * 1000,
  });
}
