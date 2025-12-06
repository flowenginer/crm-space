import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export interface DashboardFilters {
  dateFrom: Date;
  dateTo: Date;
  agentId?: string;
  departmentId?: string;
}

export interface KPIData {
  newLeads: number;
  inService: number;
  awaitingResponse: number;
  avgResponseTime: number; // in seconds
  conversionRate: number;
  convertedValue: number;
  totalConversations: number;
}

export interface LeadStatusCount {
  status: string;
  count: number;
  color: string;
}

export interface AgentPerformance {
  id: string;
  name: string;
  avatar?: string;
  leadsAssigned: number;
  conversions: number;
  conversionRate: number;
  avgResponseTime: number;
}

export interface CriticalConversation {
  id: string;
  contactName: string;
  contactPhone: string;
  lastMessageAt: string;
  waitingTime: number; // in minutes
  agentName?: string;
}

export interface TimelineData {
  date: string;
  newLeads: number;
  conversions: number;
}

export interface FunnelData {
  stage: string;
  value: number;
  color: string;
}

// Main KPIs Hook
export function useDashboardKPIs(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard_kpis', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId],
    queryFn: async (): Promise<KPIData> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Build base query conditions
      let contactsQuery = supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      let conversationsQuery = supabase
        .from('conversations')
        .select('id, status, assigned_to, last_message_at, first_response_at, created_at')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      if (filters.agentId) {
        contactsQuery = contactsQuery.eq('assigned_to', filters.agentId);
        conversationsQuery = conversationsQuery.eq('assigned_to', filters.agentId);
      }

      if (filters.departmentId) {
        contactsQuery = contactsQuery.eq('department_id', filters.departmentId);
        conversationsQuery = conversationsQuery.eq('department_id', filters.departmentId);
      }

      // Execute queries in parallel
      const [
        { count: newLeads },
        { data: conversations },
        { data: convertedContacts },
        { data: deals }
      ] = await Promise.all([
        contactsQuery,
        conversationsQuery,
        supabase
          .from('contacts')
          .select('id')
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo)
          .in('lead_status', ['07 - Pedido Fechado', '08 - Em andamento', '09 - Entregue', '10 - Finalizado']),
        supabase
          .from('deals')
          .select('value')
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo)
          .eq('status', 'won')
      ]);

      // Calculate in service (open conversations)
      const inService = conversations?.filter(c => c.status === 'open').length || 0;

      // Calculate awaiting response - get last message for each open conversation
      let awaitingResponse = 0;
      const openConversations = conversations?.filter(c => c.status === 'open') || [];
      
      if (openConversations.length > 0) {
        const { data: lastMessages } = await supabase
          .from('messages')
          .select('conversation_id, is_from_me, created_at')
          .in('conversation_id', openConversations.map(c => c.id))
          .order('created_at', { ascending: false });

        // Group by conversation and check if last message is from client
        const lastMessageByConv = new Map<string, boolean>();
        lastMessages?.forEach(msg => {
          if (!lastMessageByConv.has(msg.conversation_id)) {
            lastMessageByConv.set(msg.conversation_id, !msg.is_from_me);
          }
        });

        awaitingResponse = Array.from(lastMessageByConv.values()).filter(Boolean).length;
      }

      // Calculate average response time
      let avgResponseTime = 0;
      const conversationsWithResponse = conversations?.filter(c => c.first_response_at) || [];
      if (conversationsWithResponse.length > 0) {
        const responseTimes = conversationsWithResponse.map(c => {
          const created = new Date(c.created_at).getTime();
          const firstResponse = new Date(c.first_response_at!).getTime();
          return (firstResponse - created) / 1000; // seconds
        });
        avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      }

      // Calculate conversion rate
      const totalContacts = newLeads || 0;
      const convertedCount = convertedContacts?.length || 0;
      const conversionRate = totalContacts > 0 ? (convertedCount / totalContacts) * 100 : 0;

      // Calculate converted value
      const convertedValue = deals?.reduce((sum, deal) => sum + (deal.value || 0), 0) || 0;

      return {
        newLeads: newLeads || 0,
        inService,
        awaitingResponse,
        avgResponseTime,
        conversionRate,
        convertedValue,
        totalConversations: conversations?.length || 0
      };
    },
    staleTime: 60000,
  });
}

