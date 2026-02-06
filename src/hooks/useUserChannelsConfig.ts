import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';

export interface UserChannel {
  id: string;
  user_id: string;
  channel_id: string;
  created_at: string;
  channel?: {
    id: string;
    name: string;
    phone: string;
    status: string;
  };
}

// Cast to bypass missing 'user_channels' type in auto-generated types
const db = supabase as any;

/**
 * Hook para buscar os canais configurados para um usuário específico
 */
export function useUserChannelsConfig(userId?: string) {
  const { tenantId } = useUserStore();

  return useQuery({
    queryKey: ['user-channels-config', userId, tenantId],
    queryFn: async () => {
      if (!userId || !tenantId) return [];

      const { data, error } = await db
        .from('user_channels')
        .select(`
          id,
          user_id,
          channel_id,
          created_at,
          channel:whatsapp_channels(id, name, phone, status)
        `)
        .eq('user_id', userId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Erro ao buscar canais do usuário:', error);
        return [];
      }

      return (data || []) as UserChannel[];
    },
    enabled: !!userId && !!tenantId,
  });
}

/**
 * Hook para buscar os IDs dos canais de um usuário (otimizado)
 */
export function useUserChannelIds(userId?: string) {
  const { tenantId } = useUserStore();

  return useQuery({
    queryKey: ['user-channel-ids', userId, tenantId],
    queryFn: async () => {
      if (!userId || !tenantId) return [];

      const { data, error } = await db
        .from('user_channels')
        .select('channel_id')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Erro ao buscar IDs de canais do usuário:', error);
        return [];
      }

      return (data || []).map((d: any) => d.channel_id);
    },
    enabled: !!userId && !!tenantId,
  });
}

/**
 * Hook para adicionar um canal a um usuário
 */
export function useAddUserChannel() {
  const queryClient = useQueryClient();
  const { tenantId } = useUserStore();

  return useMutation({
    mutationFn: async ({ userId, channelId }: { userId: string; channelId: string }) => {
      const { data, error } = await db
        .from('user_channels')
        .insert({
          user_id: userId,
          channel_id: channelId,
          tenant_id: tenantId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_: any, variables: { userId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['user-channels-config', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['user-channel-ids', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['user-channels'] });
    },
  });
}

/**
 * Hook para remover um canal de um usuário
 */
export function useRemoveUserChannel() {
  const queryClient = useQueryClient();
  const { tenantId } = useUserStore();

  return useMutation({
    mutationFn: async ({ userId, channelId }: { userId: string; channelId: string }) => {
      const { error } = await db
        .from('user_channels')
        .delete()
        .eq('user_id', userId)
        .eq('channel_id', channelId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    },
    onSuccess: (_: any, variables: { userId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['user-channels-config', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['user-channel-ids', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['user-channels'] });
    },
  });
}

/**
 * Hook para sincronizar canais de um usuário (substitui todos)
 */
export function useSyncUserChannels() {
  const queryClient = useQueryClient();
  const { tenantId } = useUserStore();

  return useMutation({
    mutationFn: async ({ userId, channelIds }: { userId: string; channelIds: string[] }) => {
      const { error: deleteError } = await db
        .from('user_channels')
        .delete()
        .eq('user_id', userId)
        .eq('tenant_id', tenantId);

      if (deleteError) throw deleteError;

      if (channelIds.length === 0) return;

      const inserts = channelIds.map(channelId => ({
        user_id: userId,
        channel_id: channelId,
        tenant_id: tenantId,
      }));

      const { error: insertError } = await db
        .from('user_channels')
        .insert(inserts);

      if (insertError) throw insertError;
    },
    onSuccess: (_: any, variables: { userId: string; channelIds: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ['user-channels-config', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['user-channel-ids', variables.userId] });
      queryClient.invalidateQueries({ queryKey: ['user-channels'] });
    },
  });
}
