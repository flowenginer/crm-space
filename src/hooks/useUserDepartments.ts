import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface UserDepartment {
  id: string;
  user_id: string;
  department_id: string;
  is_primary: boolean;
  created_at: string;
  department?: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  };
}

export function useUserDepartments(userId?: string) {
  return useQuery({
    queryKey: ['user-departments', userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_departments')
        .select(`
          *,
          department:departments(id, name, color, icon)
        `)
        .eq('user_id', userId!)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      return data as UserDepartment[];
    },
  });
}

export function useAllUserDepartments() {
  return useQuery({
    queryKey: ['all-user-departments'],
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_departments')
        .select(`
          *,
          department:departments(id, name, color, icon),
          user:profiles(id, full_name, avatar_url, role)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useAddUserToDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, departmentId, isPrimary = false }: { 
      userId: string; 
      departmentId: string; 
      isPrimary?: boolean 
    }) => {
      // Se for primário, primeiro remove o primário atual
      if (isPrimary) {
        await supabase
          .from('user_departments')
          .update({ is_primary: false })
          .eq('user_id', userId);
      }

      const { data, error } = await supabase
        .from('user_departments')
        .insert({ user_id: userId, department_id: departmentId, is_primary: isPrimary })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-departments', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['all-user-departments'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Departamento adicionado com sucesso');
    },
    onError: (error: Error) => {
      if (error.message.includes('duplicate')) {
        toast.error('Usuário já está neste departamento');
      } else {
        toast.error('Erro ao adicionar departamento');
      }
    },
  });
}

export function useRemoveUserFromDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, departmentId }: { userId: string; departmentId: string }) => {
      const { error } = await supabase
        .from('user_departments')
        .delete()
        .eq('user_id', userId)
        .eq('department_id', departmentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-departments', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['all-user-departments'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast.success('Departamento removido');
    },
    onError: () => {
      toast.error('Erro ao remover departamento');
    },
  });
}

export function useSetPrimaryDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, departmentId }: { userId: string; departmentId: string }) => {
      // Remove primary de todos
      await supabase
        .from('user_departments')
        .update({ is_primary: false })
        .eq('user_id', userId);

      // Define novo primary
      const { error } = await supabase
        .from('user_departments')
        .update({ is_primary: true })
        .eq('user_id', userId)
        .eq('department_id', departmentId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user-departments', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['all-user-departments'] });
      toast.success('Departamento principal definido');
    },
    onError: () => {
      toast.error('Erro ao definir departamento principal');
    },
  });
}

// Verifica se usuário tem acesso a um departamento específico
export function useCheckDepartmentAccess(userId?: string, departmentId?: string) {
  return useQuery({
    queryKey: ['department-access', userId, departmentId],
    enabled: !!userId && !!departmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_departments')
        .select('id')
        .eq('user_id', userId!)
        .eq('department_id', departmentId!)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
  });
}
