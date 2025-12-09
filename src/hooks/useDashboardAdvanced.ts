import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const BRAZIL_TIMEZONE = 'America/Sao_Paulo';
const STALE_TIME = 10000; // 10 seconds
const REFETCH_INTERVAL = 30000; // 30 seconds

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
      // Build converted contacts query with count
      let convertedQuery = supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .in('lead_status', ['07 - Pedido Fechado', '08 - Em andamento', '09 - Entregue', '10 - Finalizado']);

      if (filters.agentId) {
        convertedQuery = convertedQuery.eq('assigned_to', filters.agentId);
      }
      if (filters.departmentId) {
        convertedQuery = convertedQuery.eq('department_id', filters.departmentId);
      }

      const [
        { count: newLeads },
        { data: conversations },
        { count: convertedCount },
        { data: deals }
      ] = await Promise.all([
        contactsQuery,
        conversationsQuery,
        convertedQuery,
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

      // Calculate conversion rate using aggregated count
      const totalContacts = newLeads || 0;
      const convertedTotal = convertedCount || 0;
      const conversionRate = totalContacts > 0 ? (convertedTotal / totalContacts) * 100 : 0;

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
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

// Leads by Status Hook - Using aggregated counts to avoid 1000 record limit
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

      if (!statuses || statuses.length === 0) return [];

      // Count contacts for each status using aggregated queries
      const statusCounts = await Promise.all(
        statuses.map(async (status) => {
          let query = supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
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
          return {
            status: status.name,
            count: count || 0,
            color: status.color || '#8B5CF6'
          };
        })
      );

      // Also count contacts without status (new leads)
      let noStatusQuery = supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .or('lead_status.is.null,lead_status.eq.new')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      if (filters.agentId) {
        noStatusQuery = noStatusQuery.eq('assigned_to', filters.agentId);
      }
      if (filters.departmentId) {
        noStatusQuery = noStatusQuery.eq('department_id', filters.departmentId);
      }

      const { count: noStatusCount } = await noStatusQuery;
      
      const results = [
        ...statusCounts,
        { status: 'Sem Status', count: noStatusCount || 0, color: '#6B7280' }
      ];

      return results
        .filter(r => r.count > 0)
        .sort((a, b) => b.count - a.count);
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
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

      // Get messages for response time calculation
      const { data: messages } = await supabase
        .from('messages')
        .select('conversation_id, is_from_me, created_at')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .in('conversation_id', conversations?.map(c => c.id) || [])
        .order('created_at', { ascending: true });

      // Group messages by conversation
      const messagesByConv = new Map<string, Array<{ is_from_me: boolean; created_at: string }>>();
      messages?.forEach(msg => {
        if (!messagesByConv.has(msg.conversation_id)) {
          messagesByConv.set(msg.conversation_id, []);
        }
        messagesByConv.get(msg.conversation_id)!.push({
          is_from_me: msg.is_from_me || false,
          created_at: msg.created_at
        });
      });

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

        // Calculate avg response time from real messages
        const responseTimes: number[] = [];
        agentConversations.forEach(conv => {
          const convMsgs = messagesByConv.get(conv.id) || [];
          // Find first client message and first agent response after it
          let firstClientMsgTime: number | null = null;
          for (const msg of convMsgs) {
            if (!msg.is_from_me && firstClientMsgTime === null) {
              firstClientMsgTime = new Date(msg.created_at).getTime();
            } else if (msg.is_from_me && firstClientMsgTime !== null) {
              const responseTime = (new Date(msg.created_at).getTime() - firstClientMsgTime) / 1000;
              responseTimes.push(responseTime);
              break;
            }
          }
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
      }).sort((a, b) => {
        // Sort by conversions first, then by leads if conversions are equal
        if (b.conversions !== a.conversions) {
          return b.conversions - a.conversions;
        }
        return b.leadsAssigned - a.leadsAssigned;
      });
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
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
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

// Timeline Data Hook - Using aggregated counts per day to avoid 1000 record limit
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

      // Define conversion statuses
      const conversionStatuses = ['07 - Pedido Fechado', '08 - Em andamento', '09 - Entregue', '10 - Finalizado'];

      // Get counts for each day using aggregated queries
      const timelineData = await Promise.all(
        dates.map(async (date) => {
          const dayStart = startOfDay(date).toISOString();
          const dayEnd = endOfDay(date).toISOString();

          // Count new leads for this day
          let newLeadsQuery = supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', dayStart)
            .lte('created_at', dayEnd);

          // Count conversions for this day
          let conversionsQuery = supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', dayStart)
            .lte('created_at', dayEnd)
            .in('lead_status', conversionStatuses);

          if (filters.agentId) {
            newLeadsQuery = newLeadsQuery.eq('assigned_to', filters.agentId);
            conversionsQuery = conversionsQuery.eq('assigned_to', filters.agentId);
          }
          if (filters.departmentId) {
            newLeadsQuery = newLeadsQuery.eq('department_id', filters.departmentId);
            conversionsQuery = conversionsQuery.eq('department_id', filters.departmentId);
          }

          const [{ count: newLeads }, { count: conversions }] = await Promise.all([
            newLeadsQuery,
            conversionsQuery
          ]);

          return {
            date: format(date, 'dd/MM'),
            newLeads: newLeads || 0,
            conversions: conversions || 0
          };
        })
      );

      return timelineData;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

// Conversion Funnel Hook - Using aggregated counts to avoid 1000 record limit
export function useConversionFunnel(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['conversion_funnel', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId],
    queryFn: async (): Promise<FunnelData[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Define funnel stages
      const funnelStages = [
        { stage: 'Novos Leads', statuses: ['new', '01 - Não respondeu', '02 - Pré-venda'], color: '#8B5CF6' },
        { stage: 'Em Qualificação', statuses: ['03 - Enviar catálogo', '04 - Pré-orçamento', '05 - Orçamento enviado'], color: '#3B82F6' },
        { stage: 'Negociação', statuses: ['06 - Negociação'], color: '#F59E0B' },
        { stage: 'Fechamento', statuses: ['07 - Pedido Fechado'], color: '#10B981' },
      ];

      // Count contacts for each funnel stage using aggregated queries
      const funnelData = await Promise.all(
        funnelStages.map(async ({ stage, statuses, color }) => {
          let query = supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', dateFrom)
            .lte('created_at', dateTo);

          // Handle null/new status for first stage
          if (statuses.includes('new')) {
            query = query.or(`lead_status.is.null,lead_status.in.(${statuses.join(',')})`);
          } else {
            query = query.in('lead_status', statuses);
          }

          if (filters.agentId) {
            query = query.eq('assigned_to', filters.agentId);
          }
          if (filters.departmentId) {
            query = query.eq('department_id', filters.departmentId);
          }

          const { count } = await query;
          return { stage, value: count || 0, color };
        })
      );

      return funnelData;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
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

// Hourly Timeline Data Interface
export interface HourlyData {
  hour: string;           // "06:00", "07:00", etc.
  hourNum: number;        // 6, 7, 8... for sorting
  newLeads: number;       // Leads created at this hour
  messagesSent: number;   // Messages from agents (is_from_me = true)
  messagesReceived: number; // Messages from clients (is_from_me = false)
  leadResponses: number;  // Leads responding to agent messages
  noResponse: number;     // Conversations without lead response
}

// Hourly Timeline Hook - Shows activity patterns by hour of day
export function useHourlyTimeline(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['hourly_timeline', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId],
    queryFn: async (): Promise<HourlyData[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Initialize hours array (6h to 22h)
      const hours: HourlyData[] = [];
      for (let h = 6; h <= 22; h++) {
        hours.push({
          hour: `${h.toString().padStart(2, '0')}:00`,
          hourNum: h,
          newLeads: 0,
          messagesSent: 0,
          messagesReceived: 0,
          leadResponses: 0,
          noResponse: 0
        });
      }

      // Get all contacts created in period
      let contactsQuery = supabase
        .from('contacts')
        .select('id, created_at')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      if (filters.agentId) {
        contactsQuery = contactsQuery.eq('assigned_to', filters.agentId);
      }
      if (filters.departmentId) {
        contactsQuery = contactsQuery.eq('department_id', filters.departmentId);
      }

      // Get all messages in period
      let messagesQuery = supabase
        .from('messages')
        .select('id, conversation_id, is_from_me, created_at')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .order('created_at', { ascending: true });

      // Get conversations for filtering
      let conversationsQuery = supabase
        .from('conversations')
        .select('id, assigned_to, department_id')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      if (filters.agentId) {
        conversationsQuery = conversationsQuery.eq('assigned_to', filters.agentId);
      }
      if (filters.departmentId) {
        conversationsQuery = conversationsQuery.eq('department_id', filters.departmentId);
      }

      const [
        { data: contacts },
        { data: allMessages },
        { data: conversations }
      ] = await Promise.all([
        contactsQuery,
        messagesQuery,
        conversationsQuery
      ]);

      // Filter messages by conversations that match filters
      const validConvIds = new Set(conversations?.map(c => c.id) || []);
      const messages = allMessages?.filter(m => validConvIds.has(m.conversation_id)) || [];

      // Count new leads by hour (with timezone correction)
      contacts?.forEach(contact => {
        const zonedDate = toZonedTime(new Date(contact.created_at), BRAZIL_TIMEZONE);
        const hour = zonedDate.getHours();
        const hourData = hours.find(h => h.hourNum === hour);
        if (hourData) {
          hourData.newLeads++;
        }
      });

      // Count messages by hour and type (with timezone correction)
      const messagesByConv = new Map<string, Array<{ is_from_me: boolean; created_at: string; hour: number }>>();
      
      messages?.forEach(msg => {
        const zonedDate = toZonedTime(new Date(msg.created_at), BRAZIL_TIMEZONE);
        const hour = zonedDate.getHours();
        const hourData = hours.find(h => h.hourNum === hour);
        
        if (hourData) {
          if (msg.is_from_me) {
            hourData.messagesSent++;
          } else {
            hourData.messagesReceived++;
          }
        }

        // Group messages by conversation for lead response analysis
        if (!messagesByConv.has(msg.conversation_id)) {
          messagesByConv.set(msg.conversation_id, []);
        }
        messagesByConv.get(msg.conversation_id)!.push({
          is_from_me: msg.is_from_me || false,
          created_at: msg.created_at,
          hour
        });
      });

      // Calculate lead responses (client messages that follow agent messages)
      messagesByConv.forEach((convMessages) => {
        // Sort by time
        convMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        for (let i = 1; i < convMessages.length; i++) {
          const current = convMessages[i];
          const previous = convMessages[i - 1];
          
          // If current message is from client and previous was from agent = lead response
          if (!current.is_from_me && previous.is_from_me) {
            const hourData = hours.find(h => h.hourNum === current.hour);
            if (hourData) {
              hourData.leadResponses++;
            }
          }
        }
      });

      // Calculate no response (agent messages without subsequent client response in the period)
      messagesByConv.forEach((convMessages) => {
        convMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        for (let i = 0; i < convMessages.length; i++) {
          const current = convMessages[i];
          
          // If agent message
          if (current.is_from_me) {
            // Check if there's a client response after this
            const hasResponse = convMessages.slice(i + 1).some(m => !m.is_from_me);
            
            if (!hasResponse) {
              const hourData = hours.find(h => h.hourNum === current.hour);
              if (hourData) {
                hourData.noResponse++;
              }
            }
          }
        }
      });

      return hours;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}

// Interaction Timeline Data Interface - Client vs Agent messages by hour
export interface InteractionHourlyData {
  hour: string;           // "00:00", "01:00", ..., "23:00"
  hourNum: number;        // 0, 1, ..., 23
  clientMessages: number; // Messages from clients (is_from_me = false)
  agentMessages: number;  // Messages from agents (is_from_me = true)
}

// Interaction Timeline Hook - Shows client vs agent messages by hour (00:00-23:59)
export function useInteractionTimeline(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['interaction_timeline', filters.dateFrom, filters.dateTo, filters.agentId, filters.departmentId],
    queryFn: async (): Promise<InteractionHourlyData[]> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Initialize hours array (0h to 23h - full day)
      const hours: InteractionHourlyData[] = [];
      for (let h = 0; h <= 23; h++) {
        hours.push({
          hour: `${h.toString().padStart(2, '0')}:00`,
          hourNum: h,
          clientMessages: 0,
          agentMessages: 0
        });
      }

      // Get conversations that match filters
      let conversationsQuery = supabase
        .from('conversations')
        .select('id')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      if (filters.agentId) {
        conversationsQuery = conversationsQuery.eq('assigned_to', filters.agentId);
      }
      if (filters.departmentId) {
        conversationsQuery = conversationsQuery.eq('department_id', filters.departmentId);
      }

      const { data: conversations } = await conversationsQuery;
      
      if (!conversations || conversations.length === 0) {
        return hours;
      }

      const convIds = conversations.map(c => c.id);

      // Get all messages for these conversations in the period
      const { data: messages } = await supabase
        .from('messages')
        .select('id, conversation_id, is_from_me, created_at')
        .in('conversation_id', convIds)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      // Count messages by hour and type (with timezone correction)
      messages?.forEach(msg => {
        const zonedDate = toZonedTime(new Date(msg.created_at), BRAZIL_TIMEZONE);
        const hour = zonedDate.getHours();
        const hourData = hours.find(h => h.hourNum === hour);
        
        if (hourData) {
          if (msg.is_from_me) {
            hourData.agentMessages++;
          } else {
            hourData.clientMessages++;
          }
        }
      });

      return hours;
    },
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_INTERVAL,
  });
}
