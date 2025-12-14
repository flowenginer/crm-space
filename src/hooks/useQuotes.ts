import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from './useTenant';
import { toast } from 'sonner';

export interface Quote {
  id: string;
  tenant_id: string | null;
  quote_number: string;
  contact_id: string | null;
  conversation_id: string | null;
  channel_id: string | null;
  status: string;
  subtotal: number | null;
  discount_amount: number | null;
  discount_percent: number | null;
  shipping_cost: number | null;
  total: number | null;
  payment_method: string | null;
  installments: number | null;
  shipping_method: string | null;
  shipping_address: Record<string, unknown> | null;
  expected_delivery_date: string | null;
  seller_id: string | null;
  store_id: string | null;
  notes: string | null;
  internal_notes: string | null;
  valid_until: string | null;
  converted_to_order_id: string | null;
  converted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  contact?: {
    id: string;
    full_name: string;
    phone: string;
    email?: string;
  };
}

export interface QuoteItem {
  id: string;
  tenant_id: string | null;
  quote_id: string;
  product_id: string | null;
  variation_id: string | null;
  product_name: string;
  variation_name: string | null;
  sku: string | null;
  unit_price: number;
  quantity: number;
  discount_amount: number | null;
  discount_percent: number | null;
  subtotal: number | null;
  created_at: string | null;
}

export interface CreateQuoteData {
  contact_id?: string;
  conversation_id?: string;
  channel_id?: string;
  notes?: string;
  internal_notes?: string;
  shipping_address?: Record<string, unknown>;
  shipping_method?: string;
  shipping_cost?: number;
  expected_delivery_date?: string;
  payment_method?: string;
  payment_condition?: string;
  installments?: number;
  down_payment_type?: string;
  down_payment_value?: number;
  store_id?: string;
  seller_id?: string;
  discount_amount?: number;
  discount_percent?: number;
  valid_until?: string;
  items: {
    product_id?: string;
    variation_id?: string;
    product_name: string;
    variation_name?: string;
    sku?: string;
    unit_price: number;
    quantity: number;
    discount_amount?: number;
    discount_percent?: number;
  }[];
}

export interface QuoteFilters {
  status?: string;
  contact_id?: string;
  seller_id?: string;
  date_from?: string;
  date_to?: string;
  min_total?: number;
  max_total?: number;
}

export function useQuotes(filters?: { status?: string; contact_id?: string }) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['quotes', tenantId, filters],
    queryFn: async () => {
      let query = supabase
        .from('quotes')
        .select(`
          *,
          contact:contacts(id, full_name, phone)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.contact_id) {
        query = query.eq('contact_id', filters.contact_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!tenantId,
  });
}

export function useQuotesAdvanced(filters: QuoteFilters) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['quotes-advanced', tenantId, filters],
    queryFn: async () => {
      let query = supabase
        .from('quotes')
        .select(`
          *,
          contact:contacts(id, full_name, phone)
        `)
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      
      if (filters.contact_id) {
        query = query.eq('contact_id', filters.contact_id);
      }

      if (filters.seller_id && filters.seller_id !== 'all') {
        query = query.eq('seller_id', filters.seller_id);
      }

      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from + 'T00:00:00');
      }

      if (filters.date_to) {
        query = query.lte('created_at', filters.date_to + 'T23:59:59');
      }

      if (filters.min_total !== undefined && filters.min_total > 0) {
        query = query.gte('total', filters.min_total);
      }

      if (filters.max_total !== undefined && filters.max_total > 0) {
        query = query.lte('total', filters.max_total);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Quote[];
    },
    enabled: !!tenantId,
  });
}

export function useQuote(quoteId: string | null) {
  return useQuery({
    queryKey: ['quote', quoteId],
    queryFn: async () => {
      if (!quoteId) return null;
      
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          contact:contacts(id, full_name, phone, email)
        `)
        .eq('id', quoteId)
        .single();

      if (error) throw error;
      return data as Quote;
    },
    enabled: !!quoteId,
  });
}

