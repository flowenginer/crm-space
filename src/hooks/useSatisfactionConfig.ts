import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SatisfactionConfig {
  id: string;
  tenant_id: string;
  is_active: boolean;
  survey_type: 'nps' | 'csat';
  delay_minutes: number;
  message_nps: string;
  message_csat: string;
  send_only_business_hours: boolean;
  auto_close_on_response: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_NPS_MESSAGE = `Olá! 👋

Gostaríamos de saber sua opinião sobre o atendimento.

De 0 a 10, o quanto você recomendaria nosso atendimento a um amigo?

Responda apenas com o número. Sua opinião é muito importante para nós! 🙏`;

const DEFAULT_CSAT_MESSAGE = `Olá! 👋

Como foi seu atendimento hoje?

😊 Ótimo (responda 5)
😐 Regular (responda 3)
😞 Ruim (responda 1)

Responda com o número correspondente!`;

export function useSatisfactionConfig() {
  return useQuery({
    queryKey: ['satisfaction-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('satisfaction_config')
        .select('*')
        .single();

      if (error) {
        // If no config exists, return default values
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data as SatisfactionConfig;
    },
  });
}

export function useUpdateSatisfactionConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: Partial<SatisfactionConfig>) => {
      // Check if config exists
      const { data: existing } = await supabase
        .from('satisfaction_config')
        .select('id')
        .single();

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from('satisfaction_config')
          .update({
            ...config,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('satisfaction_config')
          .insert({
            is_active: config.is_active ?? false,
            survey_type: config.survey_type ?? 'nps',
            delay_minutes: config.delay_minutes ?? 5,
            message_nps: config.message_nps ?? DEFAULT_NPS_MESSAGE,
            message_csat: config.message_csat ?? DEFAULT_CSAT_MESSAGE,
            send_only_business_hours: config.send_only_business_hours ?? false,
            auto_close_on_response: config.auto_close_on_response ?? true,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['satisfaction-config'] });
      toast.success('Configurações de satisfação atualizadas');
    },
    onError: (error) => {
      console.error('Error updating satisfaction config:', error);
      toast.error('Erro ao atualizar configurações');
    },
  });
}

export function useScheduleSatisfactionSurvey() {
  return useMutation({
    mutationFn: async ({ conversationId, tenantId }: { conversationId: string; tenantId: string }) => {
      const { data, error } = await supabase.functions.invoke('process-satisfaction', {
        body: {
          action: 'schedule',
          conversationId,
          tenantId,
        },
      });

      if (error) throw error;
      return data;
    },
  });
}
