import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from './useTenant';
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
}

export interface SellerGoalProgress {
  target1: { value: number; bonus: number; progress: number; remaining: number };
  target2: { value: number; bonus: number; progress: number; remaining: number };
  target3: { value: number; bonus: number; progress: number; remaining: number };
  daysRemaining: number;
  dailyTarget: number;
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
}

export function useSellerMetrics(sellerId: string | undefined) {
  const { data: tenantId } = useCurrentTenantId();
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  return useQuery({
    queryKey: ['seller-metrics', sellerId, format(monthStart, 'yyyy-MM')],
    queryFn: async (): Promise<SellerMetrics> => {
      if (!sellerId) throw new Error('Seller ID required');

      // Orders this month
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total, payment_status, created_at')
        .eq('seller_id', sellerId)
        .neq('status', 'canceled')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      if (ordersError) throw ordersError;

      // Get seller commission rate
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('commission_percent')
        .eq('id', sellerId)
        .single();

      if (profileError) throw profileError;

      const commissionRate = (profile?.commission_percent || 0) / 100;

      const totalOrders = orders?.length || 0;
      const totalRevenue = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
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
      const ordersToday = todayOrders.length;
      const revenueToday = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

      return {
        totalOrders,
        totalRevenue,
        averageTicket,
        commission,
        pendingPaymentOrders,
        pendingPaymentValue,
        ordersToday,
        revenueToday,
      };
    },
    enabled: !!sellerId && !!tenantId,
  });
}

export function useSellerGoalProgress(sellerId: string | undefined) {
  const { data: tenantId } = useCurrentTenantId();
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

      // Get total revenue this month
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total')
        .eq('seller_id', sellerId)
        .neq('status', 'canceled')
        .eq('payment_status', 'paid')
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString());

      if (ordersError) throw ordersError;

      const totalRevenue = orders?.reduce((sum, o) => sum + (o.total || 0), 0) || 0;
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
      };
    },
    enabled: !!sellerId && !!tenantId,
  });
}

export function useSellerPendingOrders(sellerId: string | undefined) {
  return useQuery({
    queryKey: ['seller-pending-orders', sellerId],
    queryFn: async (): Promise<PendingOrder[]> => {
      if (!sellerId) throw new Error('Seller ID required');

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total,
          created_at,
          contact:contacts(full_name, phone)
        `)
        .eq('seller_id', sellerId)
        .neq('status', 'canceled')
        .neq('payment_status', 'paid')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (data || []).map(o => ({
        id: o.id,
        order_number: o.order_number,
        contact_name: (o.contact as any)?.full_name || 'Cliente não identificado',
        contact_phone: (o.contact as any)?.phone || '',
        total: o.total || 0,
        created_at: o.created_at,
      }));
    },
    enabled: !!sellerId,
  });
}

export function useSellerOpportunities(sellerId: string | undefined) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  return useQuery({
    queryKey: ['seller-opportunities', sellerId],
    queryFn: async (): Promise<Opportunity[]> => {
      if (!sellerId) throw new Error('Seller ID required');

      // Get contacts with negotiated value that haven't converted yet
      const { data, error } = await supabase
        .from('contacts')
        .select('id, full_name, phone, negotiated_value, lead_status')
        .eq('assigned_to', sellerId)
        .gt('negotiated_value', 0)
        .not('lead_status', 'in', '("Convertido","Fechado","Ganho","Won","Venda")')
        .order('negotiated_value', { ascending: false })
        .limit(10);

      if (error) throw error;

      return (data || []).map(c => ({
        contact_id: c.id,
        contact_name: c.full_name,
        contact_phone: c.phone,
        negotiated_value: c.negotiated_value || 0,
        lead_status: c.lead_status || 'new',
      }));
    },
    enabled: !!sellerId,
  });
}
