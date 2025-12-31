import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CurrentUser {
  id: string;
  email?: string;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  role: string | null;
  department_id: string | null;
  avatar_url: string | null;
  is_available: boolean | null;
  tenant_id: string | null;
}

interface UserDepartment {
  department_id: string;
}

/**
 * Hook centralizado para obter o usuário autenticado atual
 * OTIMIZAÇÃO: Evita múltiplas chamadas getUser() duplicadas em diferentes hooks
 * 
 * staleTime: Infinity - o usuário não muda durante a sessão
 * gcTime: 30 minutos - manter em cache por bastante tempo
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: async (): Promise<CurrentUser | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      return { id: user.id, email: user.email };
    },
    staleTime: Infinity, // Usuário não muda durante sessão
    gcTime: 30 * 60 * 1000, // 30 minutos
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Hook para obter o perfil do usuário atual
 * Inclui role, department_id e outras informações
 */
export function useCurrentUserProfile() {
  const { data: user } = useCurrentUser();
  
  return useQuery({
    queryKey: ['current-user-profile', user?.id],
    queryFn: async (): Promise<UserProfile | null> => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, department_id, avatar_url, is_available, tenant_id')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para obter os departamentos do usuário atual
 */
export function useCurrentUserDepartments() {
  const { data: user } = useCurrentUser();
  const { data: profile } = useCurrentUserProfile();
  
  return useQuery({
    queryKey: ['current-user-departments', user?.id],
    queryFn: async (): Promise<string[]> => {
      if (!user?.id) return [];
      
      const { data: userDepts } = await supabase
        .from('user_departments')
        .select('department_id')
        .eq('user_id', user.id);
      
      const deptIds = [
        ...(userDepts?.map(ud => ud.department_id) || []),
        profile?.department_id
      ].filter(Boolean) as string[];
      
      return [...new Set(deptIds)]; // Remove duplicates
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook para verificar se o usuário é admin ou supervisor
 */
export function useIsAdminOrSupervisor() {
  const { data: profile } = useCurrentUserProfile();
  return profile?.role === 'admin' || profile?.role === 'supervisor';
}
