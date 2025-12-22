import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';

const CACHE_TIME = 10 * 60 * 1000; // 10 minutes
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export interface UserProfile {
  id: string;
  full_name: string;
  role: string;
  department_id: string | null;
  tenant_id: string;
  is_active: boolean;
  avatar_url: string | null;
  can_transfer_freely: boolean;
  can_view_all_conversations: boolean;
}

export interface UserDepartment {
  department_id: string;
  department_name: string;
}

/**
 * Hook otimizado para cachear profile do usuário
 * Evita queries repetidas em cada request de conversa
 */
export function useUserProfile() {
  return useQuery({
    queryKey: ['user_profile_cached'],
    queryFn: async (): Promise<UserProfile | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, department_id, tenant_id, is_active, avatar_url, can_transfer_freely, can_view_all_conversations')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data as UserProfile;
    },
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

/**
 * Hook otimizado para cachear departamentos do usuário
 */
export function useUserDepartmentsCached() {
  return useQuery({
    queryKey: ['user_departments_cached'],
    queryFn: async (): Promise<string[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_departments')
        .select('department_id')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching user departments:', error);
        return [];
      }

      return data?.map(d => d.department_id) || [];
    },
    staleTime: STALE_TIME,
    gcTime: CACHE_TIME,
  });
}

/**
 * Hook combinado para contexto completo do usuário
 */
export function useUserContext() {
  const { data: profile, isLoading: profileLoading } = useUserProfile();
  const { data: departmentIds = [], isLoading: deptLoading } = useUserDepartmentsCached();
  const { tenantId } = useUserStore();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'supervisor';
  const canViewAll = isAdmin || profile?.can_view_all_conversations;

  return {
    profile,
    departmentIds,
    tenantId: profile?.tenant_id || tenantId,
    isAdmin,
    canViewAll,
    isLoading: profileLoading || deptLoading,
  };
}

/**
 * Hook para obter apenas o tenant_id do usuário atual
 * Útil para queries que precisam filtrar por tenant
 */
export function useTenantId() {
  const { tenantId } = useUserStore();
  const { data: profile } = useUserProfile();
  
  return profile?.tenant_id || tenantId;
}
