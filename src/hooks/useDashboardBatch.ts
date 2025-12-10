import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';
import { useConversionStatusNames } from './useConversionStatusNames';

const STALE_TIME = 30000; // 30 seconds
const REFETCH_INTERVAL = 60000; // 1 minute

export interface DashboardFilters {
  dateFrom: Date;
  dateTo: Date;
  agentId?: string;
  departmentId?: string;
}

// =====================================================
// FASE 5.1 - useLeadsByStatusBatch (elimina N+1)
// =====================================================

export interface LeadStatusCount {
  statusId: string;
  status: string;
  count: number;
  color: string;
  order: number;
}

export function useLeadsByStatusBatch(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['leads_by_status_batch', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId],
    queryFn: async (): Promise<LeadStatusCount[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      const { data, error } = await supabase.rpc('get_leads_by_status_batch', {
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_agent_id: filters.agentId || null,
        p_department_id: filters.departmentId || null,
      });

      if (error) {
        console.error('Error fetching leads by status batch:', error);
        return [];
      }

      return (data || [])
        .map((row: any) => ({
          statusId: row.status_id,
          status: row.status_name,
          count: Number(row.count) || 0,
          color: row.status_color || '#8B5CF6',
          order: row.order_position,
        }))
        .filter((r: LeadStatusCount) => r.count > 0)
        .sort((a: LeadStatusCount, b: LeadStatusCount) => a.order - b.order);
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

// =====================================================
// FASE 5.2 - useTimelineDataBatch (elimina N+1)
// =====================================================

export interface TimelineData {
  date: string;
  newLeads: number;
  conversions: number;
}

export function useTimelineDataBatch(filters: DashboardFilters) {
  const { data: conversionStatusNames = [] } = useConversionStatusNames();

  return useQuery({
    queryKey: ['timeline_data_batch', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId, conversionStatusNames],
    queryFn: async (): Promise<TimelineData[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      const { data, error } = await supabase.rpc('get_timeline_data_batch', {
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_agent_id: filters.agentId || null,
        p_department_id: filters.departmentId || null,
        p_conversion_status_names: conversionStatusNames,
      });

      if (error) {
        console.error('Error fetching timeline data batch:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        date: row.date,
        newLeads: Number(row.new_leads) || 0,
        conversions: Number(row.conversions) || 0,
      }));
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
    enabled: conversionStatusNames.length > 0,
  });
}

// =====================================================
// FASE 5.3 - useFunnelDataBatch (elimina N+1)
// =====================================================

export interface FunnelData {
  stage: string;
  count: number;
  avgDuration: number;
  color: string;
  order: number;
}

export function useFunnelDataBatch(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['funnel_data_batch', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId],
    queryFn: async (): Promise<FunnelData[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      const { data, error } = await supabase.rpc('get_funnel_data_batch', {
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_agent_id: filters.agentId || null,
        p_department_id: filters.departmentId || null,
      });

      if (error) {
        console.error('Error fetching funnel data batch:', error);
        return [];
      }

      return (data || [])
        .map((row: any) => ({
          stage: row.stage_name,
          count: Number(row.count) || 0,
          avgDuration: Number(row.avg_duration_seconds) || 0,
          color: row.stage_color || '#8B5CF6',
          order: row.order_position,
        }))
        .sort((a: FunnelData, b: FunnelData) => a.order - b.order);
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

// =====================================================
// Helper: Format time duration
// =====================================================

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}
