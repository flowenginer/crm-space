import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUserStore } from '@/store/userStore';
import type { Tenant } from '@/types';

/**
 * Hook para obter o tenant_id do usuário atual
 * Usa a função get_user_tenant_id() do banco
 */
export function useCurrentTenantId() {
  const { setTenantId } = useUserStore();
  
  return useQuery({
    queryKey: ['current-tenant-id'],
    queryFn: async () => {
      // First try to get from RPC
      const { data, error } = await supabase.rpc('get_user_tenant_id');
      if (!error && data) {
        setTenantId(data);
        return data as string;
      }
      
      console.error('Error fetching tenant id via RPC:', error);
      
      // Fallback: get directly from profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single();
        
        if (profile?.tenant_id) {
          setTenantId(profile.tenant_id);
          return profile.tenant_id;
        }
      }
      
      // CRITICAL: Do NOT fallback to store - this prevents cross-tenant data leaks
      // If no tenant is found, return null to force proper handling (redirect to onboarding, etc.)
      console.warn('[useTenant] No tenant found for user - returning null');
      setTenantId(null);
      return null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para obter dados do tenant atual
 */
export function useCurrentTenant() {
  const { data: tenantId } = useCurrentTenantId();
  const { setTenant } = useUserStore();

  return useQuery({
    queryKey: ['current-tenant', tenantId],
    queryFn: async () => {
      if (!tenantId) {
        // CRITICAL: Clear tenant from store if no tenantId
        setTenant(null);
        return null;
      }

      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      if (error) {
        console.error('Error fetching tenant:', error);
        // CRITICAL: Do NOT fallback to store - return null to prevent cross-tenant data leaks
        setTenant(null);
        return null;
      }
      
      // Update store with fresh tenant data
      if (data) {
        setTenant(data as Tenant);
      }
      
      return data as Tenant;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    // CRITICAL: Do NOT use initialData from store - always fetch fresh
  });
}

/**
 * Hook para criar um novo tenant
 */
export function useCreateTenant() {
  const queryClient = useQueryClient();
  const { setTenant, setTenantId } = useUserStore();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      slug: string;
      logo_url?: string;
      plan_type?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('tenants')
        .insert({
          name: data.name,
          slug: data.slug,
          logo_url: data.logo_url || null,
          plan_type: data.plan_type || 'free',
        })
        .select()
        .single();

      if (error) throw error;
      return result as Tenant;
    },
    onSuccess: (newTenant) => {
      setTenant(newTenant);
      setTenantId(newTenant.id);
      queryClient.invalidateQueries({ queryKey: ['current-tenant'] });
      queryClient.invalidateQueries({ queryKey: ['current-tenant-id'] });
      toast.success('Empresa criada com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error creating tenant:', error);
      if (error.message.includes('duplicate')) {
        toast.error('Já existe uma empresa com esse slug');
      } else {
        toast.error('Erro ao criar empresa');
      }
    },
  });
}

/**
 * Hook para atualizar o tenant atual
 */
export function useUpdateTenant() {
  const queryClient = useQueryClient();
  const { setTenant } = useUserStore();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: { id: string; name?: string; slug?: string; logo_url?: string; plan_type?: string }) => {
      const { data: updated, error } = await supabase
        .from('tenants')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated as Tenant;
    },
    onSuccess: (updatedTenant) => {
      setTenant(updatedTenant);
      queryClient.invalidateQueries({ queryKey: ['current-tenant'] });
      toast.success('Empresa atualizada com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error updating tenant:', error);
      toast.error('Erro ao atualizar empresa');
    },
  });
}

/**
 * Hook para associar usuário a um tenant
 */
export function useAssignUserToTenant() {
  const queryClient = useQueryClient();
  const { setTenantId } = useUserStore();

  return useMutation({
    mutationFn: async ({
      userId,
      tenantId,
    }: {
      userId: string;
      tenantId: string;
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ tenant_id: tenantId })
        .eq('id', userId);

      if (error) throw error;
      return tenantId;
    },
    onSuccess: (tenantId) => {
      setTenantId(tenantId);
      queryClient.invalidateQueries({ queryKey: ['current-tenant'] });
      queryClient.invalidateQueries({ queryKey: ['current-tenant-id'] });
      queryClient.invalidateQueries({ queryKey: ['user_profile_cached'] });
    },
  });
}

/**
 * Utility: Generate tenant slug from name
 */
export function generateTenantSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// Re-export Tenant type for convenience
export type { Tenant };
