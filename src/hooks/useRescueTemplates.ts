import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RescueStep {
  message: string;
  timer_minutes: number;
  audio_url?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
}

export interface RescueTemplate {
  id: string;
  title: string;
  description: string | null;
  steps: RescueStep[];
  final_action: 'close' | 'transfer' | 'none';
  final_action_config: {
    close_reason_id?: string;
    department_id?: string;
  };
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useRescueTemplates() {
  return useQuery({
    queryKey: ['rescue-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rescue_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        steps: (item.steps as unknown as RescueStep[]) || [],
        final_action_config: (item.final_action_config as RescueTemplate['final_action_config']) || {},
      })) as RescueTemplate[];
    },
  });
}

export function useCreateRescueTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: {
      title: string;
      description?: string;
      steps: RescueStep[];
      final_action: 'close' | 'transfer' | 'none';
      final_action_config?: { close_reason_id?: string; department_id?: string };
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('rescue_templates')
        .insert({
          title: template.title,
          description: template.description || null,
          steps: template.steps as unknown as any,
          final_action: template.final_action,
          final_action_config: template.final_action_config || {},
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rescue-templates'] });
    },
  });
}

export function useUpdateRescueTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: {
      id: string;
      title?: string;
      description?: string;
      steps?: RescueStep[];
      final_action?: 'close' | 'transfer' | 'none';
      final_action_config?: { close_reason_id?: string; department_id?: string };
      is_active?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('rescue_templates')
        .update({
          title: template.title,
          description: template.description,
          steps: template.steps as unknown as any,
          final_action: template.final_action,
          final_action_config: template.final_action_config,
          is_active: template.is_active,
        })
        .eq('id', template.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rescue-templates'] });
    },
  });
}

export function useDeleteRescueTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rescue_templates')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rescue-templates'] });
    },
  });
}
