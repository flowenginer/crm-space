import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subMonths, subYears, startOfMonth, endOfMonth } from 'date-fns';
import { useConversionStatusNames } from './useConversionStatusNames';

export interface BusinessKPIFilters {
  dateFrom: Date;
  dateTo: Date;
  agentId?: string;
  departmentId?: string;
  channelId?: string;
}

export interface MarketingKPIs {
  cac: number;
  roi: number;
  conversionRate: number;
  ctr: number;
  spend: number;
  conversions: number;
  leads: number;
}

export interface CommercialKPIs {
  salesConversionRate: number;
  avgTicket: number;
  totalRevenue: number;
  totalOrders: number;
  growthMoM: number;
  growthYoY: number;
  salesByChannel: { channel: string; value: number; orders: number }[];
}

export interface CustomerSuccessKPIs {
  churnRate: number;
  churnedContacts: number;
  reactivationRate: number;
  reactivatedContacts: number;
  nps: number;
  csat: number;
  healthScore: number;
  totalActiveContacts: number;
}

export interface FinancialKPIs {
  totalRevenue: number;
  totalExpenses: number;
  netBalance: number;
  pendingReceivables: number;
  pendingPayables: number;
  operatingMargin: number;
}

export interface HRKPIs {
  activeAgents: number;
  inactiveAgents: number;
  turnoverRate: number;
  avgConversationsPerAgent: number;
  avgResponseTime: number;
}

export interface BusinessKPIsData {
  marketing: MarketingKPIs;
  commercial: CommercialKPIs;
  customerSuccess: CustomerSuccessKPIs;
  financial: FinancialKPIs;
  hr: HRKPIs;
}

// =====================================================
// Marketing KPIs Hook
// =====================================================
export function useMarketingKPIs(filters: BusinessKPIFilters) {
  const { data: conversionStatusNames = [] } = useConversionStatusNames();

  return useQuery({
    queryKey: ['marketing-kpis', filters.dateFrom, filters.dateTo, conversionStatusNames],
    queryFn: async (): Promise<MarketingKPIs> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // 1. Get Meta Ads insights (spend, impressions, clicks)
      const { data: insights } = await supabase
        .from('meta_campaign_insights')
        .select('impressions, clicks, spend')
        .gte('date_start', dateFrom.split('T')[0])
        .lte('date_stop', dateTo.split('T')[0]);

      let totalSpend = 0;
      let totalImpressions = 0;
      let totalClicks = 0;

      insights?.forEach(i => {
        totalSpend += Number(i.spend) || 0;
        totalImpressions += Number(i.impressions) || 0;
        totalClicks += Number(i.clicks) || 0;
      });

      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      // 2. Get leads created in period
      const { count: leadsCount } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      const leads = leadsCount || 0;

      // 3. Get conversions (contacts that reached conversion status)
      let conversions = 0;
      if (conversionStatusNames.length > 0) {
        const { data: conversionData } = await supabase
          .from('lead_status_history')
          .select('contact_id')
          .gte('changed_at', dateFrom)
          .lte('changed_at', dateTo)
          .in('new_status', conversionStatusNames);

        const uniqueContacts = new Set(conversionData?.map(c => c.contact_id) || []);
        conversions = uniqueContacts.size;
      }

      // 4. Get revenue from orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('total')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .eq('status', 'completed');

      const totalRevenue = ordersData?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;

      // Calculate CAC, ROI, Conversion Rate
      const cac = conversions > 0 ? totalSpend / conversions : 0;
      const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
      const conversionRate = leads > 0 ? (conversions / leads) * 100 : 0;

      return {
        cac,
        roi,
        conversionRate,
        ctr,
        spend: totalSpend,
        conversions,
        leads,
      };
    },
    staleTime: 60000,
  });
}