// Leads by Status Hook
export function useLeadsByStatus(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['leads_by_status', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId],
    queryFn: async (): Promise<LeadStatusCount[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Get lead statuses
      const { data: statuses } = await supabase
        .from('lead_statuses')
        .select('name, color')
        .eq('is_active', true)
        .order('order_position');

      // Get contacts with their lead status
      let query = supabase
        .from('contacts')
        .select('lead_status')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      if (filters.agentId) {
        query = query.eq('assigned_to', filters.agentId);
      }
      if (filters.departmentId) {
        query = query.eq('department_id', filters.departmentId);
      }

      const { data: contacts } = await query;

      // Count by status
      const statusCounts = new Map<string, number>();
      contacts?.forEach(contact => {
        const status = contact.lead_status || 'Sem Status';
        statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
      });

      // Build result with colors
      const statusColorMap = new Map(statuses?.map(s => [s.name, s.color]) || []);
      
      return Array.from(statusCounts.entries())
        .map(([status, count]) => ({
          status,
          count,
          color: statusColorMap.get(status) || '#8B5CF6'
        }))
        .sort((a, b) => b.count - a.count);
    },
    staleTime: 60000,
  });
}

// Agent Performance Hook
export function useAgentPerformance(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['agent_performance', filters.dateFrom, filters.dateTo, filters.departmentId],
    queryFn: async (): Promise<AgentPerformance[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Get all agents
      let profilesQuery = supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('is_active', true);

      if (filters.departmentId) {
        profilesQuery = profilesQuery.eq('department_id', filters.departmentId);
      }

      const { data: agents } = await profilesQuery;

      if (!agents || agents.length === 0) return [];

      // Get contacts assigned to each agent
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, assigned_to, lead_status')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .in('assigned_to', agents.map(a => a.id));

      // Get conversations with response times
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, assigned_to, created_at, first_response_at')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .in('assigned_to', agents.map(a => a.id));

      // Calculate metrics per agent
      return agents.map(agent => {
        const agentContacts = contacts?.filter(c => c.assigned_to === agent.id) || [];
        const agentConversations = conversations?.filter(c => c.assigned_to === agent.id) || [];
        
        const conversions = agentContacts.filter(c => 
          ['07 - Pedido Fechado', '08 - Em andamento', '09 - Entregue', '10 - Finalizado'].includes(c.lead_status || '')
        ).length;

        const conversionRate = agentContacts.length > 0 
          ? (conversions / agentContacts.length) * 100 
          : 0;

        // Calculate avg response time
        const responseTimes = agentConversations
          .filter(c => c.first_response_at)
          .map(c => {
            const created = new Date(c.created_at).getTime();
            const firstResponse = new Date(c.first_response_at!).getTime();
            return (firstResponse - created) / 1000;
          });

        const avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0;

        return {
          id: agent.id,
          name: agent.full_name || 'Sem nome',
          avatar: agent.avatar_url || undefined,
          leadsAssigned: agentContacts.length,
          conversions,
          conversionRate,
          avgResponseTime
        };
      }).sort((a, b) => b.conversions - a.conversions);
    },
    staleTime: 60000,
  });
}

// Critical Conversations Hook
export function useCriticalConversations(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['critical_conversations', filters.agentId, filters.departmentId],
    queryFn: async (): Promise<CriticalConversation[]> => {
      // Get open conversations
      let query = supabase
        .from('conversations')
        .select(`
          id,
          last_message_at,
          assigned_to,
          contact:contacts(full_name, phone),
          agent:profiles!conversations_assigned_to_fkey(full_name)
        `)
        .eq('status', 'open')
        .order('last_message_at', { ascending: true })
        .limit(10);

      if (filters.agentId) {
        query = query.eq('assigned_to', filters.agentId);
      }
      if (filters.departmentId) {
        query = query.eq('department_id', filters.departmentId);
      }

      const { data: conversations } = await query;

      if (!conversations || conversations.length === 0) return [];

      // Get last messages to check if awaiting response
      const { data: messages } = await supabase
        .from('messages')
        .select('conversation_id, is_from_me, created_at')
        .in('conversation_id', conversations.map(c => c.id))
        .order('created_at', { ascending: false });

      // Group by conversation
      const lastMessageByConv = new Map<string, { is_from_me: boolean; created_at: string }>();
      messages?.forEach(msg => {
        if (!lastMessageByConv.has(msg.conversation_id)) {
          lastMessageByConv.set(msg.conversation_id, { 
            is_from_me: msg.is_from_me || false, 
            created_at: msg.created_at 
          });
        }
      });

      // Filter only conversations awaiting response (last message from client)
      const now = new Date().getTime();
      
      return conversations
        .filter(conv => {
          const lastMsg = lastMessageByConv.get(conv.id);
          return lastMsg && !lastMsg.is_from_me;
        })
        .map(conv => {
          const lastMsg = lastMessageByConv.get(conv.id);
          const lastMessageTime = lastMsg ? new Date(lastMsg.created_at).getTime() : now;
          const waitingTime = Math.floor((now - lastMessageTime) / 60000);

          const contact = conv.contact as { full_name: string; phone: string } | null;
          const agent = conv.agent as { full_name: string } | null;

          return {
            id: conv.id,
            contactName: contact?.full_name || 'Sem nome',
            contactPhone: contact?.phone || '',
            lastMessageAt: lastMsg?.created_at || conv.last_message_at || '',
            waitingTime,
            agentName: agent?.full_name
          };
        })
        .sort((a, b) => b.waitingTime - a.waitingTime)
        .slice(0, 5);
    },
    staleTime: 30000,
  });
}

