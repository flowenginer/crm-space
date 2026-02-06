import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useChannels, WhatsAppChannel } from '@/hooks/useChannels';
import { useUserDepartments } from '@/hooks/useUserDepartments';
import { useCurrentUserProfile } from '@/hooks/useCurrentUser';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';

/**
 * Hook que retorna os canais WhatsApp que o usuário atual pode acessar.
 *
 * Lógica de prioridade:
 * 1. Admins e Supervisores veem TODOS os canais
 * 2. Se o usuário tem canais configurados em user_channels → usa SOMENTE esses
 * 3. Se não tem configuração em user_channels → fallback para departamento
 *    - Canais do departamento do usuário
 *    - OU canais sem departamento (globais)
 */
export function useUserChannels(): WhatsAppChannel[] {
  const { data: profile } = useCurrentUserProfile();
  const { data: userDepartments = [] } = useUserDepartments(profile?.id);
  const { data: allChannels = [] } = useChannels();
  const { isAdmin, isSupervisor } = usePermissions();
  const { tenantId } = useUserStore();

  // Buscar canais configurados diretamente para o usuário
  const { data: userChannelIds = [] } = useQuery({
    queryKey: ['user-channel-ids-direct', profile?.id, tenantId],
    queryFn: async () => {
      if (!profile?.id || !tenantId) return [];

      const { data, error } = await (supabase as any)
        .from('user_channels')
        .select('channel_id')
        .eq('user_id', profile.id)
        .eq('tenant_id', tenantId);

      if (error) {
        // Tabela pode não existir ainda - ignora erro silenciosamente
        console.warn('Aviso: tabela user_channels não encontrada ou erro:', error.message);
        return [];
      }

      return (data || []).map(d => d.channel_id);
    },
    enabled: !!profile?.id && !!tenantId,
    staleTime: 30000, // 30 segundos de cache
  });

  return useMemo(() => {
    // Admins e Supervisores veem todos os canais
    if (isAdmin || isSupervisor) {
      return allChannels;
    }

    // Se o usuário tem canais configurados diretamente, usa SOMENTE esses
    if (userChannelIds.length > 0) {
      const channelIdSet = new Set(userChannelIds);
      return allChannels.filter(channel => channelIdSet.has(channel.id));
    }

    // Fallback: comportamento por departamento
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
  }, [allChannels, userDepartments, profile?.department_id, isAdmin, isSupervisor, userChannelIds]);
}
