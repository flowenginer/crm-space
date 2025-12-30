import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface RedirectCampaign {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  title: string | null;
  subtitle: string | null;
  button_text: string | null;
  button_color: string | null;
  background_color: string | null;
  logo_url: string | null;
  logo_size: number | null;
  thank_you_message: string | null;
  department_id: string | null;
  tag_id: string | null;
  is_active: boolean;
  current_channel_index: number;
  total_clicks: number;
  total_leads: number;
  distribution_mode: 'equal' | 'percentage';
  created_at: string;
  updated_at: string;
  channels?: RedirectCampaignChannel[];
}

export interface RedirectCampaignChannel {
  id: string;
  campaign_id: string;
  channel_id: string;
  is_active: boolean;
  position: number;
  percentage: number;
  channel?: {
    id: string;
    name: string;
    phone: string;
    status: string | null;
  };
}

export interface CreateCampaignInput {
  name: string;
  slug: string;
  logo_url?: string;
  logo_size?: number;
  title?: string;
  subtitle?: string;
  button_text?: string;
  button_color?: string;
  background_color?: string;
  thank_you_message?: string;
  department_id?: string;
  tag_id?: string;
  channel_ids: string[];
  distribution_mode?: 'equal' | 'percentage';
  channel_percentages?: Record<string, number>;
}

export interface UpdateCampaignInput extends Partial<CreateCampaignInput> {
  id: string;
  is_active?: boolean;
}

export function useRedirectCampaigns() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  return useQuery({
    queryKey: ['redirect-campaigns', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('redirect_campaigns')
        .select(`
          *,
          channels:redirect_campaign_channels(
            *,
            channel:whatsapp_channels(id, name, phone, status)
          )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as RedirectCampaign[];
    },
    enabled: !!tenantId,
  });
}

export function useRedirectCampaign(id: string | undefined) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  return useQuery({
    queryKey: ['redirect-campaign', id],
    queryFn: async () => {
      if (!id || !tenantId) return null;

      const { data, error } = await supabase
        .from('redirect_campaigns')
        .select(`
          *,
          channels:redirect_campaign_channels(
            *,
            channel:whatsapp_channels(id, name, phone, status)
          )
        `)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (error) throw error;
      return data as RedirectCampaign;
    },
    enabled: !!id && !!tenantId,
  });
}

export function useCreateRedirectCampaign() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      if (!profile?.tenant_id) throw new Error('Tenant não encontrado');

      // Criar campanha
      const { data: campaign, error: campaignError } = await supabase
        .from('redirect_campaigns')
        .insert({
          tenant_id: profile.tenant_id,
          name: input.name,
          slug: input.slug,
          logo_url: input.logo_url,
          logo_size: input.logo_size || 64,
          title: input.title || 'Fale com nosso time!',
          subtitle: input.subtitle,
          button_text: input.button_text || 'Enviar',
          button_color: input.button_color || '#8B5CF6',
          background_color: input.background_color || '#FFFFFF',
          thank_you_message: input.thank_you_message || 'Obrigado! Entraremos em contato em breve.',
          department_id: input.department_id || null,
          tag_id: input.tag_id || null,
          distribution_mode: input.distribution_mode || 'equal',
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Vincular canais com porcentagens
      if (input.channel_ids.length > 0) {
        const channelInserts = input.channel_ids.map((channel_id, index) => ({
          campaign_id: campaign.id,
          channel_id,
          tenant_id: profile.tenant_id,
          position: index,
          percentage: input.channel_percentages?.[channel_id] || 0,
        }));

        const { error: channelsError } = await supabase
          .from('redirect_campaign_channels')
          .insert(channelInserts);

        if (channelsError) throw channelsError;
      }

      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redirect-campaigns'] });
      toast.success('Campanha criada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar campanha:', error);
      if (error.message.includes('duplicate key')) {
        toast.error('Já existe uma campanha com esse slug');
      } else {
        toast.error('Erro ao criar campanha');
      }
    },
  });
}

export function useUpdateRedirectCampaign() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateCampaignInput) => {
      if (!profile?.tenant_id) throw new Error('Tenant não encontrado');

      const { id, channel_ids, channel_percentages, ...updateData } = input;

      // Atualizar campanha
      const { data: campaign, error: campaignError } = await supabase
        .from('redirect_campaigns')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', profile.tenant_id)
        .select()
        .single();

      if (campaignError) throw campaignError;

      // Atualizar canais se fornecido
      if (channel_ids !== undefined) {
        // Remover canais existentes
        await supabase
          .from('redirect_campaign_channels')
          .delete()
          .eq('campaign_id', id);

        // Adicionar novos canais com porcentagens
        if (channel_ids.length > 0) {
          const channelInserts = channel_ids.map((channel_id, index) => ({
            campaign_id: id,
            channel_id,
            tenant_id: profile.tenant_id,
            position: index,
            percentage: channel_percentages?.[channel_id] || 0,
          }));

          const { error: channelsError } = await supabase
            .from('redirect_campaign_channels')
            .insert(channelInserts);

          if (channelsError) throw channelsError;
        }
      }

      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redirect-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['redirect-campaign'] });
      toast.success('Campanha atualizada com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar campanha:', error);
      toast.error('Erro ao atualizar campanha');
    },
  });
}

export function useDeleteRedirectCampaign() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!profile?.tenant_id) throw new Error('Tenant não encontrado');

      const { error } = await supabase
        .from('redirect_campaigns')
        .delete()
        .eq('id', id)
        .eq('tenant_id', profile.tenant_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redirect-campaigns'] });
      toast.success('Campanha excluída com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao excluir campanha');
    },
  });
}

export function useRedirectCampaignLogs(campaignId: string | undefined) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  return useQuery({
    queryKey: ['redirect-logs', campaignId],
    queryFn: async () => {
      if (!campaignId || !tenantId) return [];

      const { data, error } = await supabase
        .from('redirect_logs')
        .select(`
          *,
          contact:contacts(id, full_name, phone),
          channel:whatsapp_channels(id, name, phone)
        `)
        .eq('campaign_id', campaignId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!campaignId && !!tenantId,
  });
}
