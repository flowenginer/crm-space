import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InstagramConfig {
  id: string;
  tenant_id: string;
  channel_id: string | null;
  page_id: string;
  instagram_account_id: string;
  page_access_token: string;
  app_secret: string | null;
  verify_token: string;
  is_active: boolean;
  webhook_configured: boolean;
  created_at: string;
  updated_at: string;
}

export function useInstagramConfig() {
  return useQuery({
    queryKey: ['instagram-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instagram_configs')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data as InstagramConfig | null;
    },
  });
}

export function useSaveInstagramConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: {
      page_id: string;
      instagram_account_id: string;
      page_access_token: string;
      app_secret?: string;
      channel_name: string;
    }) => {
      // Get tenant_id from profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) throw new Error('No tenant found');

      // Create or find a channel for Instagram Direct
      let channelId: string | null = null;

      // Check existing channel
      const { data: existingChannel } = await supabase
        .from('whatsapp_channels')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('type', 'instagram')
        .eq('is_deleted', false)
        .maybeSingle();

      if (existingChannel) {
        channelId = existingChannel.id;
        // Update channel
        await supabase
          .from('whatsapp_channels')
          .update({
            name: config.channel_name,
            status: 'connected',
            updated_at: new Date().toISOString(),
          })
          .eq('id', channelId);
      } else {
        // Create new channel
        const { data: newChannel, error: channelError } = await supabase
          .from('whatsapp_channels')
          .insert({
            name: config.channel_name,
            phone: `ig:${config.instagram_account_id}`,
            tenant_id: profile.tenant_id,
            type: 'instagram',
            status: 'connected',
          })
          .select('id')
          .single();

        if (channelError) throw channelError;
        channelId = newChannel.id;
      }

      // Check existing config
      const { data: existingConfig } = await supabase
        .from('instagram_configs')
        .select('id')
        .eq('tenant_id', profile.tenant_id)
        .eq('instagram_account_id', config.instagram_account_id)
        .maybeSingle();

      if (existingConfig) {
        // Update
        const { error } = await supabase
          .from('instagram_configs')
          .update({
            page_id: config.page_id,
            page_access_token: config.page_access_token,
            app_secret: config.app_secret || null,
            channel_id: channelId,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingConfig.id);

        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from('instagram_configs')
          .insert({
            tenant_id: profile.tenant_id,
            channel_id: channelId,
            page_id: config.page_id,
            instagram_account_id: config.instagram_account_id,
            page_access_token: config.page_access_token,
            app_secret: config.app_secret || null,
          });

        if (error) throw error;
      }

      return { channelId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-config'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

export function useDisconnectInstagram() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (configId: string) => {
      // Get config to find channel
      const { data: config } = await supabase
        .from('instagram_configs')
        .select('channel_id')
        .eq('id', configId)
        .single();

      // Deactivate config
      await supabase
        .from('instagram_configs')
        .update({ is_active: false })
        .eq('id', configId);

      // Disconnect channel
      if (config?.channel_id) {
        await supabase
          .from('whatsapp_channels')
          .update({ status: 'disconnected' })
          .eq('id', config.channel_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-config'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}
