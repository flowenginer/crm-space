import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface ABTest {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  distribution_type: 'equal' | 'weighted';
  total_views: number;
  created_at: string;
  updated_at: string;
  // New fields
  goal_type: 'visits' | 'leads' | 'time' | null;
  goal_value: number | null;
  goal_reached: boolean;
  end_date: string | null;
  winner_variant_id: string | null;
  status: 'running' | 'paused' | 'completed';
  auto_winner: boolean;
  variants?: ABTestVariant[];
}

export interface ABTestVariant {
  id: string;
  ab_test_id: string;
  campaign_id: string;
  weight: number;
  views_count: number;
  leads_count: number;
  created_at: string;
  tenant_id: string;
  campaign?: {
    id: string;
    name: string;
    slug: string;
    total_leads: number;
  };
}

export interface CreateABTestInput {
  name: string;
  slug: string;
  distribution_type: 'equal' | 'weighted';
  campaign_ids: string[];
  weights?: Record<string, number>;
  // New goal fields
  goal_type?: 'visits' | 'leads' | 'time';
  goal_value?: number;
  end_date?: string;
  auto_winner?: boolean;
}

export interface UpdateABTestInput extends Partial<CreateABTestInput> {
  id: string;
  is_active?: boolean;
  status?: 'running' | 'paused' | 'completed';
  winner_variant_id?: string;
}

export function useABTests() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  return useQuery({
    queryKey: ['ab-tests', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('redirect_ab_tests')
        .select(`
          *,
          variants:redirect_ab_test_variants(
            *,
            campaign:redirect_campaigns(id, name, slug, total_leads)
          )
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as ABTest[];
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useABTest(id: string | undefined) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  return useQuery({
    queryKey: ['ab-test', id],
    queryFn: async () => {
      if (!id || !tenantId) return null;

      const { data, error } = await supabase
        .from('redirect_ab_tests')
        .select(`
          *,
          variants:redirect_ab_test_variants(
            *,
            campaign:redirect_campaigns(id, name, slug, total_leads)
          )
        `)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single();

      if (error) throw error;
      return data as unknown as ABTest;
    },
    enabled: !!id && !!tenantId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCreateABTest() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateABTestInput) => {
      if (!profile?.tenant_id) throw new Error('Tenant não encontrado');

      const equalWeight = Math.floor(100 / input.campaign_ids.length);
      
      // Create A/B test with new goal fields
      const { data: abTest, error: abTestError } = await supabase
        .from('redirect_ab_tests')
        .insert({
          tenant_id: profile.tenant_id,
          name: input.name,
          slug: input.slug,
          distribution_type: input.distribution_type,
          goal_type: input.goal_type || null,
          goal_value: input.goal_value || null,
          end_date: input.end_date || null,
          auto_winner: input.auto_winner || false,
          status: 'running',
        })
        .select()
        .single();

      if (abTestError) throw abTestError;

      // Create variants
      const variantInserts = input.campaign_ids.map((campaign_id) => ({
        ab_test_id: abTest.id,
        campaign_id,
        tenant_id: profile.tenant_id,
        weight: input.distribution_type === 'equal' 
          ? equalWeight 
          : (input.weights?.[campaign_id] || equalWeight),
      }));

      const { error: variantsError } = await supabase
        .from('redirect_ab_test_variants')
        .insert(variantInserts);

      if (variantsError) throw variantsError;

      return abTest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-tests'] });
      toast.success('Teste A/B criado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao criar teste A/B:', error);
      if (error.message.includes('duplicate key')) {
        toast.error('Já existe um teste A/B com esse slug');
      } else {
        toast.error('Erro ao criar teste A/B');
      }
    },
  });
}

export function useUpdateABTest() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: UpdateABTestInput) => {
      if (!profile?.tenant_id) throw new Error('Tenant não encontrado');

      const { id, campaign_ids, weights, ...updateData } = input;

      // Update A/B test
      const { data: abTest, error: abTestError } = await supabase
        .from('redirect_ab_tests')
        .update(updateData)
        .eq('id', id)
        .eq('tenant_id', profile.tenant_id)
        .select()
        .single();

      if (abTestError) throw abTestError;

      // Update variants if provided
      if (campaign_ids !== undefined) {
        await supabase
          .from('redirect_ab_test_variants')
          .delete()
          .eq('ab_test_id', id);

        if (campaign_ids.length > 0) {
          const equalWeight = Math.floor(100 / campaign_ids.length);
          
          const variantInserts = campaign_ids.map((campaign_id) => ({
            ab_test_id: id,
            campaign_id,
            tenant_id: profile.tenant_id,
            weight: input.distribution_type === 'equal' 
              ? equalWeight 
              : (weights?.[campaign_id] || equalWeight),
          }));

          const { error: variantsError } = await supabase
            .from('redirect_ab_test_variants')
            .insert(variantInserts);

          if (variantsError) throw variantsError;
        }
      }

      return abTest;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-tests'] });
      queryClient.invalidateQueries({ queryKey: ['ab-test'] });
      toast.success('Teste A/B atualizado com sucesso!');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar teste A/B:', error);
      toast.error('Erro ao atualizar teste A/B');
    },
  });
}

export function useDeleteABTest() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!profile?.tenant_id) throw new Error('Tenant não encontrado');

      const { error } = await supabase
        .from('redirect_ab_tests')
        .delete()
        .eq('id', id)
        .eq('tenant_id', profile.tenant_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-tests'] });
      toast.success('Teste A/B excluído com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao excluir teste A/B');
    },
  });
}

// Hook to declare winner manually
export function useDeclareWinner() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async ({ testId, variantId }: { testId: string; variantId: string }) => {
      if (!profile?.tenant_id) throw new Error('Tenant não encontrado');

      const { error } = await supabase
        .from('redirect_ab_tests')
        .update({
          winner_variant_id: variantId,
          status: 'completed',
          goal_reached: true,
        })
        .eq('id', testId)
        .eq('tenant_id', profile.tenant_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ab-tests'] });
      queryClient.invalidateQueries({ queryKey: ['ab-test'] });
      toast.success('Campeão declarado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao declarar campeão');
    },
  });
}