// =====================================================
// Commercial KPIs Hook
// =====================================================
export function useCommercialKPIs(filters: BusinessKPIFilters) {
  const { data: conversionStatusNames = [] } = useConversionStatusNames();

  return useQuery({
    queryKey: ['commercial-kpis', filters.dateFrom, filters.dateTo, conversionStatusNames],
    queryFn: async (): Promise<CommercialKPIs> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Current period orders
      const { data: currentOrders } = await supabase
        .from('orders')
        .select('id, total, channel_id')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .in('status', ['completed', 'paid', 'delivered']);

      const totalOrders = currentOrders?.length || 0;
      const totalRevenue = currentOrders?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;
      const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Get leads count for conversion rate
      const { count: leadsCount } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      const salesConversionRate = (leadsCount || 0) > 0 ? (totalOrders / (leadsCount || 1)) * 100 : 0;

      // Previous month for MoM comparison
      const prevMonthStart = startOfMonth(subMonths(filters.dateFrom, 1)).toISOString();
      const prevMonthEnd = endOfMonth(subMonths(filters.dateFrom, 1)).toISOString();

      const { data: prevMonthOrders } = await supabase
        .from('orders')
        .select('total')
        .gte('created_at', prevMonthStart)
        .lte('created_at', prevMonthEnd)
        .in('status', ['completed', 'paid', 'delivered']);

      const prevMonthRevenue = prevMonthOrders?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;
      const growthMoM = prevMonthRevenue > 0 ? ((totalRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;

      // Previous year for YoY comparison
      const prevYearStart = startOfMonth(subYears(filters.dateFrom, 1)).toISOString();
      const prevYearEnd = endOfMonth(subYears(filters.dateFrom, 1)).toISOString();

      const { data: prevYearOrders } = await supabase
        .from('orders')
        .select('total')
        .gte('created_at', prevYearStart)
        .lte('created_at', prevYearEnd)
        .in('status', ['completed', 'paid', 'delivered']);

      const prevYearRevenue = prevYearOrders?.reduce((sum, o) => sum + (Number(o.total) || 0), 0) || 0;
      const growthYoY = prevYearRevenue > 0 ? ((totalRevenue - prevYearRevenue) / prevYearRevenue) * 100 : 0;

      // Sales by channel
      const { data: channels } = await supabase
        .from('whatsapp_channels')
        .select('id, name');

      const channelMap = new Map(channels?.map(c => [c.id, c.name]) || []);
      const salesByChannelMap: Record<string, { value: number; orders: number }> = {};

      currentOrders?.forEach(order => {
        const channelName = order.channel_id ? channelMap.get(order.channel_id) || 'Outros' : 'Outros';
        if (!salesByChannelMap[channelName]) {
          salesByChannelMap[channelName] = { value: 0, orders: 0 };
        }
        salesByChannelMap[channelName].value += Number(order.total) || 0;
        salesByChannelMap[channelName].orders += 1;
      });

      const salesByChannel = Object.entries(salesByChannelMap).map(([channel, data]) => ({
        channel,
        ...data,
      })).sort((a, b) => b.value - a.value);

      return {
        salesConversionRate,
        avgTicket,
        totalRevenue,
        totalOrders,
        growthMoM,
        growthYoY,
        salesByChannel,
      };
    },
    staleTime: 60000,
  });
}

// =====================================================
// Customer Success KPIs Hook (Churn, Reactivation, NPS)
// =====================================================
export function useCustomerSuccessKPIs(filters: BusinessKPIFilters) {
  return useQuery({
    queryKey: ['customer-success-kpis', filters.dateFrom, filters.dateTo],
    queryFn: async (): Promise<CustomerSuccessKPIs> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Churn status names (customize based on your lead statuses)
      const churnStatusNames = ['Perdido', 'Inativo', 'Cancelado', 'Sem Interesse'];
      const positiveStatusNames = ['Catálogo', 'Orçamento', 'Pedido Fechado', 'Layout', 'Produção'];

      // 1. Get total active contacts at start of period
      const { count: totalActiveContacts } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .lte('created_at', dateTo);

      // 2. Get churned contacts (moved to negative status in period)
      const { data: churnedData } = await supabase
        .from('lead_status_history')
        .select('contact_id')
        .gte('changed_at', dateFrom)
        .lte('changed_at', dateTo)
        .in('new_status', churnStatusNames);

      const churnedContacts = new Set(churnedData?.map(c => c.contact_id) || []).size;
      const churnRate = (totalActiveContacts || 0) > 0 
        ? (churnedContacts / (totalActiveContacts || 1)) * 100 
        : 0;

      // 3. Get reactivated contacts (moved from negative to positive status)
      // First get contacts that were in churn status before the period
      const { data: reactivatedData } = await supabase
        .from('lead_status_history')
        .select('contact_id, new_status, changed_at')
        .gte('changed_at', dateFrom)
        .lte('changed_at', dateTo)
        .in('new_status', positiveStatusNames);

      // Filter to only those that had a previous negative status
      let reactivatedContacts = 0;
      if (reactivatedData && reactivatedData.length > 0) {
        const contactIds = [...new Set(reactivatedData.map(r => r.contact_id))];
        
        for (const contactId of contactIds.slice(0, 100)) { // Limit to avoid too many queries
          const { data: prevHistory } = await supabase
            .from('lead_status_history')
            .select('new_status')
            .eq('contact_id', contactId)
            .lt('changed_at', dateFrom)
            .order('changed_at', { ascending: false })
            .limit(1);

          if (prevHistory?.[0] && churnStatusNames.includes(prevHistory[0].new_status)) {
            reactivatedContacts++;
          }
        }
      }

      const reactivationRate = churnedContacts > 0 
        ? (reactivatedContacts / churnedContacts) * 100 
        : 0;

      // 4. Get NPS from satisfaction surveys (survey_type = 'nps')
      const { data: npsData } = await supabase
        .from('satisfaction_surveys')
        .select('score')
        .eq('survey_type', 'nps')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .not('score', 'is', null);

      let nps = 0;
      if (npsData && npsData.length > 0) {
        const promoters = npsData.filter(s => (s.score || 0) >= 9).length;
        const detractors = npsData.filter(s => (s.score || 0) <= 6).length;
        nps = ((promoters - detractors) / npsData.length) * 100;
      }

      // 5. Get CSAT (survey_type = 'csat')
      const { data: csatData } = await supabase
        .from('satisfaction_surveys')
        .select('score')
        .eq('survey_type', 'csat')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .not('score', 'is', null);

      let csat = 0;
      if (csatData && csatData.length > 0) {
        const satisfied = csatData.filter(s => (s.score || 0) >= 4).length;
        csat = (satisfied / csatData.length) * 100;
      }

      // 6. Calculate Health Score (simplified: based on activity and satisfaction)
      const healthScore = Math.min(100, Math.max(0, 
        (100 - churnRate) * 0.4 + 
        reactivationRate * 0.2 + 
        ((nps + 100) / 2) * 0.2 + 
        csat * 0.2
      ));

      return {
        churnRate: Math.round(churnRate * 10) / 10,
        churnedContacts,
        reactivationRate: Math.round(reactivationRate * 10) / 10,
        reactivatedContacts,
        nps: Math.round(nps),
        csat: Math.round(csat),
        healthScore: Math.round(healthScore),
        totalActiveContacts: totalActiveContacts || 0,
      };
    },
    staleTime: 120000, // 2 minutes - these are heavier queries
  });
}

