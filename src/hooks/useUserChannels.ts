import { useMemo } from 'react';
import { useChannels, WhatsAppChannel } from '@/hooks/useChannels';
import { useUserDepartments } from '@/hooks/useUserDepartments';
import { useCurrentUserProfile } from '@/hooks/useCurrentUser';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * Hook que retorna os canais WhatsApp filtrados pelos departamentos do usuário.
 * 
 * Lógica:
 * - Admins e Supervisores veem TODOS os canais
 * - Demais usuários veem apenas canais onde:
 *   - channel.department_id está nos departamentos do usuário
 *   - OU channel.department_id é NULL (canais globais)
 */
export function useUserChannels(): WhatsAppChannel[] {
  const { data: profile } = useCurrentUserProfile();
  const { data: userDepartments = [] } = useUserDepartments(profile?.id);
  const { data: allChannels = [] } = useChannels();
  const { isAdmin, isSupervisor } = usePermissions();

  return useMemo(() => {
    // Admins e Supervisores veem todos os canais
    if (isAdmin || isSupervisor) {
      return allChannels;
    }

    // IDs dos departamentos do usuário (da tabela user_departments + department_id do profile)
    const userDeptIds = new Set<string>();
    
    // Adiciona departamentos da tabela user_departments
    userDepartments.forEach(ud => {
      if (ud.department_id) {
        userDeptIds.add(ud.department_id);
      }
    });
    
    // Adiciona o department_id do profile (se existir)
    if (profile?.department_id) {
      userDeptIds.add(profile.department_id);
    }

    // Filtrar: canais do departamento do usuário OU sem departamento (globais)
    return allChannels.filter(channel => 
      !channel.department_id || userDeptIds.has(channel.department_id)
    );
  }, [allChannels, userDepartments, profile?.department_id, isAdmin, isSupervisor]);
}
