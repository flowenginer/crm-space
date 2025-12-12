import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, format, differenceInDays, startOfDay, endOfDay } from 'date-fns';

export interface SellerMetrics {
  totalOrders: number;
  totalRevenue: number;
  averageTicket: number;
  commission: number;
  pendingPaymentOrders: number;
  pendingPaymentValue: number;
  ordersToday: number;
  revenueToday: number;
  // CRM-based metrics
  contactsInPipeline: number;
  pipelineValue: number;
  conversions: number;
}

export interface SellerGoalProgress {
  target1: { value: number; bonus: number; progress: number; remaining: number };
  target2: { value: number; bonus: number; progress: number; remaining: number };
  target3: { value: number; bonus: number; progress: number; remaining: number };
  daysRemaining: number;
  dailyTarget: number;
  totalRevenue: number;
}

export interface PendingOrder {
  id: string;
  order_number: string;
  contact_name: string;
  contact_phone: string;
  total: number;
  created_at: string;
}

export interface Opportunity {
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  negotiated_value: number;
  lead_status: string;
  last_interaction_at: string | null;
}

export interface PipelineStage {
  status: string;
  label: string;
  count: number;
  value: number;
  color: string;
}

// Lead statuses that represent closed/won deals
const CLOSED_STATUSES = [
  '07 - Pedido Fechado',
  '08 - Em andamento',
  '10 - Aguardando envio',
  '11 - Pedido Enviado',
  '12 - Entregue',
  '13 - Recompra',
];

// Lead statuses that represent active opportunities (hot leads)
const OPPORTUNITY_STATUSES = [
  '05 - Orçamento',
  '06 - Aguardando pagamento',
];

// All active pipeline statuses for tracking
const PIPELINE_STAGES = [
  { status: '06 - Aguardando pagamento', label: 'Aguardando Pagamento', color: 'warning' },
  { status: '05 - Orçamento', label: 'Em Orçamento', color: 'primary' },
  { status: '04 - Layout', label: 'Layout', color: 'blue' },
  { status: '03 - Catálogo', label: 'Catálogo', color: 'purple' },
  { status: '02 - Pré-venda', label: 'Pré-venda', color: 'muted' },
];

export function useSellerMetrics(sellerId: string | undefined) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  return useQuery({
    queryKey: ['seller-metrics', sellerId, format(monthStart, 'yyyy-MM')],
    queryFn: async (): Promise<SellerMetrics> => {
      if (!sellerId) throw new Error('Seller ID required');

      // Get seller commission rate
      const { data: profile } = await supabase
        .from('profiles')
        .select('commission_percent')
        .eq('id', sellerId)
        .single();

      const commissionRate = (profile?.commission_percent || 0) / 100;

      // Try to get orders data
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total, payment_status, created_at')
        .eq('seller_id', sellerId)
        .neq('status', 'canceled')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      // Get CRM-based metrics (contacts that converted this month)
      const { data: conversions } = await supabase
        .from('contacts')
        .select('id, negotiated_value, lead_status, updated_at')
        .eq('assigned_to', sellerId)
        .in('lead_status', CLOSED_STATUSES)
        .gte('updated_at', monthStart.toISOString())
        .lte('updated_at', monthEnd.toISOString());

      // Get contacts in active pipeline
      const { data: pipelineContacts } = await supabase
        .from('contacts')
        .select('id, negotiated_value')
        .eq('assigned_to', sellerId)
        .in('lead_status', OPPORTUNITY_STATUSES);

      const totalOrders = orders?.length || 0;
      const orderRevenue = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
      
      // Use CRM conversions as backup if no orders
      const crmRevenue = conversions?.reduce((sum, c) => sum + (c.negotiated_value || 0), 0) || 0;
      const totalRevenue = orderRevenue > 0 ? orderRevenue : crmRevenue;
      
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : (conversions?.length || 0) > 0 ? crmRevenue / (conversions?.length || 1) : 0;
      const commission = totalRevenue * commissionRate;

      // Pending payment orders
      const pendingOrders = orders?.filter(o => o.payment_status !== 'paid') || [];
      const pendingPaymentOrders = pendingOrders.length;
      const pendingPaymentValue = pendingOrders.reduce((sum, o) => sum + (o.total || 0), 0);

      // Orders today
      const todayOrders = orders?.filter(o => {
        const orderDate = new Date(o.created_at);
        return orderDate >= todayStart && orderDate <= todayEnd;
      }) || [];

      // CRM metrics
      const contactsInPipeline = pipelineContacts?.length || 0;
      const pipelineValue = pipelineContacts?.reduce((sum, c) => sum + (c.negotiated_value || 0), 0) || 0;

      return {
        totalOrders: totalOrders || conversions?.length || 0,
        totalRevenue,
        averageTicket,
        commission,
        pendingPaymentOrders,
        pendingPaymentValue,
        ordersToday: todayOrders.length,
        revenueToday: todayOrders.reduce((sum, o) => sum + (o.total || 0), 0),
        contactsInPipeline,
        pipelineValue,
        conversions: conversions?.length || 0,
      };
    },
    enabled: !!sellerId,
  });
}

