import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';
import { useConversionStatusNames } from './useConversionStatusNames';
import { useEffect } from 'react';

const STALE_TIME = 30000; // 30 seconds
const REALTIME_REFETCH_INTERVAL = 30000; // 30 seconds for realtime

export interface DashboardFilters {
  dateFrom: Date;
  dateTo: Date;
  agentId?: string;
  departmentId?: string;
  channelId?: string;
}

// =====================================================
// Realtime Hook Helper
// =====================================================

function useDashboardRealtime(queryKey: unknown[], deps: unknown[] = []) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`dashboard-realtime-${JSON.stringify(queryKey).slice(0, 50)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, ...deps]);
}

// =====================================================
// 2.1 - useLeadsByOrigin (usando RPC)
// =====================================================

export interface LeadOriginData {
  origin: string;
  label: string;
  total: number;
  converted: number;
  conversionRate: number;
  color: string;
}

const ORIGIN_CONFIG: Record<string, { label: string; color: string }> = {
  meta_ads: { label: 'Meta Ads', color: '#1877F2' },
  linktree: { label: 'Orgânico Linktree', color: '#39E09B' },
  site: { label: 'Orgânico Site', color: '#F59E0B' },
  referral: { label: 'Indicação', color: '#EC4899' },
  manual: { label: 'Manual', color: '#8B5CF6' },
  organic_unknown: { label: 'Orgânico Outros', color: '#6B7280' },
  other: { label: 'Outros', color: '#94A3B8' },
};

export { ORIGIN_CONFIG };

export function useLeadsByOrigin(filters: DashboardFilters) {
  const { data: conversionStatusNames = [] } = useConversionStatusNames();
  const queryKey = ['leads_by_origin_rpc', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId, conversionStatusNames];

  // Realtime subscription
  useDashboardRealtime(queryKey, [filters.dateFrom?.toISOString(), filters.dateTo?.toISOString(), filters.agentId, filters.departmentId]);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<LeadOriginData[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      const { data, error } = await supabase.rpc('get_leads_by_origin', {
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_agent_id: filters.agentId || null,
        p_department_id: filters.departmentId || null,
        p_conversion_status_names: conversionStatusNames,
      });

      if (error) {
        console.error('Error fetching leads by origin:', error);
        return [];
      }

      return (data || [])
        .map((row: { origin: string; total: number; converted: number }) => {
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
        .filter((r: LeadOriginData) => r.total > 0)
        .sort((a: LeadOriginData, b: LeadOriginData) => b.total - a.total);
    },
    staleTime: STALE_TIME,
  });
}

// =====================================================
// 2.2 - useLeadJourneyMetrics (usando RPC)
// =====================================================

export interface LeadJourneyMetrics {
  avgTimeToAssignment: number;
  avgTimeToFirstResponse: number;
  avgTimeToConversion: number;
  totalAssigned: number;
  totalUnassigned: number;
  assignmentRate: number;
  leadResponseRate: number;
  conversions: number;
  conversionRate: number;
}

export function useLeadJourneyMetrics(filters: DashboardFilters, origin?: string) {
  const { data: conversionStatusNames = [] } = useConversionStatusNames();
  const queryKey = ['lead_journey_metrics_rpc', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId, conversionStatusNames, origin];

  // Realtime subscription
  useDashboardRealtime(queryKey, [filters.dateFrom?.toISOString(), filters.dateTo?.toISOString(), filters.agentId, filters.departmentId, origin]);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<LeadJourneyMetrics> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      const { data, error } = await supabase.rpc('get_lead_journey_metrics', {
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_agent_id: filters.agentId || null,
        p_department_id: filters.departmentId || null,
        p_conversion_status_names: conversionStatusNames,
        p_origin: origin || null,
      });

      if (error) {
        console.error('Error fetching lead journey metrics:', error);
        return {
          avgTimeToAssignment: 0,
          avgTimeToFirstResponse: 0,
          avgTimeToConversion: 0,
          totalAssigned: 0,
          totalUnassigned: 0,
          assignmentRate: 0,
          leadResponseRate: 0,
          conversions: 0,
          conversionRate: 0,
        };
      }

      const row = data?.[0] as {
        avg_time_to_assignment?: number;
        avg_time_to_first_response?: number;
        total_assigned?: number;
        total_unassigned?: number;
        assignment_rate?: number;
        lead_response_rate?: number;
        conversions?: number;
        conversion_rate?: number;
      } | undefined;
      
      return {
        avgTimeToAssignment: Number(row?.avg_time_to_assignment) || 0,
        avgTimeToFirstResponse: Number(row?.avg_time_to_first_response) || 0,
        avgTimeToConversion: 0, // Would require more complex calculation
        totalAssigned: Number(row?.total_assigned) || 0,
        totalUnassigned: Number(row?.total_unassigned) || 0,
        assignmentRate: Number(row?.assignment_rate) || 0,
        leadResponseRate: Number(row?.lead_response_rate) || 0,
        conversions: Number(row?.conversions) || 0,
        conversionRate: Number(row?.conversion_rate) || 0,
      };
    },
    staleTime: STALE_TIME,
  });
}

// =====================================================
// 2.3 - useAgentDistributionAdvanced (usando RPC)
// =====================================================

export interface AgentDistribution {
  id: string;
  name: string;
  avatar?: string;
  leadsReceived: number;
  leadsResponded: number;
  conversions: number;
  conversionRate: number;
  avgResponseTime: number;
  byOrigin: {
    meta_ads: number;
    organic: number;
    other: number;
  };
}

export function useAgentDistributionAdvanced(filters: DashboardFilters) {
  const { data: conversionStatusNames = [] } = useConversionStatusNames();
  const queryKey = ['agent_distribution_advanced_rpc', filters.dateFrom, filters.dateTo, filters.departmentId, conversionStatusNames];

  // Realtime subscription
  useDashboardRealtime(queryKey, [filters.dateFrom?.toISOString(), filters.dateTo?.toISOString(), filters.departmentId]);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<AgentDistribution[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      const { data, error } = await supabase.rpc('get_agent_distribution_advanced', {
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_department_id: filters.departmentId || null,
        p_conversion_status_names: conversionStatusNames,
      });

      if (error) {
        console.error('Error fetching agent distribution:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.agent_id,
        name: row.agent_name || 'Sem nome',
        avatar: row.avatar_url || undefined,
        leadsReceived: Number(row.leads_received) || 0,
        leadsResponded: Number(row.leads_responded) || 0,
        conversions: Number(row.conversions) || 0,
        conversionRate: Number(row.conversion_rate) || 0,
        avgResponseTime: Number(row.avg_response_time) || 0,
        byOrigin: {
          meta_ads: Number(row.meta_ads_count) || 0,
          organic: Number(row.organic_count) || 0,
          other: Number(row.other_count) || 0,
        },
      }));
    },
    staleTime: STALE_TIME,
  });
}

// =====================================================
// 2.4 - useStatusFunnel (usando RPC)
// =====================================================

export interface StatusFunnelData {
  status: string;
  count: number;
  avgDuration: number;
  color: string;
  order: number;
}

export function useStatusFunnel(filters: DashboardFilters) {
  const queryKey = ['status_funnel_rpc', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId];

  // Realtime subscription
  useDashboardRealtime(queryKey, [filters.dateFrom?.toISOString(), filters.dateTo?.toISOString(), filters.agentId, filters.departmentId]);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<StatusFunnelData[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      const { data, error } = await supabase.rpc('get_status_funnel', {
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_agent_id: filters.agentId || null,
        p_department_id: filters.departmentId || null,
        p_origin: null,
      });

      if (error) {
        console.error('Error fetching status funnel:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        status: row.status,
        count: Number(row.count) || 0,
        avgDuration: Number(row.avg_duration_seconds) || 0,
        color: row.color || '#8B5CF6',
        order: row.status_order,
      }));
    },
    staleTime: STALE_TIME,
  });
}

// =====================================================
// 2.4b - useStatusFunnelRealtime (snapshot atual com Realtime updates)
// =====================================================

export function useStatusFunnelRealtime(agentId?: string, departmentId?: string) {
  const queryClient = useQueryClient();
  const queryKey = ['status_funnel_realtime_rpc', agentId, departmentId];

  // Realtime subscription para atualizar quando um contato mudar de status
  useEffect(() => {
    const channel = supabase
      .channel('contacts-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contacts',
        },
        (payload) => {
          // Se o lead_status mudou, invalida a query
          if (payload.old && payload.new && payload.old.lead_status !== payload.new.lead_status) {
            queryClient.invalidateQueries({ queryKey });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contacts',
        },
        () => {
          // Novo contato criado, invalida a query
          queryClient.invalidateQueries({ queryKey });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, agentId, departmentId]);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<StatusFunnelData[]> => {
      const { data, error } = await supabase.rpc('get_status_funnel_realtime', {
        p_agent_id: agentId || null,
        p_department_id: departmentId || null,
      });

      if (error) {
        console.error('Error fetching realtime status funnel:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        status: row.status_name,
        count: Number(row.lead_count) || 0,
        avgDuration: Number(row.avg_duration_seconds) || 0,
        color: row.status_color || '#8B5CF6',
        order: row.status_order,
      }));
    },
    staleTime: REALTIME_REFETCH_INTERVAL,
    refetchInterval: REALTIME_REFETCH_INTERVAL,
  });
}

// =====================================================
// 2.5 - useLeadAlerts (usando RPC)
// =====================================================

export interface LeadAlert {
  id: string;
  type: 'unassigned' | 'no_response' | 'stalled' | 'sla_critical';
  contactId: string;
  contactName: string;
  contactPhone: string;
  conversationId: string;
  waitingMinutes: number;
  status?: string;
  agentName?: string;
  severity: 'warning' | 'critical';
}

export function useLeadAlerts(filters: DashboardFilters) {
  const queryKey = ['lead_alerts_rpc', filters.agentId, filters.departmentId];

  // Realtime subscription
  useDashboardRealtime(queryKey, [filters.agentId, filters.departmentId]);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<LeadAlert[]> => {
      const { data, error } = await supabase.rpc('get_lead_alerts', {
        p_agent_id: filters.agentId || null,
        p_department_id: filters.departmentId || null,
        p_limit: 20,
      });

      if (error) {
        console.error('Error fetching lead alerts:', error);
        return [];
      }

      return (data || []).map((row: any) => {
        const waitingMinutes = Number(row.waiting_minutes) || 0;
        let severity: 'warning' | 'critical' = 'warning';
        
        if (row.alert_type === 'sla_critical') {
          severity = 'critical';
        } else if (row.alert_type === 'unassigned' && waitingMinutes >= 30) {
          severity = 'critical';
        } else if (row.alert_type === 'no_response' && waitingMinutes >= 120) {
          severity = 'critical';
        } else if (row.alert_type === 'stalled') {
          severity = waitingMinutes >= 2880 ? 'critical' : 'warning'; // 48h+
        }

        return {
          id: `${row.alert_type}-${row.conversation_id}`,
          type: row.alert_type as LeadAlert['type'],
          contactId: row.contact_id,
          contactName: row.contact_name,
          contactPhone: row.contact_phone,
          conversationId: row.conversation_id,
          waitingMinutes,
          status: row.lead_status,
          severity,
        };
      }).sort((a: LeadAlert, b: LeadAlert) => {
        if (a.severity !== b.severity) {
          return a.severity === 'critical' ? -1 : 1;
        }
        return b.waitingMinutes - a.waitingMinutes;
      });
    },
    staleTime: 30000,
  });
}

// =====================================================
// 2.6 - useOriginTimeline (usando RPC)
// =====================================================

export interface OriginTimelineData {
  date: string;
  meta_ads: number;
  organic: number;
  other: number;
}

export function useOriginTimeline(filters: DashboardFilters) {
  const queryKey = ['origin_timeline_rpc', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId];

  // Realtime subscription
  useDashboardRealtime(queryKey, [filters.dateFrom?.toISOString(), filters.dateTo?.toISOString(), filters.agentId, filters.departmentId]);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<OriginTimelineData[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      const { data, error } = await supabase.rpc('get_origin_timeline', {
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_agent_id: filters.agentId || null,
        p_department_id: filters.departmentId || null,
      });

      if (error) {
        console.error('Error fetching origin timeline:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        date: row.date_day,
        meta_ads: Number(row.meta_ads_count) || 0,
        organic: Number(row.organic_count) || 0,
        other: Number(row.other_count) || 0,
      }));
    },
    staleTime: STALE_TIME,
  });
}

// =====================================================
// 2.7 - useConversionTimeline (usando RPC)
// =====================================================

export interface ConversionTimelineData {
  date: string;
  newLeads: number;
  conversions: number;
}

export function useConversionTimeline(filters: DashboardFilters) {
  const { data: conversionStatusNames = [] } = useConversionStatusNames();
  const queryKey = ['conversion_timeline_rpc', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId, conversionStatusNames];

  // Realtime subscription
  useDashboardRealtime(queryKey, [filters.dateFrom?.toISOString(), filters.dateTo?.toISOString(), filters.agentId, filters.departmentId]);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<ConversionTimelineData[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      const { data, error } = await supabase.rpc('get_conversion_timeline', {
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_agent_id: filters.agentId || null,
        p_department_id: filters.departmentId || null,
        p_conversion_status_names: conversionStatusNames,
      });

      if (error) {
        console.error('Error fetching conversion timeline:', error);
        return [];
      }

      return (data || []).map((row: any) => ({
        date: row.date_day,
        newLeads: Number(row.new_leads) || 0,
        conversions: Number(row.conversions) || 0,
      }));
    },
    staleTime: STALE_TIME,
  });
}

// =====================================================
// 2.8 - useReturningLeadsMetrics (usando RPC)
// =====================================================

export interface ReturningLeadsMetrics {
  totalConversations: number;
  newContacts: number;
  returningContacts: number;
  newContactRate: number;
}

export function useReturningLeadsMetrics(filters: DashboardFilters, origin?: string) {
  const queryKey = ['returning_leads_metrics_rpc', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId, filters.channelId, origin];

  // Realtime subscription
  useDashboardRealtime(queryKey, [filters.dateFrom?.toISOString(), filters.dateTo?.toISOString(), filters.agentId, filters.departmentId, origin]);

  return useQuery({
    queryKey,
    queryFn: async (): Promise<ReturningLeadsMetrics> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      const { data, error } = await supabase.rpc('get_returning_leads_metrics', {
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_agent_id: filters.agentId || null,
        p_department_id: filters.departmentId || null,
        p_channel_id: filters.channelId || null,
        p_origin: origin || null,
      });

      if (error) {
        console.error('Error fetching returning leads metrics:', error);
        return {
          totalConversations: 0,
          newContacts: 0,
          returningContacts: 0,
          newContactRate: 0,
        };
      }

      const row = data?.[0] as {
        total_conversations?: number;
        new_contacts?: number;
        returning_contacts?: number;
        new_contact_rate?: number;
      } | undefined;

      return {
        totalConversations: Number(row?.total_conversations) || 0,
        newContacts: Number(row?.new_contacts) || 0,
        returningContacts: Number(row?.returning_contacts) || 0,
        newContactRate: Number(row?.new_contact_rate) || 0,
      };
    },
    staleTime: STALE_TIME,
  });
}

// =====================================================
// Helper: Format time duration
// =====================================================

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
