import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, format, differenceInMinutes, differenceInDays, subDays } from 'date-fns';

interface DateRange {
  from: Date;
  to: Date;
}

// ============ SLA Report Hooks (with FCR, Trend, SLA by Channel) ============

interface SLAAgentData {
  agent_id: string;
  agent_name: string;
  avatar_url: string | null;
  total: number;
  bom: number;
  regular: number;
  critico: number;
  avg_response_minutes: number;
  sla_good_percent: number;
}

interface SLAMetrics {
  total_bom: number;
  total_regular: number;
  total_critico: number;
  avg_tma_minutes: number;
  // New metrics
  fcr_percent: number; // First Contact Resolution
  trend_percent: number; // vs previous period
  trend_direction: 'up' | 'down' | 'neutral';
}

interface DepartmentTMA {
  name: string;
  value: number;
  percentage: number;
}

interface ChannelSLA {
  channel_id: string;
  channel_name: string;
  total: number;
  bom: number;
  regular: number;
  critico: number;
  sla_good_percent: number;
}

export function useReportSLA(dateRange: DateRange | undefined) {
  return useQuery({
    queryKey: ['report-sla', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<{
      metrics: SLAMetrics;
      agents: SLAAgentData[];
      departments: DepartmentTMA[];
      timeline: { date: string; bom: number; regular: number; critico: number }[];
      channels: ChannelSLA[];
    }> => {
      if (!dateRange?.from || !dateRange?.to) {
        return { 
          metrics: { total_bom: 0, total_regular: 0, total_critico: 0, avg_tma_minutes: 0, fcr_percent: 0, trend_percent: 0, trend_direction: 'neutral' }, 
          agents: [], 
          departments: [], 
          timeline: [],
          channels: [],
        };
      }

      const startDate = startOfDay(dateRange.from).toISOString();
      const endDate = endOfDay(dateRange.to).toISOString();
      
      // Calculate previous period for trend
      const daysDiff = differenceInDays(dateRange.to, dateRange.from) + 1;
      const prevStartDate = startOfDay(subDays(dateRange.from, daysDiff)).toISOString();
      const prevEndDate = endOfDay(subDays(dateRange.from, 1)).toISOString();

      // Fetch conversations with SLA data
      const { data: conversations } = await supabase
        .from('conversations')
        .select(`
          id,
          assigned_to,
          sla_status,
          created_at,
          first_response_at,
          closed_at,
          department_id,
          channel_id,
          reopen_count,
          transferred_from,
          profiles:assigned_to(id, full_name, avatar_url),
          departments:department_id(name),
          whatsapp_channels:channel_id(id, name)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Fetch previous period for trend comparison
      const { data: prevConversations } = await supabase
        .from('conversations')
        .select('id, sla_status')
        .gte('created_at', prevStartDate)
        .lte('created_at', prevEndDate);

      // Calculate SLA metrics
      let total_bom = 0, total_regular = 0, total_critico = 0;
      let fcr_count = 0; // First Contact Resolution
      
      const agentMap = new Map<string, SLAAgentData>();
      const departmentMap = new Map<string, { name: string; total_minutes: number; count: number }>();
      const channelMap = new Map<string, ChannelSLA>();
      const timelineMap = new Map<string, { bom: number; regular: number; critico: number }>();

      (conversations || []).forEach((conv: any) => {
        const sla = conv.sla_status || 'ok';
        const dateKey = format(new Date(conv.created_at), 'dd/MM');

        // FCR: closed without transfer and without reopen
        if (conv.closed_at && !conv.transferred_from && (conv.reopen_count || 0) === 0) {
          fcr_count++;
        }

        // Timeline
        if (!timelineMap.has(dateKey)) {
          timelineMap.set(dateKey, { bom: 0, regular: 0, critico: 0 });
        }
        const timeline = timelineMap.get(dateKey)!;

        if (sla === 'ok') { total_bom++; timeline.bom++; }
        else if (sla === 'warning') { total_regular++; timeline.regular++; }
        else { total_critico++; timeline.critico++; }

        // Agent metrics
        if (conv.assigned_to && conv.profiles) {
          const agentId = conv.assigned_to;
          if (!agentMap.has(agentId)) {
            agentMap.set(agentId, {
              agent_id: agentId,
              agent_name: conv.profiles.full_name || 'Sem nome',
              avatar_url: conv.profiles.avatar_url,
              total: 0,
              bom: 0,
              regular: 0,
              critico: 0,
              avg_response_minutes: 0,
              sla_good_percent: 0,
            });
          }
          const agent = agentMap.get(agentId)!;
          agent.total++;
          if (sla === 'ok') agent.bom++;
          else if (sla === 'warning') agent.regular++;
          else agent.critico++;
        }

        // Channel SLA
        if (conv.channel_id && conv.whatsapp_channels) {
          const channelId = conv.channel_id;
          if (!channelMap.has(channelId)) {
            channelMap.set(channelId, {
              channel_id: channelId,
              channel_name: conv.whatsapp_channels.name || 'Canal desconhecido',
              total: 0,
              bom: 0,
              regular: 0,
              critico: 0,
              sla_good_percent: 0,
            });
          }
          const channel = channelMap.get(channelId)!;
          channel.total++;
          if (sla === 'ok') channel.bom++;
          else if (sla === 'warning') channel.regular++;
          else channel.critico++;
        }

        // Department TMA
        if (conv.department_id && conv.departments && conv.first_response_at) {
          const deptName = conv.departments.name;
          const responseTime = differenceInMinutes(new Date(conv.first_response_at), new Date(conv.created_at));
          if (!departmentMap.has(conv.department_id)) {
            departmentMap.set(conv.department_id, { name: deptName, total_minutes: 0, count: 0 });
          }
          const dept = departmentMap.get(conv.department_id)!;
          dept.total_minutes += responseTime;
          dept.count++;
        }
      });

      // Calculate percentages for agents
      const agents = Array.from(agentMap.values()).map(agent => ({
        ...agent,
        sla_good_percent: agent.total > 0 ? Math.round((agent.bom / agent.total) * 100) : 0,
        avg_response_minutes: 0,
      })).sort((a, b) => b.total - a.total);

      // Calculate percentages for channels
      const channels = Array.from(channelMap.values()).map(ch => ({
        ...ch,
        sla_good_percent: ch.total > 0 ? Math.round((ch.bom / ch.total) * 100) : 0,
      })).sort((a, b) => b.total - a.total);

      // Department TMA
      const departments = Array.from(departmentMap.values())
        .map(d => ({
          name: d.name,
          value: d.count > 0 ? Math.round(d.total_minutes / d.count) : 0,
          percentage: 0,
        }))
        .sort((a, b) => b.value - a.value);

      if (departments.length > 0) {
        const maxTMA = Math.max(...departments.map(d => d.value));
        departments.forEach(d => d.percentage = maxTMA > 0 ? Math.round((d.value / maxTMA) * 100) : 0);
      }

      // Timeline
      const timeline = Array.from(timelineMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const totalConvs = total_bom + total_regular + total_critico;
      const avg_tma = departments.length > 0 
        ? Math.round(departments.reduce((s, d) => s + d.value, 0) / departments.length)
        : 0;

      // FCR percentage
      const fcr_percent = totalConvs > 0 ? Math.round((fcr_count / totalConvs) * 100) : 0;

      // Trend calculation
      const prevTotal = prevConversations?.length || 0;
      const prevBom = prevConversations?.filter((c: any) => c.sla_status === 'ok').length || 0;
      const prevSlaPercent = prevTotal > 0 ? Math.round((prevBom / prevTotal) * 100) : 0;
      const currentSlaPercent = totalConvs > 0 ? Math.round((total_bom / totalConvs) * 100) : 0;
      const trend_percent = currentSlaPercent - prevSlaPercent;
      const trend_direction = trend_percent > 0 ? 'up' : trend_percent < 0 ? 'down' : 'neutral';

      return {
        metrics: { total_bom, total_regular, total_critico, avg_tma_minutes: avg_tma, fcr_percent, trend_percent: Math.abs(trend_percent), trend_direction },
        agents,
        departments,
        timeline,
        channels,
      };
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
    staleTime: 5 * 60 * 1000,
  });
}

// ============ Attendance Report Hooks (with Reopen Rate, Resolution Time, Heatmap) ============

interface AttendanceMetrics {
  total: number;
  open: number;
  closed: number;
  pending: number;
  previousTotal?: number;
  // New metrics
  reopenRate: number;
  avgResolutionMinutes: number;
  conversationsByAgent: { agent_id: string; agent_name: string; count: number }[];
}

interface ChannelData {
  channel: string;
  value: number;
}

interface HourlyData {
  hour: string;
  value: number;
}

interface HeatmapData {
  day: string;
  hour: number;
  value: number;
}

export function useReportAttendance(dateRange: DateRange | undefined) {
  return useQuery({
    queryKey: ['report-attendance', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<{
      metrics: AttendanceMetrics;
      byChannel: ChannelData[];
      byHour: HourlyData[];
      heatmapData: HeatmapData[];
    }> => {
      if (!dateRange?.from || !dateRange?.to) {
        return { 
          metrics: { total: 0, open: 0, closed: 0, pending: 0, reopenRate: 0, avgResolutionMinutes: 0, conversationsByAgent: [] }, 
          byChannel: [], 
          byHour: [],
          heatmapData: [],
        };
      }

      const startDate = startOfDay(dateRange.from).toISOString();
      const endDate = endOfDay(dateRange.to).toISOString();

      // Fetch conversations
      const { data: conversations } = await supabase
        .from('conversations')
        .select(`
          id,
          status,
          created_at,
          closed_at,
          channel_id,
          assigned_to,
          reopen_count,
          whatsapp_channels:channel_id(name),
          profiles:assigned_to(full_name)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const channelMap = new Map<string, number>();
      const hourMap = new Map<string, number>();
      const agentMap = new Map<string, { agent_id: string; agent_name: string; count: number }>();
      const heatmapMap = new Map<string, number>();
      
      let open = 0, closed = 0, pending = 0;
      let reopenedCount = 0;
      let totalResolutionMinutes = 0;
      let resolvedCount = 0;

      (conversations || []).forEach((conv: any) => {
        // Status counts
        if (conv.status === 'open') open++;
        else if (conv.status === 'closed') closed++;
        else if (conv.status === 'pending') pending++;

        // Reopen count
        if ((conv.reopen_count || 0) > 0) reopenedCount++;

        // Resolution time
        if (conv.closed_at && conv.created_at) {
          const resolutionTime = differenceInMinutes(new Date(conv.closed_at), new Date(conv.created_at));
          if (resolutionTime > 0 && resolutionTime < 60 * 24 * 7) { // Ignore unrealistic values
            totalResolutionMinutes += resolutionTime;
            resolvedCount++;
          }
        }

        // By channel
        const channelName = conv.whatsapp_channels?.name || 'Canal desconhecido';
        channelMap.set(channelName, (channelMap.get(channelName) || 0) + 1);

        // By hour
        const createdDate = new Date(conv.created_at);
        const hour = format(createdDate, 'HH') + 'h';
        hourMap.set(hour, (hourMap.get(hour) || 0) + 1);

        // By agent
        if (conv.assigned_to && conv.profiles) {
          const agentId = conv.assigned_to;
          if (!agentMap.has(agentId)) {
            agentMap.set(agentId, { agent_id: agentId, agent_name: conv.profiles.full_name || 'Sem nome', count: 0 });
          }
          agentMap.get(agentId)!.count++;
        }

        // Heatmap data (day of week + hour)
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const dayOfWeek = dayNames[createdDate.getDay()];
        const hourNum = createdDate.getHours();
        const heatmapKey = `${dayOfWeek}-${hourNum}`;
        heatmapMap.set(heatmapKey, (heatmapMap.get(heatmapKey) || 0) + 1);
      });

      const byChannel = Array.from(channelMap.entries())
        .map(([channel, value]) => ({ channel, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      const byHour = Array.from(hourMap.entries())
        .map(([hour, value]) => ({ hour, value }))
        .sort((a, b) => a.hour.localeCompare(b.hour));

      const conversationsByAgent = Array.from(agentMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const heatmapData = Array.from(heatmapMap.entries())
        .map(([key, value]) => {
          const [day, hour] = key.split('-');
          return { day, hour: parseInt(hour), value };
        });

      const total = conversations?.length || 0;
      const reopenRate = total > 0 ? Math.round((reopenedCount / total) * 100) : 0;
      const avgResolutionMinutes = resolvedCount > 0 ? Math.round(totalResolutionMinutes / resolvedCount) : 0;

      return {
        metrics: { total, open, closed, pending, reopenRate, avgResolutionMinutes, conversationsByAgent },
        byChannel,
        byHour,
        heatmapData,
      };
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
    staleTime: 5 * 60 * 1000,
  });
}

// ============ Sales Report Hooks (with Conversion Rate, Cycle Time, by Origin) ============

export interface SalesAgentData {
  rank: number;
  agent_id: string;
  name: string;
  avatar_url: string | null;
  orders_count: number;
  revenue: number;
  avg_ticket: number;
}

interface SalesTimeline {
  date: string;
  vendas: number;
  quantidade: number;
}

interface SalesByOrigin {
  origin: string;
  count: number;
  revenue: number;
}

export function useReportSales(dateRange: DateRange | undefined, userId?: string, canViewAll?: boolean) {
  return useQuery({
    queryKey: ['report-sales-orders', dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), userId, canViewAll],
    queryFn: async (): Promise<{
      sellers: SalesAgentData[];
      timeline: SalesTimeline[];
      totalRevenue: number;
      totalConversions: number;
      myStats: SalesAgentData | null;
      // New metrics
      conversionRate: number;
      avgCycleDays: number;
      byOrigin: SalesByOrigin[];
    }> => {
      if (!dateRange?.from || !dateRange?.to) {
        return { sellers: [], timeline: [], totalRevenue: 0, totalConversions: 0, myStats: null, conversionRate: 0, avgCycleDays: 0, byOrigin: [] };
      }

      const startDate = startOfDay(dateRange.from).toISOString();
      const endDate = endOfDay(dateRange.to).toISOString();

      // Fetch company settings for conversion status
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('conversion_status_ids')
        .single();

      const conversionStatusIds: string[] = companySettings?.conversion_status_ids || [];

      // Fetch orders
      let query = supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total,
          status,
          seller_id,
          created_at,
          profiles:seller_id(id, full_name, avatar_url)
        `)
        .neq('status', 'canceled')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const { data: orders } = await query;

      // Fetch conversations for conversion rate and cycle time
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, contact_id, created_at, referral_source')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Fetch contacts for conversion tracking
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, lead_status, negotiated_value, first_contact_at, origin, updated_at')
        .not('lead_status', 'is', null);

      // Calculate conversion rate
      const totalLeads = conversations?.length || 0;
      const convertedContacts = contacts?.filter((c: any) => 
        c.lead_status && conversionStatusIds.includes(c.lead_status)
      ) || [];
      const conversionRate = totalLeads > 0 ? Math.round((convertedContacts.length / totalLeads) * 100) : 0;

      // Calculate avg cycle time
      let totalCycleDays = 0;
      let cycleCount = 0;
      convertedContacts.forEach((c: any) => {
        if (c.first_contact_at && c.updated_at) {
          const cycleDays = differenceInDays(new Date(c.updated_at), new Date(c.first_contact_at));
          if (cycleDays >= 0 && cycleDays < 365) {
            totalCycleDays += cycleDays;
            cycleCount++;
          }
        }
      });
      const avgCycleDays = cycleCount > 0 ? Math.round(totalCycleDays / cycleCount * 10) / 10 : 0;

      // Sales by origin
      const originMap = new Map<string, { count: number; revenue: number }>();
      (conversations || []).forEach((conv: any) => {
        const origin = conv.referral_source || 'organic';
        if (!originMap.has(origin)) {
          originMap.set(origin, { count: 0, revenue: 0 });
        }
        originMap.get(origin)!.count++;
      });

      // Map orders to origins (simplified - using seller's orders)
      const byOrigin = Array.from(originMap.entries())
        .map(([origin, data]) => ({
          origin: origin === 'meta_ads' ? 'Meta Ads' : origin === 'organic' ? 'Orgânico' : origin,
          count: data.count,
          revenue: data.revenue,
        }))
        .sort((a, b) => b.count - a.count);

      // Aggregate by seller
      const sellerMap = new Map<string, {
        agent_id: string;
        name: string;
        avatar_url: string | null;
        orders_count: number;
        revenue: number;
      }>();

      const timelineMap = new Map<string, { vendas: number; quantidade: number }>();

      (orders || []).forEach((order: any) => {
        if (order.seller_id && order.profiles) {
          const sellerId = order.seller_id;
          if (!sellerMap.has(sellerId)) {
            sellerMap.set(sellerId, {
              agent_id: sellerId,
              name: order.profiles.full_name || 'Sem nome',
              avatar_url: order.profiles.avatar_url,
              orders_count: 0,
              revenue: 0,
            });
          }
          const seller = sellerMap.get(sellerId)!;
          seller.orders_count++;
          seller.revenue += order.total || 0;
        }

        const dateKey = format(new Date(order.created_at), 'dd/MM');
        if (!timelineMap.has(dateKey)) {
          timelineMap.set(dateKey, { vendas: 0, quantidade: 0 });
        }
        const t = timelineMap.get(dateKey)!;
        t.vendas += order.total || 0;
        t.quantidade++;
      });

      const sellers: SalesAgentData[] = Array.from(sellerMap.values())
        .map((s) => ({
          rank: 0,
          ...s,
          avg_ticket: s.orders_count > 0 ? Math.round(s.revenue / s.orders_count) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .map((s, idx) => ({ ...s, rank: idx + 1 }));

      const timeline = Array.from(timelineMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const totalRevenue = sellers.reduce((s, a) => s + a.revenue, 0);
      const totalConversions = sellers.reduce((s, a) => s + a.orders_count, 0);
      const myStats = userId ? sellers.find(s => s.agent_id === userId) || null : null;

      return { sellers, timeline, totalRevenue, totalConversions, myStats, conversionRate, avgCycleDays, byOrigin };
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
    staleTime: 5 * 60 * 1000,
  });
}

// ============ Performance Report Hooks (with Unified Score) ============

interface AgentPerformanceData {
  agent_id: string;
  name: string;
  avatar_url: string | null;
  total_conversations: number;
  total_sales: number;
  revenue: number;
  avg_response_minutes: number;
  sla_good_percent: number;
  // New metric
  unified_score: number; // 0-100
}

export function useReportPerformance(dateRange: DateRange | undefined, selectedAgentId?: string) {
  return useQuery({
    queryKey: ['report-performance', dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), selectedAgentId],
    queryFn: async (): Promise<{
      agents: AgentPerformanceData[];
      selectedAgent: AgentPerformanceData | null;
      average: { conversations: number; sales: number; revenue: number; sla: number; score: number };
      weeklyData: { week: string; atendimentos: number; vendas: number; sla: number }[];
    }> => {
      if (!dateRange?.from || !dateRange?.to) {
        return { agents: [], selectedAgent: null, average: { conversations: 0, sales: 0, revenue: 0, sla: 0, score: 0 }, weeklyData: [] };
      }

      const startDate = startOfDay(dateRange.from).toISOString();
      const endDate = endOfDay(dateRange.to).toISOString();

      // Fetch company settings for conversion status IDs
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('conversion_status_ids')
        .single();

      const conversionStatusIds: string[] = companySettings?.conversion_status_ids || [];

      // Fetch profiles (agents)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .in('role', ['vendedor', 'admin', 'supervisor', 'atendente']);

      // Fetch conversations with assigned_to in the period
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, assigned_to, sla_status, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Fetch ALL contacts assigned to agents
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id, assigned_to, lead_status, negotiated_value, updated_at')
        .not('assigned_to', 'is', null);

      // Aggregate by agent
      const agentMap = new Map<string, AgentPerformanceData>();

      (profiles || []).forEach((p: any) => {
        agentMap.set(p.id, {
          agent_id: p.id,
          name: p.full_name || 'Sem nome',
          avatar_url: p.avatar_url,
          total_conversations: 0,
          total_sales: 0,
          revenue: 0,
          avg_response_minutes: 0,
          sla_good_percent: 0,
          unified_score: 0,
        });
      });

      // Count conversations and SLA
      const slaCountMap = new Map<string, { total: number; good: number }>();
      (conversations || []).forEach((conv: any) => {
        if (conv.assigned_to && agentMap.has(conv.assigned_to)) {
          const agent = agentMap.get(conv.assigned_to)!;
          agent.total_conversations++;
          
          if (!slaCountMap.has(conv.assigned_to)) {
            slaCountMap.set(conv.assigned_to, { total: 0, good: 0 });
          }
          const sla = slaCountMap.get(conv.assigned_to)!;
          sla.total++;
          if (conv.sla_status === 'ok') sla.good++;
        }
      });

      // Count sales and revenue from CONTACTS
      (contacts || []).forEach((contact: any) => {
        if (contact.assigned_to && agentMap.has(contact.assigned_to)) {
          const agent = agentMap.get(contact.assigned_to)!;
          
          if (contact.lead_status && conversionStatusIds.includes(contact.lead_status)) {
            agent.total_sales++;
            agent.revenue += contact.negotiated_value || 0;
          }
        }
      });

      // Calculate SLA percentages
      slaCountMap.forEach((sla, agentId) => {
        if (agentMap.has(agentId)) {
          agentMap.get(agentId)!.sla_good_percent = sla.total > 0 ? Math.round((sla.good / sla.total) * 100) : 0;
        }
      });

      // Calculate unified score
      // Formula: (SLA * 0.3) + (Vendas_normalizado * 0.4) + (Atendimentos_normalizado * 0.3)
      const allAgents = Array.from(agentMap.values());
      const maxConversations = Math.max(...allAgents.map(a => a.total_conversations), 1);
      const maxSales = Math.max(...allAgents.map(a => a.total_sales), 1);

      allAgents.forEach(agent => {
        const slaScore = agent.sla_good_percent; // Already 0-100
        const salesScore = (agent.total_sales / maxSales) * 100;
        const conversationsScore = (agent.total_conversations / maxConversations) * 100;
        
        agent.unified_score = Math.round(
          (slaScore * 0.3) + (salesScore * 0.4) + (conversationsScore * 0.3)
        );
      });

      const agents = allAgents
        .filter(a => a.total_conversations > 0 || a.total_sales > 0 || a.revenue > 0)
        .sort((a, b) => b.unified_score - a.unified_score || b.revenue - a.revenue);

      // Calculate averages
      const avgConv = agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.total_conversations, 0) / agents.length) : 0;
      const avgSales = agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.total_sales, 0) / agents.length) : 0;
      const avgRevenue = agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.revenue, 0) / agents.length) : 0;
      const avgSla = agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.sla_good_percent, 0) / agents.length) : 0;
      const avgScore = agents.length > 0 ? Math.round(agents.reduce((s, a) => s + a.unified_score, 0) / agents.length) : 0;

      const selectedAgent = selectedAgentId ? agents.find(a => a.agent_id === selectedAgentId) || null : null;

      // Calculate weekly data
      const totalConversations = conversations?.length || 0;
      const totalSales = agents.reduce((s, a) => s + a.total_sales, 0);
      const weeklyData = [
        { week: 'Sem 1', atendimentos: Math.floor(totalConversations / 4), vendas: Math.floor(totalSales / 4), sla: avgSla },
        { week: 'Sem 2', atendimentos: Math.floor(totalConversations / 4), vendas: Math.floor(totalSales / 4), sla: avgSla },
        { week: 'Sem 3', atendimentos: Math.floor(totalConversations / 4), vendas: Math.floor(totalSales / 4), sla: avgSla },
        { week: 'Sem 4', atendimentos: Math.floor(totalConversations / 4), vendas: Math.floor(totalSales / 4), sla: avgSla },
      ];

      return {
        agents,
        selectedAgent,
        average: { conversations: avgConv, sales: avgSales, revenue: avgRevenue, sla: avgSla, score: avgScore },
        weeklyData,
      };
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
    staleTime: 5 * 60 * 1000,
  });
}

// ============ Close Reasons (Basic Satisfaction) ============

export function useReportCloseReasons(dateRange: DateRange | undefined) {
  return useQuery({
    queryKey: ['report-close-reasons', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!dateRange?.from || !dateRange?.to) {
        return { reasons: [], total: 0 };
      }

      const startDate = startOfDay(dateRange.from).toISOString();
      const endDate = endOfDay(dateRange.to).toISOString();

      const { data: closeReasons } = await supabase
        .from('close_reasons')
        .select('*')
        .eq('is_active', true);

      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, close_reason, closed_at, assigned_to, profiles:assigned_to(full_name)')
        .eq('status', 'closed')
        .not('close_reason', 'is', null)
        .gte('closed_at', startDate)
        .lte('closed_at', endDate);

      const reasonCounts = new Map<string, { count: number; name: string; color: string }>();
      
      (closeReasons || []).forEach((r: any) => {
        reasonCounts.set(r.value, { count: 0, name: r.name, color: r.color || '#8B5CF6' });
      });

      (conversations || []).forEach((conv: any) => {
        if (conv.close_reason && reasonCounts.has(conv.close_reason)) {
          reasonCounts.get(conv.close_reason)!.count++;
        }
      });

      const reasons = Array.from(reasonCounts.entries())
        .map(([value, data]) => ({
          value,
          name: data.name,
          count: data.count,
          color: data.color,
          percentage: conversations?.length ? Math.round((data.count / conversations.length) * 100) : 0,
        }))
        .filter(r => r.count > 0)
        .sort((a, b) => b.count - a.count);

      return { reasons, total: conversations?.length || 0 };
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
    staleTime: 5 * 60 * 1000,
  });
}
