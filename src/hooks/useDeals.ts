import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Pipeline {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean | null;
  created_at: string;
}

export interface PipelineStage {
  id: string;
  pipeline_id: string;
  name: string;
  color: string | null;
  order_position: number;
  created_at: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number | null;
  pipeline_id: string;
  stage_id: string;
  contact_id: string | null;
  assigned_to: string | null;
  status: string | null;
  description: string | null;
  expected_close_date: string | null;
  closed_at: string | null;
  last_activity_at: string | null;
  order_position: number | null;
  created_at: string;
  updated_at: string;
  contact?: { id: string; full_name: string; phone: string } | null;
  assignee?: { id: string; full_name: string | null } | null;
}

// Helper to check if user can view all data (admin/supervisor)
async function canViewAllData(): Promise<{ canViewAll: boolean; userId: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { canViewAll: false, userId: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const canViewAll = profile?.role === 'admin' || profile?.role === 'supervisor';
  return { canViewAll, userId: user.id };
}

export function usePipelines() {
  return useQuery({
    queryKey: ['pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Pipeline[];
    },
  });
}

export function usePipelineStages(pipelineId: string | null) {
  return useQuery({
    queryKey: ['pipeline_stages', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];
      
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('*')
        .eq('pipeline_id', pipelineId)
        .order('order_position');

      if (error) throw error;
      return data as PipelineStage[];
    },
    enabled: !!pipelineId,
  });
}

export function useDeals(pipelineId: string | null) {
  return useQuery({
    queryKey: ['deals', pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];
      
      // Check user permissions
      const { canViewAll, userId } = await canViewAllData();

      let query = supabase
        .from('deals')
        .select(`
          *,
          contact:contacts(id, full_name, phone),
          assignee:profiles!deals_assigned_to_fkey(id, full_name)
        `)
        .eq('pipeline_id', pipelineId)
        .neq('status', 'archived')
        .order('order_position');

      // Filter by assigned_to for non-admin users
      if (!canViewAll && userId) {
        query = query.eq('assigned_to', userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Deal[];
    },
    enabled: !!pipelineId,
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deal: {
      title: string;
      pipeline_id: string;
      stage_id: string;
      value?: number | null;
      contact_id?: string | null;
      assigned_to?: string | null;
      description?: string | null;
      expected_close_date?: string | null;
    }) => {
      // CORREÇÃO: Obter tenant_id do usuário
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');

      const { data, error } = await supabase
        .from('deals')
        .insert({
          title: deal.title,
          pipeline_id: deal.pipeline_id,
          stage_id: deal.stage_id,
          value: deal.value,
          contact_id: deal.contact_id,
          assigned_to: deal.assigned_to,
          description: deal.description,
          expected_close_date: deal.expected_close_date,
          status: 'open',
          tenant_id: tenantId, // CORREÇÃO: Adicionar tenant_id
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deals', data.pipeline_id] });
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...deal }: Partial<Deal> & { id: string }) => {
      const { error, data } = await supabase
        .from('deals')
        .update({
          ...deal,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deals', data.pipeline_id] });
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, pipelineId }: { id: string; pipelineId: string }) => {
      const { error } = await supabase
        .from('deals')
        .update({ status: 'archived' })
        .eq('id', id);

      if (error) throw error;
      return pipelineId;
    },
    onSuccess: (pipelineId) => {
      queryClient.invalidateQueries({ queryKey: ['deals', pipelineId] });
    },
  });
}

export function useCreatePipeline() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pipeline: { name: string; description?: string | null }) => {
      // CORREÇÃO: Obter tenant_id do usuário
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');

      const { data, error } = await supabase
        .from('pipelines')
        .insert({
          name: pipeline.name,
          description: pipeline.description,
          is_active: true,
          tenant_id: tenantId, // CORREÇÃO: Adicionar tenant_id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipelines'] });
    },
  });
}

export function useCreatePipelineStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stage: {
      pipeline_id: string;
      name: string;
      color?: string | null;
      order_position: number;
    }) => {
      // CORREÇÃO: Obter tenant_id do usuário
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');

      const { data, error } = await supabase
        .from('pipeline_stages')
        .insert({
          ...stage,
          tenant_id: tenantId, // CORREÇÃO: Adicionar tenant_id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pipeline_stages', data.pipeline_id] });
    },
  });
}
