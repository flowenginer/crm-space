import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook para obter o departamento primário do usuário atual
 * Prioridade: 
 * 1. Departamento marcado como is_primary em user_departments
 * 2. Primeiro departamento em user_departments
 * 3. Departamento do profile (fallback legado)
 */
export function useUserPrimaryDepartment(userId?: string) {
  return useQuery({
    queryKey: ['user-primary-department', userId],
    queryFn: async (): Promise<string | null> => {
      if (!userId) return null;
      return getUserPrimaryDepartment(userId);
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Função utilitária para buscar o departamento primário do usuário
 * Pode ser usada fora de hooks React
 */
export async function getUserPrimaryDepartment(userId: string): Promise<string | null> {
  // 1. Buscar departamento primário em user_departments
  const { data: primaryDept } = await supabase
    .from('user_departments')
    .select('department_id')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .maybeSingle();

  if (primaryDept?.department_id) {
    return primaryDept.department_id;
  }

  // 2. Fallback: buscar primeiro departamento do usuário
  const { data: anyDept } = await supabase
    .from('user_departments')
    .select('department_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  if (anyDept?.department_id) {
    return anyDept.department_id;
  }

  // 3. Último fallback: department_id do profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('department_id')
    .eq('id', userId)
    .single();

  return profile?.department_id || null;
}
