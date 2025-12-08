import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  is_active: boolean | null;
  created_at: string;
  member_count?: number;
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    staleTime: 60000, // 1 minute cache - departments rarely change
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      
      // Get member counts from user_departments table (new approach)
      const { data: userDepts } = await supabase
        .from('user_departments')
        .select('department_id');
      
      const countMap: Record<string, number> = {};
      userDepts?.forEach(ud => {
        if (ud.department_id) {
          countMap[ud.department_id] = (countMap[ud.department_id] || 0) + 1;
        }
      });

      return data.map(dept => ({
        ...dept,
        member_count: countMap[dept.id] || 0
      })) as Department[];
    },
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (department: { name: string; description?: string | null; color?: string | null; icon?: string | null; is_active?: boolean | null }) => {
      const { data, error } = await supabase
        .from('departments')
        .insert(department)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...department }: Partial<Department> & { id: string }) => {
      const { error } = await supabase
        .from('departments')
        .update(department)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('departments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });
}