import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay } from 'date-fns';
import { useConversionStatusIds } from './useCompanySettings';

const STALE_TIME = 30000; // 30 seconds
const REFETCH_INTERVAL = 60000; // 1 minute

export interface DashboardFilters {
  dateFrom: Date;
  dateTo: Date;
  agentId?: string;
  departmentId?: string;
  channelId?: string;
}

// =====================================================
// 2.1 - useLeadsByOrigin
// Leads agrupados por origem (meta_ads, organic, linktree, etc)
// =====================================================

export interface LeadOriginData {
  origin: string;
  label: string;
  total: number;
  converted: number;
  conversionRate: number;
  color: string;
}

export function useLeadsByOrigin(filters: DashboardFilters) {
  const { conversionStatusIds } = useConversionStatusIds();

  return useQuery({
    queryKey: ['leads_by_origin', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId, conversionStatusIds],
    queryFn: async (): Promise<LeadOriginData[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Get conversion status names
      const { data: conversionStatuses } = await supabase
        .from('lead_statuses')
        .select('name')
        .in('id', conversionStatusIds);
      
      const conversionStatusNames = conversionStatuses?.map(s => s.name) || [];

      // Define origins to track
      const origins = [
        { key: 'meta_ads', label: 'Meta Ads', color: '#1877F2' },
        { key: 'organic', label: 'Orgânico', color: '#22C55E' },
        { key: 'linktree', label: 'Linktree', color: '#39E09B' },
        { key: 'manual', label: 'Manual', color: '#8B5CF6' },
        { key: 'other', label: 'Outros', color: '#6B7280' },
      ];

      // Get counts for each origin
      const results = await Promise.all(
        origins.map(async (origin) => {
          // Build query for this origin
          let totalQuery = supabase
            .from('conversations')
            .select('id, contact_id', { count: 'exact' })
            .gte('created_at', dateFrom)
            .lte('created_at', dateTo);

          // Apply origin filter
          if (origin.key === 'meta_ads') {
            totalQuery = totalQuery.eq('referral_source', 'meta_ads');
          } else if (origin.key === 'organic') {
            totalQuery = totalQuery.or('referral_source.is.null,referral_source.eq.organic');
          } else if (origin.key === 'linktree') {
            totalQuery = totalQuery.eq('referral_source', 'linktree');
          } else if (origin.key === 'manual') {
            totalQuery = totalQuery.eq('referral_source', 'manual');
          } else {
            // Other - everything else
            totalQuery = totalQuery.not('referral_source', 'in', '(meta_ads,organic,linktree,manual)');
          }

          // Apply filters
          if (filters.agentId) {
            totalQuery = totalQuery.eq('assigned_to', filters.agentId);
          }
          if (filters.departmentId) {
            totalQuery = totalQuery.eq('department_id', filters.departmentId);
          }

          const { count: total, data: conversations } = await totalQuery;

          // Get converted count - contacts that reached conversion status
          let converted = 0;
          if (conversations && conversations.length > 0 && conversionStatusNames.length > 0) {
            const contactIds = [...new Set(conversations.map(c => c.contact_id))];
            
            // Check how many of these contacts have conversion status in history
            const { data: convertedContacts } = await supabase
              .from('lead_status_history')
              .select('contact_id')
              .in('contact_id', contactIds)
              .in('new_status', conversionStatusNames);

            converted = new Set(convertedContacts?.map(c => c.contact_id) || []).size;
          }

          const conversionRate = total && total > 0 ? (converted / total) * 100 : 0;

          return {
            origin: origin.key,
            label: origin.label,
            total: total || 0,
            converted,
            conversionRate,
            color: origin.color,
          };
        })
      );

      // Filter out origins with 0 leads and sort by total
      return results
        .filter(r => r.total > 0)
        .sort((a, b) => b.total - a.total);
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

// =====================================================
// 2.2 - useLeadJourneyMetrics
// Métricas da jornada do lead
// =====================================================

export interface LeadJourneyMetrics {
  avgTimeToAssignment: number; // seconds
  avgTimeToFirstResponse: number; // seconds
  avgTimeToConversion: number; // seconds
  totalAssigned: number;
  totalUnassigned: number;
  assignmentRate: number;
  leadResponseRate: number; // % leads que responderam após contato
  conversions: number;
  conversionRate: number;
}

export function useLeadJourneyMetrics(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['lead_journey_metrics', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId],
    queryFn: async (): Promise<LeadJourneyMetrics> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Get assignment history data
      let assignmentQuery = supabase
        .from('lead_assignment_history')
        .select('*')
        .gte('assigned_at', dateFrom)
        .lte('assigned_at', dateTo)
        .eq('assignment_type', 'first_assignment');

      if (filters.agentId) {
        assignmentQuery = assignmentQuery.eq('assigned_to', filters.agentId);
      }

      const { data: assignments } = await assignmentQuery;

      // Calculate average time to assignment
      const validAssignments = assignments?.filter(a => a.time_to_assign_seconds) || [];
      const avgTimeToAssignment = validAssignments.length > 0
        ? validAssignments.reduce((sum, a) => sum + (a.time_to_assign_seconds || 0), 0) / validAssignments.length
        : 0;

      // Get conversations for first response time
      let convQuery = supabase
        .from('conversations')
        .select('id, created_at, first_response_at, assigned_to')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      if (filters.agentId) {
        convQuery = convQuery.eq('assigned_to', filters.agentId);
      }
      if (filters.departmentId) {
        convQuery = convQuery.eq('department_id', filters.departmentId);
      }

      const { data: conversations } = await convQuery;

      // Calculate average first response time
      const withResponse = conversations?.filter(c => c.first_response_at) || [];
      const avgTimeToFirstResponse = withResponse.length > 0
        ? withResponse.reduce((sum, c) => {
            const created = new Date(c.created_at).getTime();
            const response = new Date(c.first_response_at!).getTime();
            return sum + (response - created) / 1000;
          }, 0) / withResponse.length
        : 0;

      // Calculate assignment rate
      const totalAssigned = conversations?.filter(c => c.assigned_to).length || 0;
      const totalUnassigned = (conversations?.length || 0) - totalAssigned;
      const assignmentRate = conversations?.length 
        ? (totalAssigned / conversations.length) * 100 
        : 0;

      // Calculate lead response rate (leads that responded after our first message)
      let leadResponseRate = 0;
      if (conversations && conversations.length > 0) {
        const { data: respondedLeads } = await supabase
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', conversations.map(c => c.id))
          .eq('is_from_me', false);

        const uniqueResponded = new Set(respondedLeads?.map(m => m.conversation_id) || []);
        leadResponseRate = conversations.length > 0 
          ? (uniqueResponded.size / conversations.length) * 100 
          : 0;
      }

      // Get conversion status IDs from company settings
      const { data: settings } = await supabase
        .from('company_settings')
        .select('conversion_status_ids')
        .limit(1)
        .maybeSingle();

      const conversionStatusIds = settings?.conversion_status_ids || [];

      // Count conversions using lead_status_history
      let conversions = 0;
      if (conversionStatusIds.length > 0 && conversations && conversations.length > 0) {
        const { data: conversionHistory, count } = await supabase
          .from('lead_status_history')
          .select('contact_id', { count: 'exact' })
          .gte('changed_at', dateFrom)
          .lte('changed_at', dateTo)
          .in('new_status', conversionStatusIds);
        
        conversions = count || 0;
      }

      const totalConversations = conversations?.length || 0;
      const conversionRate = totalConversations > 0 
        ? (conversions / totalConversations) * 100 
        : 0;

      return {
        avgTimeToAssignment: Math.round(avgTimeToAssignment),
        avgTimeToFirstResponse: Math.round(avgTimeToFirstResponse),
        avgTimeToConversion: 0, // Would require more complex calculation
        totalAssigned,
        totalUnassigned,
        assignmentRate,
        leadResponseRate,
        conversions,
        conversionRate,
      };
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

// =====================================================
// 2.3 - useAgentDistributionAdvanced
// Distribuição detalhada por vendedor
// =====================================================

export interface AgentDistribution {
  id: string;
  name: string;
  avatar?: string;
  leadsReceived: number;
  leadsResponded: number;
  conversions: number;
  conversionRate: number;
  avgResponseTime: number; // seconds
  byOrigin: {
    meta_ads: number;
    organic: number;
    other: number;
  };
}

export function useAgentDistributionAdvanced(filters: DashboardFilters) {
  const { conversionStatusIds } = useConversionStatusIds();

  return useQuery({
    queryKey: ['agent_distribution_advanced', filters.dateFrom, filters.dateTo, filters.departmentId, conversionStatusIds],
    queryFn: async (): Promise<AgentDistribution[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Get conversion status names
      const { data: conversionStatuses } = await supabase
        .from('lead_statuses')
        .select('name')
        .in('id', conversionStatusIds);
      
      const conversionStatusNames = conversionStatuses?.map(s => s.name) || [];

      // Get all active agents
      let agentsQuery = supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('is_active', true)
        .not('role', 'is', null);

      if (filters.departmentId) {
        agentsQuery = agentsQuery.eq('department_id', filters.departmentId);
      }

      const { data: agents } = await agentsQuery;

      if (!agents || agents.length === 0) return [];

      // Get data for each agent
      const results = await Promise.all(
        agents.map(async (agent) => {
          // Get conversations assigned to this agent
          const { data: conversations } = await supabase
            .from('conversations')
            .select('id, contact_id, referral_source, first_response_at, created_at')
            .eq('assigned_to', agent.id)
            .gte('created_at', dateFrom)
            .lte('created_at', dateTo);

          const leadsReceived = conversations?.length || 0;

          // Count by origin
          const byOrigin = {
            meta_ads: conversations?.filter(c => c.referral_source === 'meta_ads').length || 0,
            organic: conversations?.filter(c => !c.referral_source || c.referral_source === 'organic').length || 0,
            other: conversations?.filter(c => c.referral_source && !['meta_ads', 'organic'].includes(c.referral_source)).length || 0,
          };

          // Count responded (has first_response_at)
          const leadsResponded = conversations?.filter(c => c.first_response_at).length || 0;

          // Calculate avg response time
          const withResponse = conversations?.filter(c => c.first_response_at) || [];
          const avgResponseTime = withResponse.length > 0
            ? withResponse.reduce((sum, c) => {
                const created = new Date(c.created_at).getTime();
                const response = new Date(c.first_response_at!).getTime();
                return sum + (response - created) / 1000;
              }, 0) / withResponse.length
            : 0;

          // Count conversions
          let conversions = 0;
          if (conversations && conversations.length > 0 && conversionStatusNames.length > 0) {
            const contactIds = [...new Set(conversations.map(c => c.contact_id))];
            
            const { data: convertedContacts } = await supabase
              .from('lead_status_history')
              .select('contact_id')
              .in('contact_id', contactIds)
              .in('new_status', conversionStatusNames);

            conversions = new Set(convertedContacts?.map(c => c.contact_id) || []).size;
          }

          const conversionRate = leadsReceived > 0 ? (conversions / leadsReceived) * 100 : 0;

          return {
            id: agent.id,
            name: agent.full_name || 'Sem nome',
            avatar: agent.avatar_url || undefined,
            leadsReceived,
            leadsResponded,
            conversions,
            conversionRate,
            avgResponseTime: Math.round(avgResponseTime),
            byOrigin,
          };
        })
      );

      // Sort by leads received (descending)
      return results
        .filter(r => r.leadsReceived > 0)
        .sort((a, b) => b.leadsReceived - a.leadsReceived);
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

// =====================================================
// 2.4 - useStatusFunnel
// Dados do funil de status
// =====================================================

export interface StatusFunnelData {
  status: string;
  count: number;
  avgDuration: number; // seconds
  color: string;
  order: number;
}

export function useStatusFunnel(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['status_funnel', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId],
    queryFn: async (): Promise<StatusFunnelData[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Get all lead statuses
      const { data: statuses } = await supabase
        .from('lead_statuses')
        .select('id, name, color, order_position')
        .eq('is_active', true)
        .order('order_position');

      if (!statuses) return [];

      // Get status history for duration calculations
      const { data: historyData } = await supabase
        .from('lead_status_history')
        .select('previous_status, new_status, duration_seconds')
        .gte('changed_at', dateFrom)
        .lte('changed_at', dateTo);

      // Calculate average duration per status
      const durationMap = new Map<string, { total: number; count: number }>();
      historyData?.forEach(entry => {
        if (entry.previous_status && entry.duration_seconds) {
          const existing = durationMap.get(entry.previous_status) || { total: 0, count: 0 };
          existing.total += entry.duration_seconds;
          existing.count += 1;
          durationMap.set(entry.previous_status, existing);
        }
      });

      // Get current count for each status
      const results = await Promise.all(
        statuses.map(async (status) => {
          let query = supabase
            .from('contacts')
            .select('id', { count: 'exact', head: true })
            .eq('lead_status', status.name)
            .gte('created_at', dateFrom)
            .lte('created_at', dateTo);

          if (filters.agentId) {
            query = query.eq('assigned_to', filters.agentId);
          }
          if (filters.departmentId) {
            query = query.eq('department_id', filters.departmentId);
          }

          const { count } = await query;
          const duration = durationMap.get(status.name);
          const avgDuration = duration ? Math.round(duration.total / duration.count) : 0;

          return {
            status: status.name,
            count: count || 0,
            avgDuration,
            color: status.color || '#8B5CF6',
            order: status.order_position,
          };
        })
      );

      return results.sort((a, b) => a.order - b.order);
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

// =====================================================
// 2.5 - useLeadAlerts
// Alertas de leads que precisam de atenção
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
  return useQuery({
    queryKey: ['lead_alerts', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId],
    queryFn: async (): Promise<LeadAlert[]> => {
      const now = new Date();
      const alerts: LeadAlert[] = [];

      // 1. Leads sem atribuição há mais de 5 minutos
      let unassignedQuery = supabase
        .from('conversations')
        .select(`
          id,
          created_at,
          contact:contacts!inner(id, full_name, phone, lead_status)
        `)
        .eq('status', 'open')
        .is('assigned_to', null)
        .order('created_at', { ascending: true })
        .limit(20);

      if (filters.departmentId) {
        unassignedQuery = unassignedQuery.eq('department_id', filters.departmentId);
      }

      const { data: unassigned } = await unassignedQuery;

      unassigned?.forEach(conv => {
        const createdAt = new Date(conv.created_at);
        const waitingMinutes = Math.floor((now.getTime() - createdAt.getTime()) / 60000);
        
        if (waitingMinutes >= 5) {
          const contact = conv.contact as any;
          alerts.push({
            id: `unassigned-${conv.id}`,
            type: 'unassigned',
            contactId: contact.id,
            contactName: contact.full_name,
            contactPhone: contact.phone,
            conversationId: conv.id,
            waitingMinutes,
            status: contact.lead_status,
            severity: waitingMinutes >= 30 ? 'critical' : 'warning',
          });
        }
      });

      // 2. Leads aguardando resposta há mais de 30 minutos
      let awaitingQuery = supabase
        .from('conversations')
        .select(`
          id,
          last_message_at,
          assigned_to,
          contact:contacts!inner(id, full_name, phone, lead_status),
          agent:profiles!conversations_assigned_to_fkey(full_name)
        `)
        .eq('status', 'open')
        .not('assigned_to', 'is', null)
        .order('last_message_at', { ascending: true })
        .limit(50);

      if (filters.agentId) {
        awaitingQuery = awaitingQuery.eq('assigned_to', filters.agentId);
      }
      if (filters.departmentId) {
        awaitingQuery = awaitingQuery.eq('department_id', filters.departmentId);
      }

      const { data: openConversations } = await awaitingQuery;

      if (openConversations && openConversations.length > 0) {
        // Check last message for each conversation
        const conversationIds = openConversations.map(c => c.id);
        
        const { data: lastMessages } = await supabase
          .from('messages')
          .select('conversation_id, is_from_me, created_at')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: false });

        // Group by conversation - get last message
        const lastMessageByConv = new Map<string, { is_from_me: boolean; created_at: string }>();
        lastMessages?.forEach(msg => {
          if (!lastMessageByConv.has(msg.conversation_id)) {
            lastMessageByConv.set(msg.conversation_id, {
              is_from_me: msg.is_from_me || false,
              created_at: msg.created_at,
            });
          }
        });

        openConversations.forEach(conv => {
          const lastMsg = lastMessageByConv.get(conv.id);
          
          // If last message is from client (not from us), calculate waiting time
          if (lastMsg && !lastMsg.is_from_me) {
            const msgTime = new Date(lastMsg.created_at);
            const waitingMinutes = Math.floor((now.getTime() - msgTime.getTime()) / 60000);
            
            if (waitingMinutes >= 30) {
              const contact = conv.contact as any;
              const agent = conv.agent as any;
              
              alerts.push({
                id: `no_response-${conv.id}`,
                type: 'no_response',
                contactId: contact.id,
                contactName: contact.full_name,
                contactPhone: contact.phone,
                conversationId: conv.id,
                waitingMinutes,
                status: contact.lead_status,
                agentName: agent?.full_name,
                severity: waitingMinutes >= 120 ? 'critical' : 'warning',
              });
            }
          }
        });
      }

      // Sort by severity and waiting time
      return alerts.sort((a, b) => {
        if (a.severity !== b.severity) {
          return a.severity === 'critical' ? -1 : 1;
        }
        return b.waitingMinutes - a.waitingMinutes;
      });
    },
    staleTime: 30000, // 30 seconds - more frequent for alerts
    refetchInterval: 30000,
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
