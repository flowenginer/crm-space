import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OrderStatus {
  id: string;
  name: string;
  value: string;
  color: string;
  icon: string;
  order_position: number;
  is_active: boolean;
  is_final: boolean;
  can_edit_order: boolean;
  created_at: string;
}

export function useOrderStatuses(onlyActive = false) {
  return useQuery({
    queryKey: ['order-statuses', onlyActive],
    queryFn: async () => {
      let query = supabase
        .from('order_statuses')
        .select('*')
        .order('order_position', { ascending: true });
      
      if (onlyActive) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as OrderStatus[];
    },
    staleTime: 60000,
  });
}

export function useCreateOrderStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name: string; value: string; color: string; icon?: string; is_final?: boolean; can_edit_order?: boolean }) => {
      // Get max order position
      const { data: existing } = await supabase
        .from('order_statuses')
        .select('order_position')
        .order('order_position', { ascending: false })
        .limit(1)
        .single();
      
      const nextPosition = (existing?.order_position ?? 0) + 1;
      
      const { data: result, error } = await supabase
        .from('order_statuses')
        .insert({
          name: data.name,
          value: data.value,
          color: data.color,
          icon: data.icon || 'Package',
          is_final: data.is_final || false,
          can_edit_order: data.can_edit_order ?? true,
          order_position: nextPosition,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-statuses'] });
      toast.success('Status criado com sucesso!');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Já existe um status com esse identificador');
      } else {
        toast.error('Erro ao criar status');
      }
    },
  });
}

export function useUpdateOrderStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { 
      id: string; 
      name?: string; 
      color?: string; 
      icon?: string;
      is_active?: boolean; 
      is_final?: boolean;
      can_edit_order?: boolean;
      order_position?: number 
    }) => {
      const { id, ...updates } = data;
      const { error } = await supabase
        .from('order_statuses')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-statuses'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });
}

export function useDeleteOrderStatus() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('order_statuses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-statuses'] });
      toast.success('Status excluído!');
    },
    onError: () => {
      toast.error('Erro ao excluir status. Verifique se não há pedidos usando este status.');
    },
  });
}

export function useReorderOrderStatuses() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (items: { id: string; order_position: number }[]) => {
      const updates = items.map(item =>
        supabase
          .from('order_statuses')
          .update({ order_position: item.order_position })
          .eq('id', item.id)
      );
      
      const results = await Promise.all(updates);
      const error = results.find(r => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-statuses'] });
    },
    onError: () => {
      toast.error('Erro ao reordenar status');
    },
  });
}
