import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AgentLeadDistribution {
  agent_id: string;
  agent_name: string;
  agent_avatar: string | null;
  lead_count: number;
  converted_count: number;
  conversion_rate: number;
}

interface UseLeadsDistributionParams {
  dateFrom: Date;
  dateTo: Date;
  origin?: string | null;
  enabled?: boolean;
}

export function useLeadsDistributionByAgent({ 
  dateFrom, 
  dateTo, 
  origin, 
  enabled = true 
}: UseLeadsDistributionParams) {
  return useQuery({
    queryKey: ['leads-distribution-by-agent', dateFrom.toISOString(), dateTo.toISOString(), origin],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_leads_distribution_by_agent', {
        p_date_from: dateFrom.toISOString(),
        p_date_to: dateTo.toISOString(),
        p_origin: origin || null
      });

      if (error) {
        console.error('Error fetching leads distribution by agent:', error);
        throw error;
      }

      return (data || []) as AgentLeadDistribution[];
    },
    enabled: enabled && !!dateFrom && !!dateTo
  });
}
