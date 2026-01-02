import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CloudAPIConfig, VoIPProvider } from '@/types/cloudapi';
import type { Json } from '@/integrations/supabase/types';

// Buscar configuração Cloud API do tenant
export function useCloudAPIConfig() {
  return useQuery({
    queryKey: ['cloudapi-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cloudapi_configs')
        .select('*')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data as CloudAPIConfig | null;
    },
  });
}

// Buscar todas as configurações Cloud API do tenant
export function useCloudAPIConfigs() {
  return useQuery({
    queryKey: ['cloudapi-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cloudapi_configs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as CloudAPIConfig[];
    },
  });
}

// Criar nova configuração Cloud API
export function useCreateCloudAPIConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: {
      phone_number_id: string;
      waba_id?: string;
      business_account_id?: string;
      access_token: string;
      verify_token: string;
      app_secret?: string;
      calling_enabled?: boolean;
      voip_provider?: VoIPProvider;
      voip_config?: Json;
      transcription_enabled?: boolean;
      sentiment_analysis_enabled?: boolean;
    }) => {
      const insertData = {
        phone_number_id: config.phone_number_id,
        access_token: config.access_token,
        verify_token: config.verify_token,
        waba_id: config.waba_id || null,
        business_account_id: config.business_account_id || null,
        app_secret: config.app_secret || null,
        calling_enabled: config.calling_enabled || false,
        voip_provider: config.voip_provider || null,
        voip_config: (config.voip_config || {}) as Json,
        transcription_enabled: config.transcription_enabled || false,
        sentiment_analysis_enabled: config.sentiment_analysis_enabled || false,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('cloudapi_configs')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert([insertData as any])
        .select()
        .single();

      if (error) throw error;
      return data as CloudAPIConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cloudapi-configs'] });
      queryClient.invalidateQueries({ queryKey: ['cloudapi-config'] });
      toast.success('Configuração da Cloud API salva com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração da Cloud API');
    },
  });
}

// Atualizar configuração Cloud API
export function useUpdateCloudAPIConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      voip_config,
      ...rest 
    }: Partial<Omit<CloudAPIConfig, 'voip_config'>> & { 
      id: string;
      voip_config?: Json;
    }) => {
      const updateData = {
        ...rest,
        voip_config: (voip_config || {}) as Json,
      };

      const { data, error } = await supabase
        .from('cloudapi_configs')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as CloudAPIConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cloudapi-configs'] });
      queryClient.invalidateQueries({ queryKey: ['cloudapi-config'] });
      toast.success('Configuração atualizada!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar configuração:', error);
      toast.error('Erro ao atualizar configuração');
    },
  });
}

// Deletar configuração Cloud API
export function useDeleteCloudAPIConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cloudapi_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cloudapi-configs'] });
      queryClient.invalidateQueries({ queryKey: ['cloudapi-config'] });
      toast.success('Configuração removida!');
    },
    onError: (error) => {
      console.error('Erro ao remover configuração:', error);
      toast.error('Erro ao remover configuração');
    },
  });
}

// Testar conexão com Cloud API
export function useTestCloudAPIConnection() {
  return useMutation({
    mutationFn: async (config: {
      phone_number_id: string;
      access_token: string;
    }) => {
      // Testar conexão fazendo uma requisição para verificar o phone number
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${config.phone_number_id}`,
        {
          headers: {
            'Authorization': `Bearer ${config.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Falha ao conectar com Cloud API');
      }

      const data = await response.json();
      return {
        success: true,
        phone_number: data.display_phone_number,
        verified_name: data.verified_name,
      };
    },
    onSuccess: (data) => {
      toast.success(`Conexão verificada! Número: ${data.phone_number}`);
    },
    onError: (error: Error) => {
      toast.error(`Falha na conexão: ${error.message}`);
    },
  });
}

// Gerar webhook URL
export function useGenerateWebhookUrl() {
  return useMutation({
    mutationFn: async () => {
      // Gerar verify token aleatório
      const verifyToken = crypto.randomUUID().replace(/-/g, '');
      
      // URL do webhook
      const webhookUrl = `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/cloudapi-webhook`;
      
      return {
        webhook_url: webhookUrl,
        verify_token: verifyToken,
      };
    },
  });
}
