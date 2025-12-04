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
  messages_received: number | null;
  department_id: string | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  department?: { id: string; name: string } | null;
}

export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_channels')
        .select(`
          *,
          department:departments(id, name)
        `)
        .eq('is_deleted', false)
        .order('name');

      if (error) throw error;
      return data as WhatsAppChannel[];
    },
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channel: { name: string; phone: string; department_id?: string | null }) => {
      const { data, error } = await supabase
        .from('whatsapp_channels')
        .insert({
          name: channel.name,
          phone: channel.phone,
          department_id: channel.department_id
        })
        .select()
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
    mutationFn: async ({ id, ...channel }: Partial<WhatsAppChannel> & { id: string }) => {
      const { error } = await supabase
        .from('whatsapp_channels')
        .update(channel)
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
    },
  });
}