export function useQuoteItems(quoteId: string | null) {
  return useQuery({
    queryKey: ['quote-items', quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      
      const { data, error } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at');

      if (error) throw error;
      return data as QuoteItem[];
    },
    enabled: !!quoteId,
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (data: CreateQuoteData) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      // Gerar número do orçamento
      const { data: quoteNumber, error: numError } = await supabase
        .rpc('generate_quote_number', { p_tenant_id: tenantId });

      if (numError) throw numError;

      // Calcular subtotal e total
      const itemsSubtotal = data.items.reduce((sum, item) => {
        const itemTotal = item.unit_price * item.quantity;
        const itemDiscount = item.discount_percent 
          ? itemTotal * (item.discount_percent / 100)
          : (item.discount_amount || 0);
        return sum + (itemTotal - itemDiscount);
      }, 0);

      const totalDiscount = data.discount_percent 
        ? itemsSubtotal * (data.discount_percent / 100)
        : (data.discount_amount || 0);

      const total = itemsSubtotal - totalDiscount + (data.shipping_cost || 0);

      // Criar orçamento (SEM lançamento financeiro)
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          tenant_id: tenantId,
          quote_number: quoteNumber,
          contact_id: data.contact_id,
          conversation_id: data.conversation_id,
          channel_id: data.channel_id,
          notes: data.notes,
          internal_notes: data.internal_notes,
          shipping_address: data.shipping_address,
          shipping_method: data.shipping_method,
          shipping_cost: data.shipping_cost || 0,
          expected_delivery_date: data.expected_delivery_date || null,
          payment_method: data.payment_method,
          payment_condition: data.payment_condition || 'full',
          installments: data.installments || 1,
          down_payment_type: data.down_payment_type || 'percent',
          down_payment_value: data.down_payment_value || 0,
          store_id: data.store_id || null,
          seller_id: data.seller_id || null,
          discount_amount: data.discount_amount || 0,
          discount_percent: data.discount_percent || 0,
          subtotal: itemsSubtotal,
          total: total,
          valid_until: data.valid_until || null,
          status: 'draft',
        } as any)
        .select()
        .single();

      if (quoteError) throw quoteError;

      // Criar itens
      if (data.items.length > 0) {
        const items = data.items.map(item => ({
          tenant_id: tenantId,
          quote_id: quote.id,
          product_id: item.product_id,
          variation_id: item.variation_id,
          product_name: item.product_name,
          variation_name: item.variation_name,
          sku: item.sku,
          unit_price: item.unit_price,
          quantity: item.quantity,
          discount_amount: item.discount_amount || 0,
          discount_percent: item.discount_percent || 0,
          subtotal: item.unit_price * item.quantity - (item.discount_amount || 0),
        }));

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(items as any);

        if (itemsError) throw itemsError;
      }

      // Atualizar valor negociado e status de lead do contato automaticamente
      if (data.contact_id) {
        await supabase
          .from('contacts')
          .update({ 
            negotiated_value: total > 0 ? total : undefined,
            lead_status: '05 - Orçamento',
            updated_at: new Date().toISOString()
          })
          .eq('id', data.contact_id);
      }

      return quote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-for-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      toast.success('Orçamento criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar orçamento: ' + error.message);
    },
  });
}

export function useUpdateQuoteStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quoteId, status }: { 
      quoteId: string; 
      status: string;
    }) => {
      const { error } = await supabase
        .from('quotes')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', quoteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote'] });
      toast.success('Status atualizado');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });
}

