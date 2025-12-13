import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from './useTenant';
import { toast } from 'sonner';

export interface Order {
  id: string;
  tenant_id: string | null;
  order_number: string;
  contact_id: string | null;
  conversation_id: string | null;
  channel_id: string | null;
  status: string;
  payment_status: string | null;
  fulfillment_status: string | null;
  order_type: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  discount_percent: number | null;
  shipping_cost: number | null;
  tax_amount: number | null;
  total: number | null;
  payment_method: string | null;
  paid_amount: number | null;
  paid_at: string | null;
  shipping_method: string | null;
  shipping_address: Record<string, unknown> | null;
  tracking_code: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  assigned_to: string | null;
  notes: string | null;
  internal_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  canceled_at: string | null;
  canceled_reason: string | null;
  is_free_shipping?: boolean | null;
  contact?: {
    id: string;
    full_name: string;
    phone: string;
    cpf_cnpj?: string | null;
    zip_code?: string | null;
    street?: string | null;
    number?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
  };
}

export interface OrderItem {
  id: string;
  tenant_id: string | null;
  order_id: string;
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
  unit_cost: number | null;
  fulfilled_quantity: number | null;
  created_at: string | null;
}

export interface CreateOrderData {
  contact_id?: string;
  conversation_id?: string;
  channel_id?: string;
  order_type?: string;
  order_date?: string; // Format: 'yyyy-MM-dd', allows retroactive dates
  notes?: string;
  internal_notes?: string;
  shipping_address?: Record<string, unknown>;
  shipping_method?: string;
  shipping_cost?: number;
  is_free_shipping?: boolean;
  expected_delivery_date?: string;
  payment_method?: string;
  payment_condition?: string;
  installments?: number;
  down_payment_type?: string;
  down_payment_value?: number;
  paid_amount?: number;
  store_id?: string;
  seller_id?: string;
  discount_amount?: number;
  discount_percent?: number;
  items: {
    product_id?: string;
    variation_id?: string;
    product_name: string;
    variation_name?: string;
    sku?: string;
    unit_price: number;
    quantity: number;
    unit_cost?: number;
    discount_amount?: number;
    discount_percent?: number;
  }[];
}

export interface OrderFilters {
  status?: string;
  contact_id?: string;
  assigned_to?: string;
  payment_status?: string;
  payment_method?: string;
  date_from?: string;
  date_to?: string;
  min_total?: number;
  max_total?: number;
  has_discount?: boolean;
  has_conversation?: boolean;
  shipping_method?: string;
  // Novos filtros
  store_id?: string;
  order_type?: string;
  fulfillment_status?: string;
  installments?: string;
  has_tracking?: boolean;
  expected_delivery_from?: string;
  expected_delivery_to?: string;
  use_order_date?: boolean;
  payment_condition?: string;
}

export function useOrders(filters?: { status?: string; contact_id?: string }) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['orders', tenantId, filters],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          contact:contacts(id, full_name, phone, cpf_cnpj, zip_code, street, number, neighborhood, city, state)
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
      return data as Order[];
    },
    enabled: !!tenantId,
  });
}