// =====================================================
// Financial KPIs Hook
// =====================================================
export function useFinancialKPIs(filters: BusinessKPIFilters) {
  return useQuery({
    queryKey: ['financial-kpis', filters.dateFrom, filters.dateTo],
    queryFn: async (): Promise<FinancialKPIs> => {
      const startDate = filters.dateFrom.toISOString().split('T')[0];
      const endDate = filters.dateTo.toISOString().split('T')[0];

      const { data: transactions } = await supabase
        .from('financial_transactions')
        .select('type, status, amount, paid_amount')
        .gte('due_date', startDate)
        .lte('due_date', endDate);

      let totalRevenue = 0;
      let totalExpenses = 0;
      let pendingReceivables = 0;
      let pendingPayables = 0;

      transactions?.forEach(t => {
        const amount = Number(t.amount) || 0;
        const paidAmount = Number(t.paid_amount) || 0;

        if (t.type === 'income') {
          if (t.status === 'paid') {
            totalRevenue += paidAmount;
          } else if (t.status === 'pending' || t.status === 'overdue') {
            pendingReceivables += amount;
          }
        } else if (t.type === 'expense') {
          if (t.status === 'paid') {
            totalExpenses += paidAmount;
          } else if (t.status === 'pending' || t.status === 'overdue') {
            pendingPayables += amount;
          }
        }
      });

      const netBalance = totalRevenue - totalExpenses;
      const operatingMargin = totalRevenue > 0 
        ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 
        : 0;

      return {
        totalRevenue,
        totalExpenses,
        netBalance,
        pendingReceivables,
        pendingPayables,
        operatingMargin: Math.round(operatingMargin * 10) / 10,
      };
    },
    staleTime: 60000,
  });
}

