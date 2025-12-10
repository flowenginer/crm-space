import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';

const STALE_TIME = 30000; // 30 seconds
const REFETCH_INTERVAL = 60000; // 1 minute

export interface DashboardFilters {
  dateFrom: Date;
  dateTo: Date;
  agentId?: string;
  departmentId?: string;
}

export interface AggregatedMetrics {
  totalConversations: number;
  totalAssigned: number;
  totalUnassigned: number;
  totalResponded: number;
  avgTimeToAssignment: number;
  avgTimeToFirstResponse: number;
  assignmentRate: number;
  responseRate: number;
  conversions: number;
  conversionRate: number;
}

export interface OriginDataPoint {
  origin: string;
  label: string;
  total: number;
  converted: number;
  conversionRate: number;
  color: string;
}

export interface StatusFunnelPoint {
  status: string;
  count: number;
  avgDuration: number;
  color: string;
  order: number;
}

const ORIGIN_CONFIG: Record<string, { label: string; color: string }> = {
  meta_ads: { label: 'Meta Ads', color: '#1877F2' },
  organic: { label: 'Orgânico', color: '#22C55E' },
  linktree: { label: 'Linktree', color: '#39E09B' },
  manual: { label: 'Manual', color: '#8B5CF6' },
  other: { label: 'Outros', color: '#6B7280' },
};

/**
 * Hook otimizado que busca todas as métricas do dashboard em uma única query
 * Reduz de 5-7 queries para 1 única chamada RPC
 */
export function useDashboardAggregated(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard_aggregated', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId],
    queryFn: async () => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      const { data, error } = await supabase.rpc('get_dashboard_metrics_aggregated', {
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_agent_id: filters.agentId || null,
        p_department_id: filters.departmentId || null,
      });

      if (error) {
        console.error('Error fetching aggregated dashboard metrics:', error);
        throw error;
      }

      const result = data as {
        metrics: {
          total_conversations: number;
          total_assigned: number;
          total_unassigned: number;
          total_responded: number;
          avg_time_to_assignment: number;
          avg_time_to_first_response: number;
          assignment_rate: number;
          response_rate: number;
          conversions: number;
          conversion_rate: number;
        };
        origin_data: Array<{
          origin: string;
          total: number;
          converted: number;
        }>;
        status_funnel: Array<{
          status_name: string;
          color: string;
          order_position: number;
          status_count: number;
          avg_duration: number;
        }>;
      };

      // Transform metrics
      const metrics: AggregatedMetrics = {
        totalConversations: result.metrics.total_conversations,
        totalAssigned: result.metrics.total_assigned,
        totalUnassigned: result.metrics.total_unassigned,
        totalResponded: result.metrics.total_responded,
        avgTimeToAssignment: result.metrics.avg_time_to_assignment,
        avgTimeToFirstResponse: result.metrics.avg_time_to_first_response,
        assignmentRate: result.metrics.assignment_rate,
        responseRate: result.metrics.response_rate,
        conversions: result.metrics.conversions,
        conversionRate: result.metrics.conversion_rate,
      };

      // Transform origin data
      const originData: OriginDataPoint[] = (result.origin_data || [])
        .map((row) => {
          const config = ORIGIN_CONFIG[row.origin] || ORIGIN_CONFIG.other;
          return {
            origin: row.origin,
            label: config.label,
            total: Number(row.total),
            converted: Number(row.converted),
            conversionRate: row.total > 0 ? (Number(row.converted) / Number(row.total)) * 100 : 0,
            color: config.color,
          };
        })
        .filter((r) => r.total > 0)
        .sort((a, b) => b.total - a.total);

      // Transform status funnel
      const statusFunnel: StatusFunnelPoint[] = (result.status_funnel || [])
        .map((row) => ({
          status: row.status_name,
          count: Number(row.status_count),
          avgDuration: Number(row.avg_duration),
          color: row.color || '#8B5CF6',
          order: row.order_position,
        }))
        .sort((a, b) => a.order - b.order);

      return {
        metrics,
        originData,
        statusFunnel,
      };
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

/**
 * Helper: Format time duration
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
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
