import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';

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
  // Normaliza as datas para início e fim do dia
  const normalizedDateFrom = startOfDay(dateFrom);
  const normalizedDateTo = endOfDay(dateTo);
  
  return useQuery({
    queryKey: ['leads-distribution-by-agent', normalizedDateFrom.toISOString(), normalizedDateTo.toISOString(), origin],
    queryFn: async () => {
      console.log('Fetching leads distribution:', {
        dateFrom: normalizedDateFrom.toISOString(),
        dateTo: normalizedDateTo.toISOString(),
        origin
      });
      
      const { data, error } = await supabase.rpc('get_leads_distribution_by_agent', {
        p_date_from: normalizedDateFrom.toISOString(),
        p_date_to: normalizedDateTo.toISOString(),
        p_origin: origin || null
      });

      if (error) {
        console.error('Error fetching leads distribution by agent:', error);
        throw error;
      }

      console.log('Leads distribution result:', data);
      return (data || []) as AgentLeadDistribution[];
    },
    enabled: enabled && !!origin
  });
}
