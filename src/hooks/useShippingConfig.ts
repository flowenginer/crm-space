import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ShippingConfig {
  provider?: 'melhor_envio';
  is_configured?: boolean;
  environment?: 'sandbox' | 'production';
  token?: string;
  default_services?: string[];
}

export function useShippingConfig() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['shipping-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('shipping_config')
        .maybeSingle();

      if (error) throw error;
      return (data?.shipping_config as ShippingConfig) || null;
    },
    staleTime: 1000 * 60,
  });

  const updateConfig = useMutation({
    mutationFn: async (newConfig: ShippingConfig) => {
      // Check if settings exist
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('company_settings')
          .update({ shipping_config: newConfig as any })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert({ shipping_config: newConfig } as any);
        if (error) throw error;
      }

      return newConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipping-config'] });
      queryClient.invalidateQueries({ queryKey: ['company_settings'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar configuração: ' + error.message);
    },
  });

  return {
    config,
    isLoading,
    updateConfig,
  };
}
