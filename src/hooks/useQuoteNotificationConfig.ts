import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from './useTenant';
import { toast } from 'sonner';

export interface QuoteNotificationConfig {
  id: string;
  tenant_id: string;
  quote_expiration_enabled: boolean;
  quote_expiration_days: number[];
  quote_expiration_template: string;
  notification_channel_id: string | null;
  notification_send_time: string;
  notification_send_times: string[];
  notification_trigger_type: 'before_expiry' | 'after_sent';
  days_after_sent: number[];
  daily_limit: number;
  min_interval_hours: number;
  pause_on_weekends: boolean;
  use_client_channel: boolean;
  created_at: string;
  updated_at: string;
}

const DEFAULT_TEMPLATE = `Olá {cliente_nome}! 👋

Seu orçamento #{numero} no valor de {valor} expira em {dias_restantes}.

📅 Validade: {data_validade}

Posso te ajudar a finalizar?`;

export function useQuoteNotificationConfig() {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['quote-notification-config', tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('tenant_notification_config' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle() as any);

      if (error) throw error;

      // Return default config if none exists
      if (!data) {
        return {
          id: '',
          tenant_id: tenantId!,
          quote_expiration_enabled: false,
          quote_expiration_days: [3, 1],
          quote_expiration_template: DEFAULT_TEMPLATE,
          notification_channel_id: null,
          notification_send_time: '09:00',
          notification_send_times: ['09:00'],
          notification_trigger_type: 'before_expiry',
          days_after_sent: [1, 3],
          daily_limit: 50,
          min_interval_hours: 24,
          pause_on_weekends: false,
          use_client_channel: true,
          created_at: '',
          updated_at: '',
        } as QuoteNotificationConfig;
      }

      return data as QuoteNotificationConfig;
    },
    enabled: !!tenantId,
  });
}

export function useUpdateQuoteNotificationConfig() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (config: Partial<QuoteNotificationConfig>) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      // Check if config exists
      const { data: existing } = await (supabase
        .from('tenant_notification_config' as any)
        .select('id')
        .eq('tenant_id', tenantId)
        .maybeSingle() as any);

      if (existing) {
        // Update existing
        const { error } = await (supabase
          .from('tenant_notification_config' as any)
          .update({
            ...config,
            updated_at: new Date().toISOString(),
          })
          .eq('tenant_id', tenantId) as any);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await (supabase
          .from('tenant_notification_config' as any)
          .insert({
            tenant_id: tenantId,
            quote_expiration_enabled: config.quote_expiration_enabled ?? false,
            quote_expiration_days: config.quote_expiration_days ?? [3, 1],
            quote_expiration_template: config.quote_expiration_template ?? DEFAULT_TEMPLATE,
            notification_channel_id: config.notification_channel_id ?? null,
          }) as any);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-notification-config'] });
      toast.success('Configurações salvas com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao salvar configurações: ' + error.message);
    },
  });
}

export function useQuoteNotificationHistory(quoteId?: string) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['quote-notification-history', tenantId, quoteId],
    queryFn: async () => {
      let query = supabase
        .from('quote_expiration_notifications' as any)
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(50) as any;

      if (quoteId) {
        query = query.eq('quote_id', quoteId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });
}
