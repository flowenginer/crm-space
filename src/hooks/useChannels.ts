import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface WhatsAppChannel {
  id: string;
  name: string;
  phone: string;
  channel_id: string | null;
  type: string | null;
  status: string | null;
  qr_code: string | null;
  qr_expires_at: string | null;
  battery_level: number | null;
  last_sync_at: string | null;
  messages_sent: number | null;
  messages_sent_today: number | null;
  messages_received: number | null;
  messages_received_today: number | null;
  department_id: string | null;
  provider_id: string | null;
  instance_id: string | null;
  instance_token: string | null;
  webhook_url: string | null;
  session_data: Record<string, unknown> | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  department?: { id: string; name: string } | null;
  provider?: { 
    id: string; 
    name: string; 
    code: string;
    base_url: string;
    api_key: string | null;
    api_secret: string | null;
  } | null;
}

export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_channels')
        .select(`
          id, name, phone, channel_id, type, status, qr_code, qr_expires_at,
          battery_level, last_sync_at, messages_sent, messages_sent_today,
          messages_received, messages_received_today, department_id, provider_id,
          instance_id, instance_token, webhook_url, is_deleted, created_at, updated_at,
          department:departments(id, name),
          provider:whatsapp_providers(id, name, code, base_url, api_key, api_secret)
        `)
        .eq('is_deleted', false)
        .order('name');

      if (error) throw error;
      return data as WhatsAppChannel[];
    },
    staleTime: 60000,
  });
}

export function useDeletedChannels() {
  return useQuery({
    queryKey: ['deleted-channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_channels')
        .select(`
          id, name, phone, status, department_id, provider_id,
          instance_id, is_deleted, deleted_at, created_at,
          department:departments(id, name),
          provider:whatsapp_providers(id, name, code)
        `)
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      return data as WhatsAppChannel[];
    },
    staleTime: 60000,
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channel: { 
      name: string; 
      phone: string; 
      provider_id?: string;
      instance_id?: string;
      instance_token?: string;
      department_id?: string | null;
      type?: string;
    }) => {
      const { data, error } = await supabase
        .from('whatsapp_channels')
        .insert({
          name: channel.name,
          phone: channel.phone,
          provider_id: channel.provider_id || null,
          instance_id: channel.instance_id || null,
          instance_token: channel.instance_token || null,
          department_id: channel.department_id || null,
          type: channel.type || 'unofficial',
          status: 'disconnected',
        } as any)
        .select(`
          *,
          provider:whatsapp_providers(id, name, code, base_url, api_key, api_secret)
        `)
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

export function useUpdateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: unknown }) => {
      const { error } = await supabase
        .from('whatsapp_channels')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });
}

export function useDeleteChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('whatsapp_channels')
        .update({ is_deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-channels'] });
    },
  });
}

export function useRestoreChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('whatsapp_channels')
        .update({ is_deleted: false, deleted_at: null })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-channels'] });
    },
  });
}