export function useUpdateQuote() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({ quoteId, data }: { quoteId: string; data: CreateQuoteData }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      // Calcular subtotal e total
      const itemsSubtotal = data.items.reduce((sum, item) => {
        const itemTotal = item.unit_price * item.quantity;
        const itemDiscount = item.discount_percent 
          ? itemTotal * (item.discount_percent / 100)
          : (item.discount_amount || 0);
        return sum + (itemTotal - itemDiscount);
      }, 0);

      const totalDiscount = data.discount_percent 
        ? itemsSubtotal * (data.discount_percent / 100)
        : (data.discount_amount || 0);

      const total = itemsSubtotal - totalDiscount + (data.shipping_cost || 0);

      // Atualizar orçamento
      const { error: quoteError } = await supabase
        .from('quotes')
        .update({
          contact_id: data.contact_id,
          conversation_id: data.conversation_id,
          channel_id: data.channel_id,
          notes: data.notes,
          internal_notes: data.internal_notes,
          shipping_address: data.shipping_address,
          shipping_method: data.shipping_method,
          shipping_cost: data.shipping_cost || 0,
          expected_delivery_date: data.expected_delivery_date || null,
          payment_method: data.payment_method,
          payment_condition: data.payment_condition || 'full',
          installments: data.installments || 1,
          down_payment_type: data.down_payment_type || 'percent',
          down_payment_value: data.down_payment_value || 0,
          store_id: data.store_id || null,
          seller_id: data.seller_id || null,
          discount_amount: data.discount_amount || 0,
          discount_percent: data.discount_percent || 0,
          subtotal: itemsSubtotal,
          total: total,
          valid_until: data.valid_until || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', quoteId);

      if (quoteError) throw quoteError;

      // Deletar itens antigos
      const { error: deleteError } = await supabase
        .from('quote_items')
        .delete()
        .eq('quote_id', quoteId);

      if (deleteError) throw deleteError;

      // Criar novos itens
      if (data.items.length > 0) {
        const items = data.items.map(item => ({
          tenant_id: tenantId,
          quote_id: quoteId,
          product_id: item.product_id,
          variation_id: item.variation_id,
          product_name: item.product_name,
          variation_name: item.variation_name,
          sku: item.sku,
          unit_price: item.unit_price,
          quantity: item.quantity,
          discount_amount: item.discount_amount || 0,
          discount_percent: item.discount_percent || 0,
          subtotal: item.unit_price * item.quantity - (item.discount_amount || 0),
        }));

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(items as any);

        if (itemsError) throw itemsError;
      }

      // Atualizar valor negociado se for o orçamento mais recente
      if (data.contact_id && total > 0) {
        const { data: latestQuote } = await supabase
          .from('quotes')
          .select('id')
          .eq('contact_id', data.contact_id)
          .neq('status', 'canceled')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (latestQuote?.id === quoteId) {
          await supabase
            .from('contacts')
            .update({ 
              negotiated_value: total,
              updated_at: new Date().toISOString()
            })
            .eq('id', data.contact_id);
        }
      }

      return { id: quoteId, contact_id: data.contact_id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote'] });
      queryClient.invalidateQueries({ queryKey: ['quote-items'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-for-kanban'] });
      toast.success('Orçamento atualizado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar orçamento: ' + error.message);
    },
  });
}

export function useConvertQuoteToOrder() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (quoteId: string) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      // Buscar orçamento
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();

      if (quoteError) throw quoteError;
      if (!quote) throw new Error('Orçamento não encontrado');

      // Buscar itens do orçamento
      const { data: quoteItems, error: itemsError } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId);

      if (itemsError) throw itemsError;

      // Gerar número do pedido (sequencial)
      const { data: orderNumber, error: numError } = await supabase
        .rpc('generate_order_number', { p_tenant_id: tenantId });

      if (numError) throw numError;

      // Criar pedido
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          contact_id: quote.contact_id,
          conversation_id: quote.conversation_id,
          channel_id: quote.channel_id,
          order_type: 'sale',
          notes: quote.notes,
          internal_notes: quote.internal_notes,
          shipping_address: quote.shipping_address,
          shipping_method: quote.shipping_method,
          shipping_cost: quote.shipping_cost || 0,
          expected_delivery_date: quote.expected_delivery_date,
          payment_method: quote.payment_method,
          installments: quote.installments || 1,
          store_id: quote.store_id,
          seller_id: quote.seller_id,
          discount_amount: quote.discount_amount || 0,
          discount_percent: quote.discount_percent || 0,
          subtotal: quote.subtotal,
          total: quote.total,
          status: 'pending',
          payment_status: 'pending',
        } as any)
        .select()
        .single();

      if (orderError) throw orderError;

      // Copiar itens para o pedido
      if (quoteItems && quoteItems.length > 0) {
        const orderItems = quoteItems.map(item => ({
          order_id: order.id,
          product_id: item.product_id,
          variation_id: item.variation_id,
          product_name: item.product_name,
          variation_name: item.variation_name,
          sku: item.sku,
          unit_price: item.unit_price,
          quantity: item.quantity,
          discount_amount: item.discount_amount || 0,
          discount_percent: item.discount_percent || 0,
          subtotal: item.subtotal,
        }));

        const { error: orderItemsError } = await supabase
          .from('order_items')
          .insert(orderItems as any);

        if (orderItemsError) throw orderItemsError;
      }

      // Criar transação financeira
      if ((quote.total || 0) > 0) {
        const { error: transactionError } = await supabase
          .from('financial_transactions')
          .insert({
            tenant_id: tenantId,
            type: 'income',
            description: `Pedido #${orderNumber} (convertido do orçamento ${quote.quote_number})`,
            amount: quote.total,
            due_date: new Date().toISOString().split('T')[0],
            status: 'pending',
            paid_amount: 0,
            contact_id: quote.contact_id || null,
            order_id: order.id,
            total_installments: quote.installments || 1,
          } as any);

        if (transactionError) console.error('Error creating financial transaction:', transactionError);
      }

      // Atualizar orçamento como convertido
      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          status: 'converted',
          converted_to_order_id: order.id,
          converted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      if (updateError) throw updateError;

      // Atualizar valor negociado e status de lead do contato com o valor do pedido
      if (quote.contact_id) {
        await supabase
          .from('contacts')
          .update({ 
            negotiated_value: (order.total || 0) > 0 ? order.total : undefined,
            lead_status: '07 - Pedido Fechado',
            updated_at: new Date().toISOString()
          })
          .eq('id', quote.contact_id);
      }

      return { order, quote };
    },
    onSuccess: ({ order }) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quote'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contacts-for-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      toast.success(`Orçamento convertido para Pedido #${order.order_number}`);
    },
    onError: (error) => {
      toast.error('Erro ao converter orçamento: ' + error.message);
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId);

      if (error) throw error;
      return quoteId;
    },
    onMutate: async (quoteId) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ['quotes'] });
      await queryClient.cancelQueries({ queryKey: ['quotes-advanced'] });
      
      // Snapshot do estado atual para rollback
      const previousQuotes = queryClient.getQueryData(['quotes']);
      const previousAdvancedQueries = queryClient.getQueriesData({ queryKey: ['quotes-advanced'] });
      
      // Atualização otimista - remover imediatamente de todas as queries
      queryClient.setQueriesData({ queryKey: ['quotes'] }, (old: Quote[] | undefined) => 
        old?.filter(q => q.id !== quoteId) || []
      );
      queryClient.setQueriesData({ queryKey: ['quotes-advanced'] }, (old: Quote[] | undefined) => 
        old?.filter(q => q.id !== quoteId) || []
      );
      
      return { previousQuotes, previousAdvancedQueries };
    },
    onError: (error, quoteId, context) => {
      // Rollback em caso de erro
      if (context?.previousQuotes) {
        queryClient.setQueryData(['quotes'], context.previousQuotes);
      }
      if (context?.previousAdvancedQueries) {
        context.previousAdvancedQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast.error('Erro ao excluir orçamento: ' + error.message);
    },
    onSettled: () => {
      // Invalidar para sincronizar com o servidor
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes-advanced'] });
      queryClient.invalidateQueries({ queryKey: ['quote'] });
    },
    onSuccess: () => {
      toast.success('Orçamento excluído');
    },
  });
}