export function useSellerGoalProgress(sellerId: string | undefined) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  return useQuery({
    queryKey: ['seller-goal-progress', sellerId, format(monthStart, 'yyyy-MM')],
    queryFn: async (): Promise<SellerGoalProgress> => {
      if (!sellerId) throw new Error('Seller ID required');

      // Get seller targets
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('sales_target_1, sales_target_2, sales_target_3, bonus_target_1, bonus_target_2, bonus_target_3')
        .eq('id', sellerId)
        .single();

      if (profileError) throw profileError;

      // Get total revenue from orders this month (paid only)
      const { data: orders } = await supabase
        .from('orders')
        .select('total')
        .eq('seller_id', sellerId)
        .neq('status', 'canceled')
        .eq('payment_status', 'paid')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      // Also get CRM conversions as backup
      const { data: conversions } = await supabase
        .from('contacts')
        .select('negotiated_value')
        .eq('assigned_to', sellerId)
        .in('lead_status', CLOSED_STATUSES)
        .gte('updated_at', monthStart.toISOString())
        .lte('updated_at', monthEnd.toISOString());

      const orderRevenue = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
      const crmRevenue = conversions?.reduce((sum, c) => sum + (c.negotiated_value || 0), 0) || 0;
      const totalRevenue = orderRevenue > 0 ? orderRevenue : crmRevenue;
      
      const daysRemaining = differenceInDays(monthEnd, now) + 1;

      const calculateProgress = (target: number) => {
        if (!target || target === 0) return { value: 0, bonus: 0, progress: 0, remaining: 0 };
        const progress = Math.min((totalRevenue / target) * 100, 100);
        const remaining = Math.max(target - totalRevenue, 0);
        return { value: target, bonus: 0, progress, remaining };
      };

      const target1 = calculateProgress(profile?.sales_target_1 || 0);
      target1.bonus = profile?.bonus_target_1 || 0;

      const target2 = calculateProgress(profile?.sales_target_2 || 0);
      target2.bonus = profile?.bonus_target_2 || 0;

      const target3 = calculateProgress(profile?.sales_target_3 || 0);
      target3.bonus = profile?.bonus_target_3 || 0;

      // Calculate daily target to hit target1
      const remaining1 = Math.max((profile?.sales_target_1 || 0) - totalRevenue, 0);
      const dailyTarget = daysRemaining > 0 ? remaining1 / daysRemaining : 0;

      return {
        target1,
        target2,
        target3,
        daysRemaining,
        dailyTarget,
        totalRevenue,
      };
    },
    enabled: !!sellerId,
  });
}

export function useSellerPendingOrders(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['seller-pending-orders', sellerId],
    queryFn: async (): Promise<PendingOrder[]> => {
      if (!sellerId) throw new Error('Seller ID required');

      // Get contacts awaiting payment from CRM (lead_status = '06 - Aguardando pagamento')
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id, full_name, phone, negotiated_value, updated_at')
        .eq('assigned_to', sellerId)
        .eq('lead_status', '06 - Aguardando pagamento')
        .gt('negotiated_value', 0)
        .order('updated_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (contacts || []).map((c, index) => ({
        id: c.id,
        order_number: `#${String(index + 1).padStart(3, '0')}`,
        contact_name: c.full_name || 'Cliente não identificado',
        contact_phone: c.phone || '',
        total: c.negotiated_value || 0,
        created_at: c.updated_at,
      }));
    },
    enabled: !!sellerId,
  });
}

export function useSellerOpportunities(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['seller-opportunities', sellerId],
    queryFn: async (): Promise<Opportunity[]> => {
      if (!sellerId) throw new Error('Seller ID required');

      // Get contacts in hot opportunity stages
      const { data, error } = await supabase
        .from('contacts')
        .select('id, full_name, phone, negotiated_value, lead_status, last_interaction_at')
        .eq('assigned_to', sellerId)
        .gt('negotiated_value', 0)
        .in('lead_status', ['05 - Orçamento', '04 - Layout'])
        .order('negotiated_value', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (data || []).map(c => ({
        contact_id: c.id,
        contact_name: c.full_name,
        contact_phone: c.phone,
        negotiated_value: c.negotiated_value || 0,
        lead_status: c.lead_status || 'new',
        last_interaction_at: c.last_interaction_at,
      }));
    },
    enabled: !!sellerId,
  });
}

export function useSellerPipeline(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['seller-pipeline', sellerId],
    queryFn: async (): Promise<PipelineStage[]> => {
      if (!sellerId) throw new Error('Seller ID required');

      const results: PipelineStage[] = [];

      for (const stage of PIPELINE_STAGES) {
        const { data, error } = await supabase
          .from('contacts')
          .select('id, negotiated_value')
          .eq('assigned_to', sellerId)
          .eq('lead_status', stage.status);

        if (error) throw error;

        const count = data?.length || 0;
        const value = data?.reduce((sum, c) => sum + (c.negotiated_value || 0), 0) || 0;

        results.push({
          status: stage.status,
          label: stage.label,
          count,
          value,
          color: stage.color,
        });
      }

      return results;
    },
    enabled: !!sellerId,
  });
}

export function useSellers() {
  return useQuery({
    queryKey: ['sellers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['vendedor', 'admin', 'supervisor'])
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      return data || [];
    },
    staleTime: 300000,
  });
}