// Hook avançado com todos os filtros
export function useOrdersAdvanced(filters: OrderFilters) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['orders-advanced', tenantId, filters],
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select(`
          *,
          contact:contacts(id, full_name, phone, cpf_cnpj, zip_code, street, number, neighborhood, city, state)
        `)
        .order('created_at', { ascending: false });

      // Filtro por status
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }
      
      // Filtro por contact_id
      if (filters.contact_id) {
        query = query.eq('contact_id', filters.contact_id);
      }

      // Filtro por vendedor
      if (filters.assigned_to && filters.assigned_to !== 'all') {
        query = query.eq('assigned_to', filters.assigned_to);
      }

      // Filtro por status de pagamento
      if (filters.payment_status && filters.payment_status !== 'all') {
        query = query.eq('payment_status', filters.payment_status);
      }

      // Filtro por forma de pagamento
      if (filters.payment_method && filters.payment_method !== 'all') {
        query = query.eq('payment_method', filters.payment_method);
      }

      // Filtro por método de entrega
      if (filters.shipping_method && filters.shipping_method !== 'all') {
        query = query.eq('shipping_method', filters.shipping_method);
      }

      // Filtro por data inicial (usa order_date ou created_at)
      const dateField = filters.use_order_date ? 'order_date' : 'created_at';
      if (filters.date_from) {
        if (filters.use_order_date) {
          query = query.gte(dateField, filters.date_from);
        } else {
          query = query.gte(dateField, filters.date_from + 'T00:00:00');
        }
      }

      // Filtro por data final
      if (filters.date_to) {
        if (filters.use_order_date) {
          query = query.lte(dateField, filters.date_to);
        } else {
          query = query.lte(dateField, filters.date_to + 'T23:59:59');
        }
      }

      // Filtro por valor mínimo
      if (filters.min_total !== undefined && filters.min_total > 0) {
        query = query.gte('total', filters.min_total);
      }

      // Filtro por valor máximo
      if (filters.max_total !== undefined && filters.max_total > 0) {
        query = query.lte('total', filters.max_total);
      }

      // Filtro por desconto
      if (filters.has_discount) {
        query = query.or('discount_amount.gt.0,discount_percent.gt.0');
      }

      // Filtro por conversa vinculada
      if (filters.has_conversation) {
        query = query.not('conversation_id', 'is', null);
      }

      // Filtro por loja
      if (filters.store_id && filters.store_id !== 'all') {
        query = query.eq('store_id', filters.store_id);
      }

      // Filtro por tipo de pedido
      if (filters.order_type && filters.order_type !== 'all') {
        query = query.eq('order_type', filters.order_type);
      }

      // Filtro por status de fulfillment
      if (filters.fulfillment_status && filters.fulfillment_status !== 'all') {
        query = query.eq('fulfillment_status', filters.fulfillment_status);
      }

      // Filtro por parcelas
      if (filters.installments && filters.installments !== 'all') {
        if (filters.installments === '4+') {
          query = query.gte('installments', 4);
        } else {
          query = query.eq('installments', parseInt(filters.installments));
        }
      }

      // Filtro por código de rastreio
      if (filters.has_tracking) {
        query = query.not('tracking_code', 'is', null);
      }

      // Filtro por previsão de entrega
      if (filters.expected_delivery_from) {
        query = query.gte('expected_delivery_date', filters.expected_delivery_from);
      }
      if (filters.expected_delivery_to) {
        query = query.lte('expected_delivery_date', filters.expected_delivery_to);
      }

      // Filtro por condição de pagamento
      if (filters.payment_condition && filters.payment_condition !== 'all') {
        query = query.eq('payment_condition', filters.payment_condition);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Order[];
    },
    enabled: !!tenantId,
  });
}

// Hook para contar pedidos por contato (identificar primeira compra)
export function useContactOrderCounts(contactIds: string[]) {
  return useQuery({
    queryKey: ['contact-order-counts', contactIds],
    queryFn: async () => {
      if (contactIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('orders')
        .select('contact_id')
        .in('contact_id', contactIds)
        .neq('status', 'canceled');

      if (error) throw error;
      
      // Contar pedidos por contato
      const counts: Record<string, number> = {};
      data?.forEach(order => {
        if (order.contact_id) {
          counts[order.contact_id] = (counts[order.contact_id] || 0) + 1;
        }
      });
      
      return counts;
    },
    enabled: contactIds.length > 0,
  });
}

// Hook para obter a posição cronológica de cada pedido por contato
export function useContactOrderPositions(orderIds: string[], contactIds: string[]) {
  return useQuery({
    queryKey: ['contact-order-positions', orderIds, contactIds],
    queryFn: async () => {
      if (contactIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('orders')
        .select('id, contact_id, created_at')
        .in('contact_id', contactIds)
        .neq('status', 'canceled')
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Calcular a posição de cada pedido por contato
      const positions: Record<string, number> = {};
      const contactCounters: Record<string, number> = {};
      
      data?.forEach(order => {
        if (order.contact_id) {
          contactCounters[order.contact_id] = (contactCounters[order.contact_id] || 0) + 1;
          positions[order.id] = contactCounters[order.contact_id];
        }
      });
      
      return positions;
    },
    enabled: contactIds.length > 0 && orderIds.length > 0,
  });
}

export function useOrder(orderId: string | null) {
  return useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          contact:contacts(id, full_name, phone, email)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data as Order;
    },
    enabled: !!orderId,
  });
}

