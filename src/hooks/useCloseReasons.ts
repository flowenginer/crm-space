import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CloseReason {
  id: string;
  name: string;
  value: string;
  color: string;
  is_active: boolean;
  order_position: number;
  created_at: string;
}

export function useCloseReasons(onlyActive = false) {
  return useQuery({
    queryKey: ['close-reasons', onlyActive],
    queryFn: async () => {
      let query = supabase
        .from('close_reasons')
        .select('*')
        .order('order_position', { ascending: true });
      
      if (onlyActive) {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as CloseReason[];
    },
    staleTime: 60000,
  });
}

export function useCreateCloseReason() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name: string; value: string; color: string }) => {
      // Get max order position
      const { data: existing } = await supabase
        .from('close_reasons')
        .select('order_position')
        .order('order_position', { ascending: false })
        .limit(1)
        .single();
      
      const nextPosition = (existing?.order_position ?? 0) + 1;
      
      const { data: result, error } = await supabase
        .from('close_reasons')
        .insert({
          name: data.name,
          value: data.value,
          color: data.color,
          order_position: nextPosition,
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['close-reasons'] });
      toast.success('Motivo criado com sucesso!');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Já existe um motivo com esse identificador');
      } else {
        toast.error('Erro ao criar motivo');
      }
    },
  });
}

export function useUpdateCloseReason() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { id: string; name?: string; color?: string; is_active?: boolean; order_position?: number }) => {
      const { error } = await supabase
        .from('close_reasons')
        .update({
          ...(data.name !== undefined && { name: data.name }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.is_active !== undefined && { is_active: data.is_active }),
          ...(data.order_position !== undefined && { order_position: data.order_position }),
        })
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['close-reasons'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar motivo');
    },
  });
}

export function useDeleteCloseReason() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('close_reasons')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['close-reasons'] });
      toast.success('Motivo excluído!');
    },
    onError: () => {
      toast.error('Erro ao excluir motivo');
    },
  });
}
