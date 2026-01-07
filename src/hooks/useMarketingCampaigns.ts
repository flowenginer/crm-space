import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MarketingCampaign, MarketingStep } from '@/types/marketing';

export function useMarketingCampaigns() {
  return useQuery({
    queryKey: ['marketing-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        steps: (item.steps as unknown as MarketingStep[]) || [],
      })) as MarketingCampaign[];
    },
  });
}

export function useMarketingCampaign(id: string | null) {
  return useQuery({
    queryKey: ['marketing-campaign', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .eq('id', id!)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        steps: (data.steps as unknown as MarketingStep[]) || [],
      } as MarketingCampaign;
    },
  });
}

export function useCreateMarketingCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaign: {
      title: string;
      description?: string;
      steps: MarketingStep[];
      initial_department_id?: string | null;
      initial_user_id?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Buscar tenant_id do perfil do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user?.id)
        .single();

      if (profileError || !profile?.tenant_id) {
        console.error('Erro ao buscar tenant_id do profile:', profileError);
        throw new Error('Não foi possível identificar o tenant');
      }

      const { data, error } = await supabase
        .from('marketing_campaigns')
        .insert({
          title: campaign.title,
          description: campaign.description || null,
          steps: campaign.steps as unknown as any,
          initial_department_id: campaign.initial_department_id || null,
          initial_user_id: campaign.initial_user_id || null,
          created_by: user?.id,
          tenant_id: profile.tenant_id,
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar marketing_campaigns:', error);
        const details = (error as any)?.details ? ` (${(error as any).details})` : '';
        throw new Error(`${error.message}${details}`);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] });
    },
  });
}

export function useUpdateMarketingCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaign: {
      id: string;
      title?: string;
      description?: string;
      steps?: MarketingStep[];
      is_active?: boolean;
      initial_department_id?: string | null;
      initial_user_id?: string | null;
    }) => {
      const updateData: any = {};
      if (campaign.title !== undefined) updateData.title = campaign.title;
      if (campaign.description !== undefined) updateData.description = campaign.description;
      if (campaign.steps !== undefined) updateData.steps = campaign.steps as unknown as any;
      if (campaign.is_active !== undefined) updateData.is_active = campaign.is_active;
      if (campaign.initial_department_id !== undefined) updateData.initial_department_id = campaign.initial_department_id;
      if (campaign.initial_user_id !== undefined) updateData.initial_user_id = campaign.initial_user_id;

      const { data, error } = await supabase
        .from('marketing_campaigns')
        .update(updateData)
        .eq('id', campaign.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] });
    },
  });
}

export function useDeleteMarketingCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketing_campaigns')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketing-campaigns'] });
    },
  });
}

// Hook to get chatbot flows for automation action
export function useChatbotFlows() {
  return useQuery({
    queryKey: ['chatbot-flows-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chatbot_flows')
        .select('id, name, description')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });
}
