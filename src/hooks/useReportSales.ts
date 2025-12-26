import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, format, differenceInDays, subDays } from 'date-fns';

interface DateRange {
  from: Date;
  to: Date;
}

export interface SalesAgentData {
  rank: number;
  agent_id: string;
  name: string;
  avatar_url: string | null;
  orders_count: number;
  revenue: number;
  avg_ticket: number;
  leads_assigned: number;
  win_rate: number;
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
  percentage: number;
}

interface SalesFunnelStage {
  stage: string;
  count: number;
  percentage: number;
  color: string;
}

interface SalesFilters {
  sellerId?: string;
  origin?: string;
  statusId?: string;
}

export interface SalesReportData {
  sellers: SalesAgentData[];
  timeline: SalesTimeline[];
  totalRevenue: number;
  totalConversions: number;
  myStats: SalesAgentData | null;
  conversionRate: number;
  avgCycleDays: number;
  avgTicket: number;
  byOrigin: SalesByOrigin[];
  funnel: SalesFunnelStage[];
  // New global metrics
  revenueGrowth: number;
  revenueGrowthDirection: 'up' | 'down' | 'neutral';
  pipelineVelocity: number;
  winRate: number;
  previousRevenue: number;
  projectedRevenue: number;
  highestSale: number;
  totalLeads: number;
  // Available filter options
  availableSellers: { id: string; name: string }[];
  availableOrigins: string[];
}