// Timeline Data Hook
export function useTimelineData(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['timeline_data', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId],
    queryFn: async (): Promise<TimelineData[]> => {
      const dateFrom = startOfDay(filters.dateFrom);
      const dateTo = endOfDay(filters.dateTo);
      
      // Generate date range
      const dates: Date[] = [];
      let currentDate = new Date(dateFrom);
      while (currentDate <= dateTo) {
        dates.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Get contacts grouped by date
      let contactsQuery = supabase
        .from('contacts')
        .select('created_at, lead_status')
        .gte('created_at', dateFrom.toISOString())
        .lte('created_at', dateTo.toISOString());

      if (filters.agentId) {
        contactsQuery = contactsQuery.eq('assigned_to', filters.agentId);
      }
      if (filters.departmentId) {
        contactsQuery = contactsQuery.eq('department_id', filters.departmentId);
      }

      const { data: contacts } = await contactsQuery;

      // Build timeline data
      return dates.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayContacts = contacts?.filter(c => 
          c.created_at.startsWith(dateStr)
        ) || [];

        const conversions = dayContacts.filter(c =>
          ['07 - Pedido Fechado', '08 - Em andamento', '09 - Entregue', '10 - Finalizado'].includes(c.lead_status || '')
        ).length;

        return {
          date: format(date, 'dd/MM'),
          newLeads: dayContacts.length,
          conversions
        };
      });
    },
    staleTime: 60000,
  });
}

// Conversion Funnel Hook
export function useConversionFunnel(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['conversion_funnel', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId],
    queryFn: async (): Promise<FunnelData[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      let query = supabase
        .from('contacts')
        .select('id, lead_status')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      if (filters.agentId) {
        query = query.eq('assigned_to', filters.agentId);
      }
      if (filters.departmentId) {
        query = query.eq('department_id', filters.departmentId);
      }

      const { data: contacts } = await query;
      const total = contacts?.length || 0;

      // Define funnel stages
      const funnelStages = [
        { stage: 'Novos Leads', statuses: ['new', '01 - Não respondeu', '02 - Pré-venda'], color: '#8B5CF6' },
        { stage: 'Em Qualificação', statuses: ['03 - Enviar catálogo', '04 - Pré-orçamento', '05 - Orçamento enviado'], color: '#3B82F6' },
        { stage: 'Negociação', statuses: ['06 - Negociação'], color: '#F59E0B' },
        { stage: 'Fechamento', statuses: ['07 - Pedido Fechado'], color: '#10B981' },
      ];

      return funnelStages.map(({ stage, statuses, color }) => ({
        stage,
        value: contacts?.filter(c => statuses.includes(c.lead_status || 'new')).length || 0,
        color
      }));
    },
    staleTime: 60000,
  });
}

// Get available agents for filter
export function useAgentsForFilter(departmentId?: string) {
  return useQuery({
    queryKey: ['agents_filter', departmentId],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');

      if (departmentId) {
        query = query.eq('department_id', departmentId);
      }

      const { data } = await query;
      return data || [];
    },
    staleTime: 300000,
  });
}

// Get departments for filter
export function useDepartmentsForFilter() {
  return useQuery({
    queryKey: ['departments_filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('departments')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
    staleTime: 300000,
  });
}
