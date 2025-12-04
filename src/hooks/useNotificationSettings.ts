import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NotificationSettings {
  id: string;
  user_id: string | null;
  new_messages: boolean | null;
  new_deals: boolean | null;
  stage_changes: boolean | null;
  sla_alerts: boolean | null;
  daily_summary: boolean | null;
  email_enabled: boolean | null;
  push_enabled: boolean | null;
  whatsapp_enabled: boolean | null;
  created_at: string;
  updated_at: string;
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: ['notification_settings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      // Return default settings if none exist
      if (!data) {
        return {
          id: '',
          user_id: user.id,
          new_messages: true,
          new_deals: true,
          stage_changes: false,
          sla_alerts: true,
          daily_summary: false,
          email_enabled: true,
          push_enabled: true,
          whatsapp_enabled: false,
          created_at: '',
          updated_at: ''
        } as NotificationSettings;
      }
      
      return data as NotificationSettings;
    },
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<NotificationSettings>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('notification_settings')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('notification_settings')
          .update(settings)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('notification_settings')
          .insert({ ...settings, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification_settings'] });
    },
  });
}
