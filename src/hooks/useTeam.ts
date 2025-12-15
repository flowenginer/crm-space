import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TeamMember {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  department_id: string | null;
  is_online: boolean | null;
  is_available: boolean | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  department?: { id: string; name: string } | null;
  role?: string;
}

export function useTeam() {
  return useQuery({
    queryKey: ['team'],
    staleTime: 5 * 60 * 1000, // 5 minutos - equipe raramente muda
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id, full_name, avatar_url, phone, department_id,
          is_online, is_available, last_seen_at, is_active, role, created_at, updated_at,
          department:departments(id, name)
        `)
        .order('full_name');

      if (error) throw error;
      
      // Get roles for each user
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');
      
      const roleMap: Record<string, string> = {};
      rolesData?.forEach(r => {
        roleMap[r.user_id] = r.role;
      });
      
      return data.map(member => ({
        ...member,
        role: roleMap[member.id] || 'user'
      })) as TeamMember[];
    },
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<TeamMember> & { id: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: data.full_name,
          phone: data.phone,
          department_id: data.department_id,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });
}
