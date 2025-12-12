import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  settings: Json;
  plan_type: string;
  max_users: number;
  max_contacts: number;
  is_active: boolean;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Hook para obter o tenant_id do usuário atual
 * Usa a função get_user_tenant_id() do banco
 */
export function useCurrentTenantId() {
  return useQuery({
    queryKey: ['current-tenant-id'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_user_tenant_id');
      if (error) throw error;
      return data as string | null;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Hook para obter dados do tenant atual
 */
export function useCurrentTenant() {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['current-tenant', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      if (error) throw error;
      return data as Tenant;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}

/**
 * Hook para criar um novo tenant
 */
export function useCreateTenant() {
  const queryClient = useQueryClient();

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
    onSuccess: () => {
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

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<Tenant> & { id: string }) => {
      const { error } = await supabase
        .from('tenants')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
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
    },
    onSuccess: () => {
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
