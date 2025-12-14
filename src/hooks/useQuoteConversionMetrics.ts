import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from './useTenant';
import { useMemo } from 'react';
import { subDays, format, differenceInDays, parseISO } from 'date-fns';

export interface ConversionMetrics {
  totalQuotes: number;
  convertedQuotes: number;
  pendingQuotes: number;
  rejectedQuotes: number;
  expiredQuotes: number;
  conversionRate: number;
  totalValue: number;
  convertedValue: number;
  pendingValue: number;
  avgConversionTime: number;
  dailyData: { date: string; created: number; converted: number; value: number }[];
  statusFunnel: { status: string; label: string; count: number; value: number; color: string }[];
  sellerMetrics: { sellerId: string; name: string; quotes: number; converted: number; rate: number; value: number }[];
  recentConversions: {
    id: string;
    quote_number: string;
    contact_name: string;
    total: number;
    converted_at: string;
    order_number?: string;
    conversion_days: number;
  }[];
}

interface UseQuoteConversionMetricsOptions {
  periodDays?: number;
  sellerId?: string;
}

export function useQuoteConversionMetrics(options: UseQuoteConversionMetricsOptions = {}) {
  const { periodDays = 30, sellerId } = options;
  const { data: tenantId } = useCurrentTenantId();

  const startDate = useMemo(() => {
    return subDays(new Date(), periodDays).toISOString();
  }, [periodDays]);

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ['quote-conversion-metrics', tenantId, periodDays, sellerId],
    queryFn: async () => {
      let query = supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          status,
          total,
          created_at,
          converted_at,
          converted_to_order_id,
          seller_id,
          valid_until,
          contact:contacts(id, full_name),
          seller:profiles!quotes_seller_id_fkey(id, full_name)
        `)
        .gte('created_at', startDate)
        .order('created_at', { ascending: false });

      if (sellerId && sellerId !== 'all') {
        query = query.eq('seller_id', sellerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Fetch orders for converted quotes
  const { data: orders = [] } = useQuery({
    queryKey: ['converted-orders', tenantId, periodDays],
    queryFn: async () => {
      const convertedIds = quotes
        .filter(q => q.converted_to_order_id)
        .map(q => q.converted_to_order_id);

      if (convertedIds.length === 0) return [];

      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number')
        .in('id', convertedIds);

      if (error) throw error;
      return data || [];
    },
    enabled: quotes.some(q => q.converted_to_order_id),
  });

  const metrics: ConversionMetrics = useMemo(() => {
    const ordersMap = new Map(orders.map(o => [o.id, o.order_number]));

    // Basic counts
    const totalQuotes = quotes.length;
    const convertedQuotes = quotes.filter(q => q.status === 'converted').length;
    const pendingQuotes = quotes.filter(q => ['draft', 'sent', 'approved'].includes(q.status)).length;
    const rejectedQuotes = quotes.filter(q => q.status === 'rejected').length;
    const expiredQuotes = quotes.filter(q => q.status === 'expired').length;

    // Values
    const totalValue = quotes.reduce((sum, q) => sum + (q.total || 0), 0);
    const convertedValue = quotes
      .filter(q => q.status === 'converted')
      .reduce((sum, q) => sum + (q.total || 0), 0);
    const pendingValue = quotes
      .filter(q => ['draft', 'sent', 'approved'].includes(q.status))
      .reduce((sum, q) => sum + (q.total || 0), 0);

    // Conversion rate
    const conversionRate = totalQuotes > 0 ? (convertedQuotes / totalQuotes) * 100 : 0;

    // Average conversion time (days)
    const convertedWithTime = quotes.filter(q => q.status === 'converted' && q.converted_at && q.created_at);
    const avgConversionTime = convertedWithTime.length > 0
      ? convertedWithTime.reduce((sum, q) => {
          const days = differenceInDays(parseISO(q.converted_at!), parseISO(q.created_at!));
          return sum + days;
        }, 0) / convertedWithTime.length
      : 0;

    // Daily data for chart
    const dailyMap = new Map<string, { created: number; converted: number; value: number }>();
    for (let i = periodDays - 1; i >= 0; i--) {
      const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
      dailyMap.set(date, { created: 0, converted: 0, value: 0 });
    }

    quotes.forEach(q => {
      if (q.created_at) {
        const dateKey = format(parseISO(q.created_at), 'yyyy-MM-dd');
        const day = dailyMap.get(dateKey);
        if (day) {
          day.created++;
        }
      }
      if (q.status === 'converted' && q.converted_at) {
        const dateKey = format(parseISO(q.converted_at), 'yyyy-MM-dd');
        const day = dailyMap.get(dateKey);
        if (day) {
          day.converted++;
          day.value += q.total || 0;
        }
      }
    });

    const dailyData = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));

    // Status funnel
    const statusFunnel = [
      { status: 'draft', label: 'Rascunho', color: 'hsl(var(--muted-foreground))' },
      { status: 'sent', label: 'Enviado', color: 'hsl(var(--info))' },
      { status: 'approved', label: 'Aprovado', color: 'hsl(var(--warning))' },
      { status: 'converted', label: 'Convertido', color: 'hsl(var(--success))' },
      { status: 'rejected', label: 'Rejeitado', color: 'hsl(var(--destructive))' },
    ].map(s => ({
      ...s,
      count: quotes.filter(q => q.status === s.status).length,
      value: quotes.filter(q => q.status === s.status).reduce((sum, q) => sum + (q.total || 0), 0),
    }));

    // Seller metrics
    const sellerMap = new Map<string, { name: string; quotes: number; converted: number; value: number }>();
    quotes.forEach(q => {
      if (q.seller_id && q.seller) {
        const seller = sellerMap.get(q.seller_id) || {
          name: (q.seller as any).full_name || 'Sem nome',
          quotes: 0,
          converted: 0,
          value: 0,
        };
        seller.quotes++;
        if (q.status === 'converted') {
          seller.converted++;
          seller.value += q.total || 0;
        }
        sellerMap.set(q.seller_id, seller);
      }
    });

    const sellerMetrics = Array.from(sellerMap.entries())
      .map(([sellerId, data]) => ({
        sellerId,
        ...data,
        rate: data.quotes > 0 ? (data.converted / data.quotes) * 100 : 0,
      }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5);

    // Recent conversions
    const recentConversions = quotes
      .filter(q => q.status === 'converted')
      .slice(0, 10)
      .map(q => ({
        id: q.id,
        quote_number: q.quote_number,
        contact_name: (q.contact as any)?.full_name || 'Sem cliente',
        total: q.total || 0,
        converted_at: q.converted_at || '',
        order_number: q.converted_to_order_id ? ordersMap.get(q.converted_to_order_id) : undefined,
        conversion_days: q.created_at && q.converted_at
          ? differenceInDays(parseISO(q.converted_at), parseISO(q.created_at))
          : 0,
      }));

    return {
      totalQuotes,
      convertedQuotes,
      pendingQuotes,
      rejectedQuotes,
      expiredQuotes,
      conversionRate,
      totalValue,
      convertedValue,
      pendingValue,
      avgConversionTime,
      dailyData,
      statusFunnel,
      sellerMetrics,
      recentConversions,
    };
  }, [quotes, orders, periodDays]);

  return { metrics, isLoading };
}
