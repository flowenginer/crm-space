import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContactQuote {
  id: string;
  quote_number: string;
  status: string;
  total: number;
  created_at: string;
  valid_until: string | null;
  seller_id: string | null;
  seller_profile?: {
    full_name: string;
  } | null;
}

export interface ContactOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  seller_id: string | null;
  seller_profile?: {
    full_name: string;
  } | null;
}

export function useContactHistory(contactId: string | null) {
  // Fetch quotes for the contact
  const { data: quotes = [], isLoading: isLoadingQuotes } = useQuery({
    queryKey: ['contact-quotes', contactId],
    queryFn: async (): Promise<ContactQuote[]> => {
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          status,
          total,
          created_at,
          valid_until,
          seller_id,
          seller_profile:profiles!quotes_seller_id_fkey(full_name)
        `)
        .eq('contact_id', contactId!)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching contact quotes:', error);
        throw error;
      }

      return (data || []).map(item => ({
        ...item,
        seller_profile: Array.isArray(item.seller_profile) 
          ? item.seller_profile[0] 
          : item.seller_profile
      })) as ContactQuote[];
    },
    enabled: !!contactId,
  });

  // Fetch orders for the contact
  const { data: orders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ['contact-orders', contactId],
    queryFn: async (): Promise<ContactOrder[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          status,
          total,
          created_at,
          seller_id,
          seller_profile:profiles!orders_seller_id_fkey(full_name)
        `)
        .eq('contact_id', contactId!)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching contact orders:', error);
        throw error;
      }

      return (data || []).map(item => ({
        ...item,
        seller_profile: Array.isArray(item.seller_profile) 
          ? item.seller_profile[0] 
          : item.seller_profile
      })) as ContactOrder[];
    },
    enabled: !!contactId,
  });

  // Calculate summary
  const quotesCount = quotes.length;
  const ordersCount = orders.length;
  const completedOrders = orders.filter(o => 
    o.status === 'delivered' || o.status === 'completed'
  );
  const totalPurchased = completedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalOrdered = orders.reduce((sum, o) => sum + (o.total || 0), 0);

  return {
    quotes,
    orders,
    quotesCount,
    ordersCount,
    completedOrdersCount: completedOrders.length,
    totalPurchased,
    totalOrdered,
    isLoading: isLoadingQuotes || isLoadingOrders,
  };
}
