import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SuperAdmin {
  user_id: string;
  full_name: string;
  tenant_id: string;
  tenant_name: string;
  is_master: boolean;
  profile_created_at: string;
}

export interface UserForMaster {
  user_id: string;
  full_name: string;
  role: string;
  tenant_id: string;
  tenant_name: string;
  is_super_admin: boolean;
  profile_created_at: string;
}

export function useAllSuperAdmins() {
  return useQuery({
    queryKey: ['all_super_admins'],
    queryFn: async (): Promise<SuperAdmin[]> => {
      const { data, error } = await supabase.rpc('get_all_super_admins');
      
      if (error) {
        console.error('Error fetching super admins:', error);
        throw error;
      }
      
      return (data || []) as SuperAdmin[];
    },
  });
}

export function useAllUsersForMaster() {
  return useQuery({
    queryKey: ['all_users_for_master'],
    queryFn: async (): Promise<UserForMaster[]> => {
      const { data, error } = await supabase.rpc('get_all_users_for_master');
      
      if (error) {
        console.error('Error fetching users:', error);
        throw error;
      }
      
      return (data || []) as UserForMaster[];
    },
  });
}

export function usePromoteToSuperAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('promote_to_super_admin', {
        p_user_id: userId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_super_admins'] });
      queryClient.invalidateQueries({ queryKey: ['all_users_for_master'] });
      toast.success('Usuário promovido a Super Admin');
    },
    onError: (error: Error) => {
      console.error('Error promoting user:', error);
      toast.error(error.message || 'Erro ao promover usuário');
    },
  });
}

export function useRemoveSuperAdmin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('remove_super_admin', {
        p_user_id: userId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all_super_admins'] });
      queryClient.invalidateQueries({ queryKey: ['all_users_for_master'] });
      toast.success('Super Admin removido');
    },
    onError: (error: Error) => {
      console.error('Error removing super admin:', error);
      toast.error(error.message || 'Erro ao remover Super Admin');
    },
  });
}

export function useIsMaster() {
  return useQuery({
    queryKey: ['is_master'],
    queryFn: async (): Promise<boolean> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      
      const { data, error } = await supabase.rpc('is_master', {
        _user_id: user.id,
      });
      
      if (error) {
        console.error('Error checking master status:', error);
        return false;
      }
      
      return data === true;
    },
    staleTime: 5 * 60 * 1000,
  });
}
