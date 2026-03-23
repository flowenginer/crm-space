import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { InstagramChannel } from '@/types/instagram';

// =====================================================
// BUSCAR CANAIS INSTAGRAM ATIVOS
// =====================================================
export function useInstagramChannels() {
  return useQuery({
    queryKey: ['instagram-channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instagram_channels')
        .select(`
          *,
          department:departments(id, name)
        `)
        .eq('is_deleted', false)
        .order('name');

      if (error) throw error;
      return (data || []) as InstagramChannel[];
    },
    staleTime: 60000,
  });
}

// =====================================================
// BUSCAR CANAIS INSTAGRAM DELETADOS
// =====================================================
export function useDeletedInstagramChannels() {
  return useQuery({
    queryKey: ['instagram-channels-deleted'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instagram_channels')
        .select(`
          *,
          department:departments(id, name)
        `)
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      return (data || []) as InstagramChannel[];
    },
    staleTime: 60000,
  });
}

// =====================================================
// CRIAR CANAL INSTAGRAM
// =====================================================
export function useCreateInstagramChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (channel: {
      name: string;
      instagram_account_id: string;
      instagram_username: string;
      page_id: string;
      page_access_token: string;
      app_secret?: string;
      verify_token: string;
      profile_picture_url?: string;
      followers_count?: number;
      department_id?: string | null;
    }) => {
      // Buscar tenant_id do perfil
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) {
        throw new Error('Tenant não encontrado');
      }

      const { data, error } = await supabase
        .from('instagram_channels')
        .insert({
          ...channel,
          tenant_id: profile.tenant_id,
          status: 'connected',
          is_active: true,
          webhook_configured: false,
          app_secret: channel.app_secret || null,
          department_id: channel.department_id || null,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data as InstagramChannel;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-channels'] });
      toast.success('Canal Instagram criado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar canal Instagram:', error);
      toast.error(error.message || 'Erro ao criar canal Instagram');
    },
  });
}

// =====================================================
// ATUALIZAR CANAL INSTAGRAM
// =====================================================
export function useUpdateInstagramChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; [key: string]: unknown }) => {
      const { error } = await supabase
        .from('instagram_channels')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-channels'] });
      toast.success('Canal Instagram atualizado!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar canal');
    },
  });
}

// =====================================================
// DELETAR CANAL INSTAGRAM (soft delete)
// =====================================================
export function useDeleteInstagramChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('instagram_channels')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          status: 'disconnected',
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-channels'] });
      queryClient.invalidateQueries({ queryKey: ['instagram-channels-deleted'] });
      toast.success('Canal Instagram removido!');
    },
    onError: () => {
      toast.error('Erro ao remover canal Instagram');
    },
  });
}

// =====================================================
// RESTAURAR CANAL INSTAGRAM
// =====================================================
export function useRestoreInstagramChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('instagram_channels')
        .update({
          is_deleted: false,
          deleted_at: null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instagram-channels'] });
      queryClient.invalidateQueries({ queryKey: ['instagram-channels-deleted'] });
      toast.success('Canal Instagram restaurado!');
    },
    onError: () => {
      toast.error('Erro ao restaurar canal Instagram');
    },
  });
}

// =====================================================
// TESTAR CONEXÃO COM INSTAGRAM
// =====================================================
export function useTestInstagramConnection() {
  return useMutation({
    mutationFn: async (config: {
      page_access_token: string;
      instagram_account_id: string;
    }) => {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${config.instagram_account_id}?fields=username,name,profile_picture_url,followers_count`,
        {
          headers: {
            'Authorization': `Bearer ${config.page_access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Falha ao conectar com Instagram');
      }

      const data = await response.json();
      return {
        success: true,
        username: data.username,
        name: data.name,
        profile_picture_url: data.profile_picture_url,
        followers_count: data.followers_count,
      };
    },
    onSuccess: (data) => {
      toast.success(`Conexão verificada! @${data.username}`);
    },
    onError: (error: Error) => {
      toast.error(`Falha na conexão: ${error.message}`);
    },
  });
}

// =====================================================
// GERAR WEBHOOK URL INSTAGRAM
// =====================================================
export function useGenerateInstagramWebhookUrl() {
  return useMutation({
    mutationFn: async () => {
      const verifyToken = crypto.randomUUID().replace(/-/g, '');
      const webhookUrl = `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/instagram-webhook`;

      return {
        webhook_url: webhookUrl,
        verify_token: verifyToken,
      };
    },
  });
}
