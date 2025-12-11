import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DistributionAgent {
  user_id: string;
  percentage: number;
  order_position: number;
  is_active: boolean;
  leads_received?: number;
}

export interface LeadDistributionConfig {
  lead_distribution_enabled: boolean;
  lead_distribution_type: 'sequential' | 'percentage';
  lead_distribution_department_id: string | null;
  lead_distribution_position: number;
  lead_distribution_agents: DistributionAgent[];
}

export function useLeadDistribution() {
  return useQuery({
    queryKey: ['lead_distribution_config'],
    queryFn: async (): Promise<LeadDistributionConfig> => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('lead_distribution_enabled, lead_distribution_type, lead_distribution_department_id, lead_distribution_position, lead_distribution_agents')
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No settings record exists, return defaults
          return {
            lead_distribution_enabled: false,
            lead_distribution_type: 'sequential',
            lead_distribution_department_id: null,
            lead_distribution_position: 0,
            lead_distribution_agents: [],
          };
        }
        throw error;
      }

      return {
        lead_distribution_enabled: data.lead_distribution_enabled ?? false,
        lead_distribution_type: (data.lead_distribution_type as 'sequential' | 'percentage') ?? 'sequential',
        lead_distribution_department_id: data.lead_distribution_department_id ?? null,
        lead_distribution_position: data.lead_distribution_position ?? 0,
        lead_distribution_agents: (data.lead_distribution_agents as unknown as DistributionAgent[]) ?? [],
      };
    },
    staleTime: 30000,
  });
}

export function useUpdateLeadDistribution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<LeadDistributionConfig>) => {
      // First, get the current settings ID
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .limit(1)
        .single();

      if (existing) {
        // Update existing record
        const { data, error } = await supabase
          .from('company_settings')
          .update(updates as any)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new record
        const { data, error } = await supabase
          .from('company_settings')
          .insert(updates as any)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_distribution_config'] });
      queryClient.invalidateQueries({ queryKey: ['company_settings'] });
    },
  });
}

export function useResetDistributionCounters() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id, lead_distribution_agents')
        .limit(1)
        .single();

      if (!existing) return;

      const agents = (existing.lead_distribution_agents as unknown as DistributionAgent[]) || [];
      const resetAgents = agents.map(a => ({ ...a, leads_received: 0 }));

      const { error } = await supabase
        .from('company_settings')
        .update({
          lead_distribution_agents: resetAgents,
          lead_distribution_position: 0,
        })
        .eq('id', existing.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead_distribution_config'] });
      toast.success('Contadores resetados com sucesso');
    },
    onError: () => {
      toast.error('Erro ao resetar contadores');
    },
  });
}

export function useDepartmentAgents(departmentId: string | null) {
  return useQuery({
    queryKey: ['department_agents', departmentId],
    queryFn: async () => {
      if (!departmentId) return [];

      const { data, error } = await supabase
        .from('user_departments')
        .select(`
          user_id,
          profiles:user_id (
            id,
            full_name,
            is_active,
            is_available,
            role,
            avatar_url
          )
        `)
        .eq('department_id', departmentId);

      if (error) throw error;

      return data
        .filter(d => {
          const profile = d.profiles as any;
          return profile && profile.is_active === true;
        })
        .map(d => {
          const profile = d.profiles as any;
          return {
            id: profile.id,
            full_name: profile.full_name,
            is_available: profile.is_available ?? true,
            role: profile.role,
            avatar_url: profile.avatar_url,
          };
        });
    },
    enabled: !!departmentId,
    staleTime: 30000,
  });
}
