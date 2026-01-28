import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createWhatsAppInstance, getWhatsAppQRCode, syncChannelStatus, reconfigureChannelWebhook } from '@/lib/whatsapp/instance-creator';

interface CreateChannelData {
  name: string;
  phone: string;
  providerCode: 'zapi' | 'uazapi' | 'evolution' | 'cloudapi';
  departmentId?: string;
}

export function useCreateChannelWithInstance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateChannelData) => {
      // 1. Buscar provedor
      const { data: provider, error: providerError } = await supabase
        .from('whatsapp_providers')
        .select('*')
        .eq('code', data.providerCode)
        .single();

      if (providerError || !provider) {
        throw new Error('Provedor não encontrado');
      }

      // Type assertion for the new fields
      const providerData = provider as typeof provider & {
        admin_token?: string;
        client_token?: string;
        is_configured?: boolean;
      };

      if (!providerData.is_configured) {
        throw new Error(`Configure as credenciais do ${provider.name} em Configurações > Integrações`);
      }

      // Validar se é um provedor que suporta criação automática de instância
      const validProviderCodes = ['zapi', 'uazapi', 'evolution'];
      if (!validProviderCodes.includes(data.providerCode)) {
        throw new Error(`Provedor ${provider.name} não suporta criação automática de instância. Use o método manual.`);
      }

      // 2. Gerar nome único para instância
      const instanceName = data.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        + '-' + Date.now().toString(36);

      // 3. Criar instância na API do provedor
      const supabaseUrl = 'https://lkxrmjqrzhaivviuuamp.supabase.co';
      
      toast.loading('Criando instância no provedor...');
      
      const result = await createWhatsAppInstance(
        data.providerCode as 'zapi' | 'uazapi' | 'evolution',
        instanceName,
        supabaseUrl
      );

      if (!result.success) {
        throw new Error(result.error || 'Falha ao criar instância');
      }

      // 4. Salvar canal no banco
      const { data: channel, error: channelError } = await supabase
        .from('whatsapp_channels')
        .insert({
          name: data.name,
          phone: data.phone,
          provider_id: provider.id,
          instance_id: result.instanceId,
          instance_token: result.token,
          department_id: data.departmentId || null,
          status: 'disconnected',
          qr_code: result.qrCode || null,
          qr_expires_at: result.qrCode 
            ? new Date(Date.now() + 60000).toISOString() 
            : null,
        } as any)
        .select(`
          *,
          provider:whatsapp_providers(id, name, code)
        `)
        .single();

      if (channelError) {
        throw new Error('Falha ao salvar canal: ' + channelError.message);
      }

      // 5. Configurar webhook automaticamente após criação
      console.log('[useCreateChannelWithInstance] Configurando webhook automaticamente para canal:', channel.id);
      try {
        const webhookResult = await reconfigureChannelWebhook(channel.id);
        if (webhookResult.success) {
          console.log('[useCreateChannelWithInstance] Webhook configurado com sucesso:', webhookResult.webhookUrl);
        } else {
          console.warn('[useCreateChannelWithInstance] Falha ao configurar webhook:', webhookResult.error);
        }
      } catch (webhookError) {
        console.warn('[useCreateChannelWithInstance] Erro ao configurar webhook:', webhookError);
        // Não falhar a criação do canal se o webhook falhar - pode ser reconfigurado depois
      }

      return {
        channel,
        qrCode: result.qrCode,
      };
    },
    onSuccess: (data) => {
      toast.dismiss();
      if (data.qrCode) {
        toast.success('Canal criado! Escaneie o QR Code para conectar.');
      } else {
        toast.success('Canal criado com sucesso!');
      }
      queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
    onError: (error: any) => {
      toast.dismiss();
      toast.error(error.message || 'Erro ao criar canal');
    },
  });
}

// Hook para buscar QR Code atualizado
export function useRefreshQRCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      // Buscar canal com admin_token do provedor
      const { data: channel, error } = await supabase
        .from('whatsapp_channels')
        .select(`
          *,
          provider:whatsapp_providers(id, name, code, base_url, admin_token)
        `)
        .eq('id', channelId)
        .single();

      if (error || !channel) {
        throw new Error('Canal não encontrado');
      }

      const providerData = channel.provider as {
        id: string;
        name: string;
        code: string;
        base_url: string;
        admin_token?: string;
      } | null;

      // Validar se o provider existe e é suportado
      if (!providerData || !providerData.code) {
        throw new Error('Canal sem provedor configurado');
      }

      const validCodes = ['zapi', 'uazapi', 'evolution'];
      if (!validCodes.includes(providerData.code)) {
        throw new Error('Provedor não suporta reconexão via QR Code');
      }

      // Buscar novo QR Code
      const result = await getWhatsAppQRCode(
        providerData.code as 'zapi' | 'uazapi' | 'evolution',
        channel.instance_id || '',
        channel.instance_token || providerData.admin_token || ''
      );

      if (result.connected) {
        // Atualizar status para conectado
        await supabase
          .from('whatsapp_channels')
          .update({
            status: 'connected',
            qr_code: null,
            qr_expires_at: null,
          })
          .eq('id', channelId);

        // Após conexão, reconfigurar webhook e sincronizar status
        console.log('[useRefreshQRCode] Canal conectado, reconfigurando webhook...');
        try {
          const webhookResult = await reconfigureChannelWebhook(channelId);
          if (webhookResult.success) {
            console.log('[useRefreshQRCode] Webhook reconfigurado:', webhookResult.webhookUrl);
          } else {
            console.warn('[useRefreshQRCode] Falha ao reconfigurar webhook:', webhookResult.error);
          }
        } catch (webhookError) {
          console.warn('[useRefreshQRCode] Erro ao reconfigurar webhook:', webhookError);
        }

        // Sincronizar status para garantir que está atualizado
        try {
          const syncResult = await syncChannelStatus(channelId);
          console.log('[useRefreshQRCode] Status sincronizado:', syncResult);
        } catch (syncError) {
          console.warn('[useRefreshQRCode] Erro ao sincronizar status:', syncError);
        }

        return { connected: true };
      }

      if (result.qrCode) {
        // Atualizar QR Code
        await supabase
          .from('whatsapp_channels')
          .update({
            qr_code: result.qrCode,
            qr_expires_at: new Date(Date.now() + 60000).toISOString(),
          })
          .eq('id', channelId);
      }

      return result;
    },
    onSuccess: (data) => {
      if (data.connected) {
        toast.success('WhatsApp conectado com sucesso!');
      }
      queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar QR Code');
    },
  });
}

// Hook para sincronizar status do canal
export function useSyncChannelStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channelId: string) => {
      const result = await syncChannelStatus(channelId);

      if (!result.success) {
        throw new Error(result.error || 'Falha ao sincronizar status');
      }

      return result;
    },
    onSuccess: (data) => {
      if (data.status === 'connected') {
        toast.success(`Canal conectado! Telefone: ${data.phone || 'N/A'}`);
      } else {
        toast.info('Status sincronizado: ' + (data.message || data.status));
      }
      queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao sincronizar status');
    },
  });
}
