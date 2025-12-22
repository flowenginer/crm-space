import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook para verificar se o usuário atual é Super Admin
 */
export function useIsSuperAdmin() {
  return useQuery({
    queryKey: ['is_super_admin'],
    queryFn: async (): Promise<boolean> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase.rpc('is_super_admin', {
        _user_id: user.id
      });

      if (error) {
        console.error('Error checking super admin status:', error);
        return false;
      }

      return data === true;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook para verificar se o usuário é dono do tenant
 */
export function useIsTenantOwner() {
  return useQuery({
    queryKey: ['is_tenant_owner'],
    queryFn: async (): Promise<boolean> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase.rpc('is_tenant_owner', {
        _user_id: user.id
      });

      if (error) {
        console.error('Error checking tenant owner status:', error);
        return false;
      }

      return data === true;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface TenantAdmin {
  id: string;
  user_id: string;
  tenant_id: string;
  is_owner: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Hook para listar admins do tenant
 */
export function useTenantAdmins(tenantId?: string) {
  return useQuery({
    queryKey: ['tenant_admins', tenantId],
    queryFn: async (): Promise<TenantAdmin[]> => {
      let query = supabase.from('tenant_admins').select('*');
      
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tenant admins:', error);
        throw error;
      }

      return data as TenantAdmin[];
    },
    enabled: !!tenantId,
  });
}

/**
 * Hook para adicionar um admin ao tenant
 */
export function useAddTenantAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, tenantId, isOwner = false }: { 
      userId: string; 
      tenantId: string; 
      isOwner?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('tenant_admins')
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          is_owner: isOwner,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant_admins', variables.tenantId] });
      toast.success('Admin adicionado com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error adding tenant admin:', error);
      toast.error('Erro ao adicionar admin');
    },
  });
}

/**
 * Hook para remover um admin do tenant
 */
export function useRemoveTenantAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, tenantId }: { id: string; tenantId: string }) => {
      const { error } = await supabase
        .from('tenant_admins')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenant_admins', variables.tenantId] });
      toast.success('Admin removido com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error removing tenant admin:', error);
      toast.error('Erro ao remover admin');
    },
  });
}

/**
 * Hook para promover um usuário a Super Admin
 * Apenas Super Admins podem fazer isso
 */
export function usePromoteToSuperAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'super_admin' as const,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['is_super_admin'] });
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
      toast.success('Usuário promovido a Super Admin');
    },
    onError: (error: Error) => {
      console.error('Error promoting to super admin:', error);
      toast.error('Erro ao promover usuário');
    },
  });
}

/**
 * Hook para remover role de Super Admin
 */
export function useRemoveSuperAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'super_admin');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['is_super_admin'] });
      queryClient.invalidateQueries({ queryKey: ['user_roles'] });
      toast.success('Role de Super Admin removida');
    },
    onError: (error: Error) => {
      console.error('Error removing super admin role:', error);
      toast.error('Erro ao remover role');
    },
  });
}

/**
 * Hook para verificar se pode gerenciar um tenant específico
 */
export function useCanManageTenant(tenantId?: string) {
  return useQuery({
    queryKey: ['can_manage_tenant', tenantId],
    queryFn: async (): Promise<boolean> => {
      if (!tenantId) return false;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase.rpc('can_manage_tenant', {
        _tenant_id: tenantId,
        _user_id: user.id
      });

      if (error) {
        console.error('Error checking tenant management permission:', error);
        return false;
      }

      return data === true;
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });
}