export function useOrderItems(orderId: string | null) {
  return useQuery({
    queryKey: ['order-items', orderId],
    queryFn: async () => {
      if (!orderId) return [];
      
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at');

      if (error) throw error;
      return data as OrderItem[];
    },
    enabled: !!orderId,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (data: CreateOrderData) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      // Gerar número do pedido
      const { data: orderNumber, error: numError } = await supabase
        .rpc('generate_order_number', { p_tenant_id: tenantId });

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

      // Determinar status de pagamento
      const paidAmount = data.paid_amount || 0;
      let paymentStatus = 'pending';
      if (paidAmount >= total) {
        paymentStatus = 'paid';
      } else if (paidAmount > 0) {
        paymentStatus = 'partial';
      }

      // Criar pedido
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          tenant_id: tenantId,
          order_number: orderNumber,
          order_date: data.order_date || new Date().toISOString().split('T')[0],
          contact_id: data.contact_id,
          conversation_id: data.conversation_id,
          channel_id: data.channel_id,
          order_type: data.order_type || 'sale',
          notes: data.notes,
          internal_notes: data.internal_notes,
          shipping_address: data.shipping_address,
          shipping_method: data.shipping_method,
          shipping_cost: data.is_free_shipping ? 0 : (data.shipping_cost || 0),
          is_free_shipping: data.is_free_shipping || false,
          expected_delivery_date: data.expected_delivery_date || null,
          payment_method: data.payment_method,
          payment_condition: data.payment_condition || 'full',
          installments: data.installments || 1,
          down_payment_type: data.down_payment_type || 'percent',
          down_payment_value: data.down_payment_value || 0,
          paid_amount: paidAmount,
          paid_at: paidAmount > 0 ? new Date().toISOString() : null,
          payment_status: paymentStatus,
          store_id: data.store_id || null,
          seller_id: data.seller_id || null,
          discount_amount: data.discount_amount || 0,
          discount_percent: data.discount_percent || 0,
          subtotal: itemsSubtotal,
          total: total,
          status: 'pending',
        } as any)
        .select()
        .single();

      if (orderError) throw orderError;

      // Criar itens
      if (data.items.length > 0) {
        const items = data.items.map(item => ({
          tenant_id: tenantId,
          order_id: order.id,
          product_id: item.product_id,
          variation_id: item.variation_id,
          product_name: item.product_name,
          variation_name: item.variation_name,
          sku: item.sku,
          unit_price: item.unit_price,
          quantity: item.quantity,
          unit_cost: item.unit_cost || 0,
          discount_amount: item.discount_amount || 0,
          discount_percent: item.discount_percent || 0,
          // subtotal é calculado automaticamente pelo banco (STORED GENERATED)
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(items as any);

        if (itemsError) throw itemsError;
      }

      // Criar parcelas de pagamento se usar cartão de crédito com parcelas
      const installments = data.installments || 1;
      if (installments > 1 && data.payment_method === 'credit_card') {
        const installmentValue = total / installments;
        const payments = [];
        const today = new Date();

        for (let i = 0; i < installments; i++) {
          const dueDate = new Date(today);
          dueDate.setMonth(dueDate.getMonth() + i);

          payments.push({
            tenant_id: tenantId,
            order_id: order.id,
            amount: installmentValue,
            payment_method: data.payment_method,
            installment_number: i + 1,
            due_date: dueDate.toISOString().split('T')[0],
            status: i === 0 && paidAmount >= installmentValue ? 'paid' : 'pending',
            paid_at: i === 0 && paidAmount >= installmentValue ? new Date().toISOString() : null,
          });
        }

        const { error: paymentsError } = await supabase
          .from('order_payments')
          .insert(payments as any);

        if (paymentsError) console.error('Error creating payments:', paymentsError);
      }

      // Criar transação financeira (contas a receber)
      if (total > 0) {
        const { error: transactionError } = await supabase
          .from('financial_transactions')
          .insert({
            tenant_id: tenantId,
            type: 'income',
            description: `Pedido #${orderNumber}`,
            amount: total,
            due_date: new Date().toISOString().split('T')[0],
            status: paymentStatus === 'paid' ? 'paid' : 'pending',
            paid_amount: paidAmount,
            paid_at: paymentStatus === 'paid' ? new Date().toISOString() : null,
            contact_id: data.contact_id || null,
            order_id: order.id,
            total_installments: installments,
          } as any);

        if (transactionError) console.error('Error creating financial transaction:', transactionError);
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      toast.success('Pedido criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar pedido: ' + error.message);
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status, canceledReason }: { 
      orderId: string; 
      status: string;
      canceledReason?: string;
    }) => {
      const updateData: Record<string, unknown> = { status };
      
      if (status === 'canceled') {
        updateData.canceled_at = new Date().toISOString();
        updateData.canceled_reason = canceledReason;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      toast.success('Status atualizado');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar status: ' + error.message);
    },
  });
}

export function useAddOrderItem() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (data: {
      order_id: string;
      product_id?: string;
      variation_id?: string;
      product_name: string;
      variation_name?: string;
      sku?: string;
      unit_price: number;
      quantity: number;
      unit_cost?: number;
    }) => {
      const { error } = await supabase
        .from('order_items')
        .insert({
          ...data,
        } as any);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['order-items', variables.order_id] });
      queryClient.invalidateQueries({ queryKey: ['order', variables.order_id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useRemoveOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, orderId }: { itemId: string; orderId: string }) => {
      const { error } = await supabase
        .from('order_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      return { orderId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['order-items', data.orderId] });
      queryClient.invalidateQueries({ queryKey: ['order', data.orderId] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useUpdateOrderPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, paymentMethod, paidAmount }: {
      orderId: string;
      paymentMethod: string;
      paidAmount: number;
    }) => {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_method: paymentMethod,
          paid_amount: paidAmount,
          paid_at: paidAmount > 0 ? new Date().toISOString() : null,
          payment_status: paidAmount > 0 ? 'paid' : 'pending',
        })
        .eq('id', orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      toast.success('Pagamento registrado');
    },
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      // 1. Deletar transações financeiras relacionadas
      const { error: financialError } = await supabase
        .from('financial_transactions')
        .delete()
        .eq('order_id', orderId);
      if (financialError) throw financialError;

      // 2. Deletar pagamentos do pedido
      const { error: paymentsError } = await supabase
        .from('order_payments')
        .delete()
        .eq('order_id', orderId);
      if (paymentsError) throw paymentsError;

      // 3. Deletar histórico de status
      const { error: historyError } = await supabase
        .from('order_status_history')
        .delete()
        .eq('order_id', orderId);
      if (historyError) throw historyError;

      // 4. Deletar itens do pedido
      const { error: itemsError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);
      if (itemsError) throw itemsError;

      // 5. Finalmente, deletar o pedido
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders-advanced'] });
      queryClient.invalidateQueries({ queryKey: ['financial-transactions'] });
      toast.success('Pedido excluído com sucesso');
    },
    onError: (error) => {
      console.error('Erro ao excluir pedido:', error);
      toast.error('Erro ao excluir pedido');
    },
  });
}