// =====================================================
// HR KPIs Hook
// =====================================================
export function useHRKPIs(filters: BusinessKPIFilters) {
  return useQuery({
    queryKey: ['hr-kpis', filters.dateFrom, filters.dateTo],
    queryFn: async (): Promise<HRKPIs> => {
      const dateFrom = startOfDay(filters.dateFrom).toISOString();
      const dateTo = endOfDay(filters.dateTo).toISOString();

      // Get active and inactive agents
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, is_active, role')
        .in('role', ['agent', 'supervisor', 'admin']);

      const activeAgents = profiles?.filter(p => p.is_active).length || 0;
      const inactiveAgents = profiles?.filter(p => !p.is_active).length || 0;
      const totalAgents = activeAgents + inactiveAgents;
      const turnoverRate = totalAgents > 0 ? (inactiveAgents / totalAgents) * 100 : 0;

      // Get conversations per agent in period
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, assigned_to, first_response_at, created_at')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .not('assigned_to', 'is', null);

      const avgConversationsPerAgent = activeAgents > 0 
        ? (conversations?.length || 0) / activeAgents 
        : 0;

      // Calculate average response time
      let totalResponseTime = 0;
      let responseCount = 0;

      conversations?.forEach(c => {
        if (c.first_response_at && c.created_at) {
          const created = new Date(c.created_at).getTime();
          const responded = new Date(c.first_response_at).getTime();
          if (responded > created) {
            totalResponseTime += (responded - created) / 1000 / 60; // in minutes
            responseCount++;
          }
        }
      });

      const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

      return {
        activeAgents,
        inactiveAgents,
        turnoverRate: Math.round(turnoverRate * 10) / 10,
        avgConversationsPerAgent: Math.round(avgConversationsPerAgent),
        avgResponseTime: Math.round(avgResponseTime * 10) / 10,
      };
    },
    staleTime: 60000,
  });
}

// =====================================================
// Combined Business KPIs Hook
// =====================================================
export function useBusinessKPIs(filters: BusinessKPIFilters) {
  const marketing = useMarketingKPIs(filters);
  const commercial = useCommercialKPIs(filters);
  const customerSuccess = useCustomerSuccessKPIs(filters);
  const financial = useFinancialKPIs(filters);
  const hr = useHRKPIs(filters);

  const isLoading = marketing.isLoading || commercial.isLoading || 
    customerSuccess.isLoading || financial.isLoading || hr.isLoading;

  return {
    data: {
      marketing: marketing.data,
      commercial: commercial.data,
      customerSuccess: customerSuccess.data,
      financial: financial.data,
      hr: hr.data,
    },
    isLoading,
    marketing,
    commercial,
    customerSuccess,
    financial,
    hr,
  };
}
