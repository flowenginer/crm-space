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
  contact?: {
    id: string;
    full_name: string;
    phone: string;
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
  notes?: string;
  shipping_address?: Record<string, unknown>;
  shipping_method?: string;
  items: {
    product_id?: string;
    variation_id?: string;
    product_name: string;
    variation_name?: string;
    sku?: string;
    unit_price: number;
    quantity: number;
    unit_cost?: number;
  }[];
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
      return data as Order[];
    },
    enabled: !!tenantId,
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

      // Criar pedido (tenant_id é gerenciado pelo RLS)
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          contact_id: data.contact_id,
          conversation_id: data.conversation_id,
          channel_id: data.channel_id,
          order_type: data.order_type || 'sale',
          notes: data.notes,
          shipping_address: data.shipping_address,
          shipping_method: data.shipping_method,
          status: 'draft',
        } as any)
        .select()
        .single();

      if (orderError) throw orderError;

      // Criar itens
      if (data.items.length > 0) {
        const items = data.items.map(item => ({
          order_id: order.id,
          product_id: item.product_id,
          variation_id: item.variation_id,
          product_name: item.product_name,
          variation_name: item.variation_name,
          sku: item.sku,
          unit_price: item.unit_price,
          quantity: item.quantity,
          unit_cost: item.unit_cost || 0,
        }));

        const { error: itemsError } = await supabase
          .from('order_items')
          .insert(items as any);

        if (itemsError) throw itemsError;
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
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
