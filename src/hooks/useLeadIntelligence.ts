import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadIntelligenceData {
  state: string;
  segment_id: string | null;
  segment_name: string;
  campaign: string;
  total_leads: number;
  converted_leads: number;
  total_revenue: number;
  total_shirts: number;
  avg_ticket: number;
  conversion_rate: number;
}

export interface StateIntelligence {
  state: string;
  total_leads: number;
  converted_leads: number;
  total_revenue: number;
  avg_ticket: number;
  conversion_rate: number;
}

export interface SegmentIntelligence {
  segment_id: string | null;
  segment_name: string;
  total_leads: number;
  converted_leads: number;
  total_revenue: number;
  avg_ticket: number;
  conversion_rate: number;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface IntelligenceFilters {
  dateRange?: DateRange;
  state?: string | null;
  segmentId?: string | null;
}

export function useLeadIntelligence(filters: IntelligenceFilters) {
  return useQuery({
    queryKey: ['lead_intelligence', filters.dateRange?.from?.toISOString(), filters.dateRange?.to?.toISOString(), filters.state, filters.segmentId],
    queryFn: async (): Promise<LeadIntelligenceData[]> => {
      const { data, error } = await supabase.rpc('get_lead_intelligence', {
        p_date_from: filters.dateRange?.from?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        p_date_to: filters.dateRange?.to?.toISOString() || new Date().toISOString(),
        p_state: filters.state || null,
        p_segment_id: filters.segmentId || null,
      });

      if (error) throw error;
      return (data || []) as LeadIntelligenceData[];
    },
    staleTime: 60000,
  });
}

export function useLeadIntelligenceByState(filters: IntelligenceFilters) {
  return useQuery({
    queryKey: ['lead_intelligence_by_state', filters.dateRange?.from?.toISOString(), filters.dateRange?.to?.toISOString()],
    queryFn: async (): Promise<StateIntelligence[]> => {
      const { data, error } = await supabase.rpc('get_lead_intelligence_by_state', {
        p_date_from: filters.dateRange?.from?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        p_date_to: filters.dateRange?.to?.toISOString() || new Date().toISOString(),
      });

      if (error) throw error;
      return (data || []) as StateIntelligence[];
    },
    staleTime: 60000,
  });
}

export function useLeadIntelligenceBySegment(filters: IntelligenceFilters) {
  return useQuery({
    queryKey: ['lead_intelligence_by_segment', filters.dateRange?.from?.toISOString(), filters.dateRange?.to?.toISOString(), filters.state],
    queryFn: async (): Promise<SegmentIntelligence[]> => {
      const { data, error } = await supabase.rpc('get_lead_intelligence_by_segment', {
        p_date_from: filters.dateRange?.from?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        p_date_to: filters.dateRange?.to?.toISOString() || new Date().toISOString(),
        p_state: filters.state || null,
      });

      if (error) throw error;
      return (data || []) as SegmentIntelligence[];
    },
    staleTime: 60000,
  });
}

// State name mapping
export const STATE_NAMES: Record<string, string> = {
  'AC': 'Acre',
  'AL': 'Alagoas',
  'AP': 'Amapá',
  'AM': 'Amazonas',
  'BA': 'Bahia',
  'CE': 'Ceará',
  'DF': 'Distrito Federal',
  'ES': 'Espírito Santo',
  'GO': 'Goiás',
  'MA': 'Maranhão',
  'MT': 'Mato Grosso',
  'MS': 'Mato Grosso do Sul',
  'MG': 'Minas Gerais',
  'PA': 'Pará',
  'PB': 'Paraíba',
  'PR': 'Paraná',
  'PE': 'Pernambuco',
  'PI': 'Piauí',
  'RJ': 'Rio de Janeiro',
  'RN': 'Rio Grande do Norte',
  'RS': 'Rio Grande do Sul',
  'RO': 'Rondônia',
  'RR': 'Roraima',
  'SC': 'Santa Catarina',
  'SP': 'São Paulo',
  'SE': 'Sergipe',
  'TO': 'Tocantins',
  'Outro': 'Outros',
};
