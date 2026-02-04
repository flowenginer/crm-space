import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BusinessHours, DEFAULT_BUSINESS_HOURS } from '@/lib/schedule-utils';

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
  business_hours: BusinessHours | null;
  sla_first_response_minutes: number | null;
  sla_resolution_minutes: number | null;
  max_conversations_per_agent: number | null;
  owner_agent_enabled: boolean | null;
  owner_agent_inactivity_days: number | null;
  owner_agent_on_reopen: boolean | null;
  owner_agent_reopen_reasons: string[] | null;
  gamification_source: 'crm' | 'erp' | null;
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
            business_hours: DEFAULT_BUSINESS_HOURS,
            sla_first_response_minutes: 5,
            sla_resolution_minutes: 60,
            max_conversations_per_agent: 15,
            owner_agent_enabled: true,
            owner_agent_inactivity_days: 7,
            owner_agent_on_reopen: true,
            owner_agent_reopen_reasons: ['sold', 'no_interest', 'future_contact'],
            gamification_source: 'crm',
          } as CompanySettings;
        }
        throw error;
      }

      // Handle conversion_status_ids and gamification_source which might be null
      return {
        ...data,
        conversion_status_ids: data.conversion_status_ids || ['78f16fc9-39f5-47ff-9774-00a0af9fa7da'],
        business_hours: (data.business_hours as unknown as BusinessHours) || DEFAULT_BUSINESS_HOURS,
        gamification_source: data.gamification_source || 'crm',
      } as CompanySettings;
    },
    staleTime: 60000, // 1 minute
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<CompanySettings>) => {
      // CORREÇÃO: Obter tenant_id do usuário
      const { data: tenantId } = await supabase.rpc('get_user_tenant_id');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbUpdates: any = { ...updates };

      // First, get the current settings ID for this tenant
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .eq('tenant_id', tenantId)
        .limit(1)
        .single();

      if (existing) {
        // Update existing record
        const { data, error } = await supabase
          .from('company_settings')
          .update(dbUpdates)
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new record with tenant_id
        const { data, error } = await supabase
          .from('company_settings')
          .insert({
            ...dbUpdates,
            tenant_id: tenantId, // CORREÇÃO: Adicionar tenant_id
          })
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
