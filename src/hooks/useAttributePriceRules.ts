import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PriceRule {
  id: string;
  product_id: string | null;
  attribute_value_id: string;
  adjustment_type: 'fixed' | 'percentage';
  adjustment_value: number;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface PriceRuleWithDetails extends PriceRule {
  attribute_value: {
    id: string;
    value: string;
    display_value: string | null;
    attribute_type: {
      id: string;
      name: string;
    };
  };
}

// Hook para buscar todas as regras de preço com detalhes
export function usePriceRules() {
  return useQuery({
    queryKey: ['product-price-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_attribute_price_rules')
        .select(`
          *,
          attribute_value:product_attribute_values(
            id,
            value,
            display_value,
            attribute_type:product_attribute_types(id, name)
          )
        `)
        .order('priority', { ascending: false });

      if (error) throw error;
      return data as unknown as PriceRuleWithDetails[];
    },
  });
}

// Hook para criar regra de preço
export function useCreatePriceRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      product_id?: string | null;
      attribute_value_id: string;
      adjustment_type: 'fixed' | 'percentage';
      adjustment_value: number;
      is_active?: boolean;
    }) => {
      const { data: result, error } = await supabase
        .from('product_attribute_price_rules')
        .insert({
          ...data,
          product_id: data.product_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-price-rules'] });
    },
  });
}

// Hook para criar múltiplas regras de preço
export function useCreateBulkPriceRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rules: {
      product_id?: string | null;
      attribute_value_id: string;
      adjustment_type: 'fixed' | 'percentage';
      adjustment_value: number;
      is_active?: boolean;
    }[]) => {
      const { error } = await supabase
        .from('product_attribute_price_rules')
        .insert(rules.map(r => ({
          ...r,
          product_id: r.product_id || null,
        })));

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-price-rules'] });
    },
  });
}

// Hook para atualizar regra de preço
export function useUpdatePriceRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<PriceRule> & { id: string }) => {
      const { error } = await supabase
        .from('product_attribute_price_rules')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-price-rules'] });
    },
  });
}

// Hook para deletar regra de preço
export function useDeletePriceRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_attribute_price_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-price-rules'] });
    },
  });
}

// Hook para toggle status da regra
export function useTogglePriceRuleStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('product_attribute_price_rules')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-price-rules'] });
    },
  });
}
