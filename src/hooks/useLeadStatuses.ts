import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadStatus {
  id: string;
  name: string;
  color: string | null;
  order_position: number;
  is_active: boolean | null;
}

export function useLeadStatuses() {
  return useQuery({
    queryKey: ['lead_statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .eq('is_active', true)
        .order('order_position', { ascending: true });

      if (error) throw error;
      return data as LeadStatus[];
    },
    staleTime: 300000, // 5 minutes - statuses don't change often
  });
}