export function useReportSales(
  dateRange: DateRange | undefined, 
  userId?: string, 
  canViewAll?: boolean,
  filters?: SalesFilters
) {
  return useQuery({
    queryKey: [
      'report-sales-crm', 
      dateRange?.from?.toISOString(), 
      dateRange?.to?.toISOString(), 
      userId, 
      canViewAll,
      filters?.sellerId,
      filters?.origin,
      filters?.statusId
    ],
    queryFn: async (): Promise<SalesReportData> => {
      if (!dateRange?.from || !dateRange?.to) {
        return getEmptyData();
      }

      const startDate = startOfDay(dateRange.from).toISOString();
      const endDate = endOfDay(dateRange.to).toISOString();
      
      // Calculate previous period for comparison
      const daysDiff = differenceInDays(dateRange.to, dateRange.from) + 1;
      const prevStartDate = startOfDay(subDays(dateRange.from, daysDiff)).toISOString();
      const prevEndDate = endOfDay(subDays(dateRange.from, 1)).toISOString();

      // Fetch company settings
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('conversion_status_ids, gamification_source')
        .single();

      const conversionStatusIds: string[] = companySettings?.conversion_status_ids || [];
      const gamificationSource = companySettings?.gamification_source || 'crm';

      // If ERP mode, use orders table (legacy behavior)
      if (gamificationSource === 'erp') {
        return fetchERPData(startDate, endDate, prevStartDate, prevEndDate, userId, filters);
      }

      // CRM mode: fetch from contacts
      // First get conversion status names from IDs
      const { data: conversionStatuses } = await supabase
        .from('lead_statuses')
        .select('id, name')
        .in('id', conversionStatusIds);

      const conversionStatusNames = conversionStatuses?.map(s => s.name) || [];

      // Fetch all lead statuses for funnel
      const { data: allStatuses } = await supabase
        .from('lead_statuses')
        .select('id, name, color')
        .order('name');

      // Fetch converted contacts in period
      let convertedQuery = supabase
        .from('contacts')
        .select(`
          id,
          assigned_to,
          negotiated_value,
          origin,
          first_contact_at,
          updated_at,
          lead_status,
          profiles:assigned_to(id, full_name, avatar_url)
        `)
        .in('lead_status', conversionStatusNames)
        .gte('updated_at', startDate)
        .lte('updated_at', endDate);

      // Apply filters
      if (filters?.sellerId) {
        convertedQuery = convertedQuery.eq('assigned_to', filters.sellerId);
      }
      if (filters?.origin) {
        convertedQuery = convertedQuery.eq('origin', filters.origin);
      }

      const { data: convertedContacts } = await convertedQuery;

      // Fetch previous period conversions
      const { data: prevConversions } = await supabase
        .from('contacts')
        .select('id, negotiated_value')
        .in('lead_status', conversionStatusNames)
        .gte('updated_at', prevStartDate)
        .lte('updated_at', prevEndDate);

      // Fetch total leads for conversion rate
      let leadsQuery = supabase
        .from('contacts')
        .select('id', { count: 'exact' })
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (filters?.sellerId) {
        leadsQuery = leadsQuery.eq('assigned_to', filters.sellerId);
      }
      if (filters?.origin) {
        leadsQuery = leadsQuery.eq('origin', filters.origin);
      }

      const { count: totalLeadsCount } = await leadsQuery;

      // Fetch leads by status for funnel
      const { data: funnelData } = await supabase
        .from('contacts')
        .select('lead_status')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('lead_status', 'is', null);

      // Fetch available sellers for filter
      const { data: sellersData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');

      // Calculate metrics
      const totalLeads = totalLeadsCount || 0;
      const totalConversions = convertedContacts?.length || 0;
      const totalRevenue = convertedContacts?.reduce((sum, c) => sum + (c.negotiated_value || 0), 0) || 0;
      const avgTicket = totalConversions > 0 ? Math.round(totalRevenue / totalConversions) : 0;
      const conversionRate = totalLeads > 0 ? Math.round((totalConversions / totalLeads) * 100) : 0;

      // Previous period metrics
      const previousRevenue = prevConversions?.reduce((sum, c) => sum + (c.negotiated_value || 0), 0) || 0;
      const revenueGrowth = previousRevenue > 0 
        ? Math.round(((totalRevenue - previousRevenue) / previousRevenue) * 100)
        : totalRevenue > 0 ? 100 : 0;
      const revenueGrowthDirection: 'up' | 'down' | 'neutral' = 
        revenueGrowth > 0 ? 'up' : revenueGrowth < 0 ? 'down' : 'neutral';

      // Calculate avg cycle days
      let totalCycleDays = 0;
      let cycleCount = 0;
      convertedContacts?.forEach(c => {
        if (c.first_contact_at && c.updated_at) {
          const cycleDays = differenceInDays(new Date(c.updated_at), new Date(c.first_contact_at));
          if (cycleDays >= 0 && cycleDays < 365) {
            totalCycleDays += cycleDays;
            cycleCount++;
          }
        }
      });
      const avgCycleDays = cycleCount > 0 ? Math.round(totalCycleDays / cycleCount * 10) / 10 : 0;

      // Pipeline Velocity: (Conversions × Avg Ticket × Win Rate) / Avg Cycle
      const winRateDecimal = conversionRate / 100;
      const pipelineVelocity = avgCycleDays > 0 
        ? Math.round((totalConversions * avgTicket * winRateDecimal) / avgCycleDays)
        : 0;

      // Projected revenue (based on current velocity)
      const daysElapsed = differenceInDays(new Date(), dateRange.from) + 1;
      const dailyAvg = daysElapsed > 0 ? totalRevenue / daysElapsed : 0;
      const projectedRevenue = Math.round(dailyAvg * daysDiff);

      // Highest sale
      const highestSale = convertedContacts?.reduce((max, c) => 
        Math.max(max, c.negotiated_value || 0), 0) || 0;

      // Aggregate by seller
      const sellerMap = new Map<string, {
        agent_id: string;
        name: string;
        avatar_url: string | null;
        orders_count: number;
        revenue: number;
        leads_assigned: number;
      }>();

      // Count leads assigned to each seller
      const { data: leadsAssigned } = await supabase
        .from('contacts')
        .select('assigned_to')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .not('assigned_to', 'is', null);

      const leadsAssignedMap = new Map<string, number>();
      leadsAssigned?.forEach(l => {
        const id = l.assigned_to;
        leadsAssignedMap.set(id!, (leadsAssignedMap.get(id!) || 0) + 1);
      });

      (convertedContacts || []).forEach((contact: any) => {
        if (contact.assigned_to && contact.profiles) {
          const sellerId = contact.assigned_to;
          if (!sellerMap.has(sellerId)) {
            sellerMap.set(sellerId, {
              agent_id: sellerId,
              name: contact.profiles.full_name || 'Sem nome',
              avatar_url: contact.profiles.avatar_url,
              orders_count: 0,
              revenue: 0,
              leads_assigned: leadsAssignedMap.get(sellerId) || 0,
            });
          }
          const seller = sellerMap.get(sellerId)!;
          seller.orders_count++;
          seller.revenue += contact.negotiated_value || 0;
        }
      });

      const sellers: SalesAgentData[] = Array.from(sellerMap.values())
        .map((s) => ({
          rank: 0,
          ...s,
          avg_ticket: s.orders_count > 0 ? Math.round(s.revenue / s.orders_count) : 0,
          win_rate: s.leads_assigned > 0 ? Math.round((s.orders_count / s.leads_assigned) * 100) : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .map((s, idx) => ({ ...s, rank: idx + 1 }));

      // Timeline by day
      const timelineMap = new Map<string, { vendas: number; quantidade: number }>();
      (convertedContacts || []).forEach((contact: any) => {
        const dateKey = format(new Date(contact.updated_at), 'dd/MM');
        if (!timelineMap.has(dateKey)) {
          timelineMap.set(dateKey, { vendas: 0, quantidade: 0 });
        }
        const t = timelineMap.get(dateKey)!;
        t.vendas += contact.negotiated_value || 0;
        t.quantidade++;
      });

      const timeline = Array.from(timelineMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Sales by origin
      const originMap = new Map<string, { count: number; revenue: number }>();
      (convertedContacts || []).forEach((contact: any) => {
        const origin = formatOrigin(contact.origin);
        if (!originMap.has(origin)) {
          originMap.set(origin, { count: 0, revenue: 0 });
        }
        const o = originMap.get(origin)!;
        o.count++;
        o.revenue += contact.negotiated_value || 0;
      });

      const byOrigin: SalesByOrigin[] = Array.from(originMap.entries())
        .map(([origin, data]) => ({
          origin,
          count: data.count,
          revenue: data.revenue,
          percentage: totalConversions > 0 ? Math.round((data.count / totalConversions) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Sales funnel
      const funnelStatusMap = new Map<string, number>();
      (funnelData || []).forEach((contact: any) => {
        const status = contact.lead_status;
        funnelStatusMap.set(status, (funnelStatusMap.get(status) || 0) + 1);
      });

      // Define funnel stages (ordered)
      const funnelStageColors = [
        '#3B82F6', // blue
        '#8B5CF6', // purple
        '#EC4899', // pink
        '#F59E0B', // amber
        '#10B981', // green
        '#06B6D4', // cyan
      ];

      const funnel: SalesFunnelStage[] = [];
      const statusOrder = ['01 - Não respondeu', '02 - Pré-venda', '03 - Catálogo', '04 - Layout', '05 - Orçamento', '06 - Aguardando pagamento', '07 - Pedido Fechado'];
      
      statusOrder.forEach((status, idx) => {
        const count = funnelStatusMap.get(status) || 0;
        funnel.push({
          stage: status.replace(/^\d+\s*-\s*/, ''), // Remove number prefix
          count,
          percentage: totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0,
          color: funnelStageColors[idx % funnelStageColors.length],
        });
      });

      // Get unique origins for filter
      const availableOrigins = Array.from(new Set(
        (convertedContacts || []).map((c: any) => c.origin).filter(Boolean)
      ));

      const myStats = userId ? sellers.find(s => s.agent_id === userId) || null : null;

      return {
        sellers,
        timeline,
        totalRevenue,
        totalConversions,
        myStats,
        conversionRate,
        avgCycleDays,
        avgTicket,
        byOrigin,
        funnel,
        revenueGrowth: Math.abs(revenueGrowth),
        revenueGrowthDirection,
        pipelineVelocity,
        winRate: conversionRate,
        previousRevenue,
        projectedRevenue,
        highestSale,
        totalLeads,
        availableSellers: sellersData?.map(s => ({ id: s.id, name: s.full_name || 'Sem nome' })) || [],
        availableOrigins,
      };
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
    staleTime: 5 * 60 * 1000,
  });
}

function formatOrigin(origin: string | null): string {
  if (!origin) return 'Orgânico';
  const originMap: Record<string, string> = {
    'meta_ads': 'Meta Ads',
    'organic': 'Orgânico',
    'whatsapp': 'WhatsApp',
    'linktree': 'Linktree',
    'site': 'Site',
    'manual': 'Manual',
    'n8n': 'Automação',
  };
  return originMap[origin.toLowerCase()] || origin;
}

function getEmptyData(): SalesReportData {
  return {
    sellers: [],
    timeline: [],
    totalRevenue: 0,
    totalConversions: 0,
    myStats: null,
    conversionRate: 0,
    avgCycleDays: 0,
    avgTicket: 0,
    byOrigin: [],
    funnel: [],
    revenueGrowth: 0,
    revenueGrowthDirection: 'neutral',
    pipelineVelocity: 0,
    winRate: 0,
    previousRevenue: 0,
    projectedRevenue: 0,
    highestSale: 0,
    totalLeads: 0,
    availableSellers: [],
    availableOrigins: [],
  };
}

// Legacy ERP mode (orders table)
async function fetchERPData(
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string,
  userId?: string,
  filters?: SalesFilters
): Promise<SalesReportData> {
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
    .eq('order_type', 'order')
    .neq('status', 'canceled')
    .gte('created_at', startDate)
    .lte('created_at', endDate);

  if (filters?.sellerId) {
    query = query.eq('seller_id', filters.sellerId);
  }

  const { data: orders } = await query;

  // Previous period
  const { data: prevOrders } = await supabase
    .from('orders')
    .select('id, total')
    .eq('order_type', 'order')
    .neq('status', 'canceled')
    .gte('created_at', prevStartDate)
    .lte('created_at', prevEndDate);

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
      leads_assigned: 0,
      win_rate: 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .map((s, idx) => ({ ...s, rank: idx + 1 }));

  const timeline = Array.from(timelineMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalRevenue = sellers.reduce((s, a) => s + a.revenue, 0);
  const totalConversions = sellers.reduce((s, a) => s + a.orders_count, 0);
  const previousRevenue = prevOrders?.reduce((s, o) => s + (o.total || 0), 0) || 0;
  
  const revenueGrowth = previousRevenue > 0 
    ? Math.round(((totalRevenue - previousRevenue) / previousRevenue) * 100)
    : totalRevenue > 0 ? 100 : 0;

  const myStats = userId ? sellers.find(s => s.agent_id === userId) || null : null;

  return {
    sellers,
    timeline,
    totalRevenue,
    totalConversions,
    myStats,
    conversionRate: 0,
    avgCycleDays: 0,
    avgTicket: totalConversions > 0 ? Math.round(totalRevenue / totalConversions) : 0,
    byOrigin: [],
    funnel: [],
    revenueGrowth: Math.abs(revenueGrowth),
    revenueGrowthDirection: revenueGrowth > 0 ? 'up' : revenueGrowth < 0 ? 'down' : 'neutral',
    pipelineVelocity: 0,
    winRate: 0,
    previousRevenue,
    projectedRevenue: 0,
    highestSale: 0,
    totalLeads: 0,
    availableSellers: [],
    availableOrigins: [],
  };
}
