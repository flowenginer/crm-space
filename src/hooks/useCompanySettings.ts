import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CompanySettings {
  id: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  cnpj: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  logo_url: string | null;
  conversion_status_ids: string[];
  timezone: string | null;
  sla_first_response_minutes: number | null;
  sla_resolution_minutes: number | null;
  max_conversations_per_agent: number | null;
  owner_agent_enabled: boolean | null;
  owner_agent_inactivity_days: number | null;
  owner_agent_on_reopen: boolean | null;
  owner_agent_reopen_reasons: string[] | null;
}

export function useCompanySettings() {
  return useQuery({
    queryKey: ['company_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        // If no record exists, return default values
        if (error.code === 'PGRST116') {
          return {
            id: '',
            company_name: null,
            conversion_status_ids: ['78f16fc9-39f5-47ff-9774-00a0af9fa7da'], // Default: "07 - Pedido Fechado"
            timezone: 'America/Sao_Paulo',
            sla_first_response_minutes: 5,
            sla_resolution_minutes: 60,
            max_conversations_per_agent: 15,
            owner_agent_enabled: true,
            owner_agent_inactivity_days: 7,
            owner_agent_on_reopen: true,
            owner_agent_reopen_reasons: ['sold', 'no_interest', 'future_contact'],
          } as CompanySettings;
        }
        throw error;
      }

      // Handle conversion_status_ids which might be null
      return {
        ...data,
        conversion_status_ids: data.conversion_status_ids || ['78f16fc9-39f5-47ff-9774-00a0af9fa7da'],
      } as CompanySettings;
    },
    staleTime: 60000, // 1 minute
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<CompanySettings>) => {
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
          .update(updates)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new record
        const { data, error } = await supabase
          .from('company_settings')
          .insert(updates)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company_settings'] });
    },
  });
}

// Helper hook to get just the conversion status IDs (used by dashboard)
export function useConversionStatusIds() {
  const { data: settings, isLoading } = useCompanySettings();
  
  return {
    conversionStatusIds: settings?.conversion_status_ids || ['78f16fc9-39f5-47ff-9774-00a0af9fa7da'],
    isLoading,
  };
}
