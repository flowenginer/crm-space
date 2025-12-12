import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrentTenantId } from './useTenant';
import type { Json } from '@/integrations/supabase/types';

export interface ProductVariation {
  id: string;
  tenant_id: string | null;
  product_id: string;
  sku: string;
  barcode: string | null;
  attributes: Json;
  attribute_value_ids: string[] | null;
  variation_name: string | null;
  price: number | null;
  price_override: boolean;
  cost_price: number | null;
  weight_kg: number;
  height_cm: number;
  width_cm: number;
  length_cm: number;
  image_url: string | null;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductVariationWithProduct extends ProductVariation {
  product: {
    id: string;
    name: string;
    base_price: number;
  };
}

// Hook para buscar variações de um produto
export function useProductVariations(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-variations', productId],
    queryFn: async () => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from('product_variations')
        .select(`
          *,
          product:products(id, name, base_price)
        `)
        .eq('product_id', productId)
        .order('variation_name', { ascending: true });

      if (error) throw error;
      return data as ProductVariationWithProduct[];
    },
    enabled: !!productId,
  });
}

// Hook para buscar todas as variações (para listagem geral)
export function useAllVariations(filters?: {
  lowStock?: boolean;
  search?: string;
}) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['all-variations', tenantId, filters],
    queryFn: async () => {
      let query = supabase
        .from('product_variations')
        .select(`
          *,
          product:products(id, name, base_price, catalog_id)
        `)
        .order('created_at', { ascending: false });

      if (filters?.lowStock) {
        // Filtrar por estoque baixo - usando raw filter
        query = query.filter('stock_quantity', 'lte', 'low_stock_threshold');
      }

      if (filters?.search) {
        query = query.or(`sku.ilike.%${filters.search}%,variation_name.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ProductVariationWithProduct[];
    },
  });
}

// Hook para criar variação
export function useCreateVariation() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (data: {
      product_id: string;
      sku: string;
      barcode?: string;
      attributes: Record<string, string>;
      attribute_value_ids?: string[];
      variation_name?: string;
      price?: number;
      price_override?: boolean;
      cost_price?: number;
      weight_kg?: number;
      height_cm?: number;
      width_cm?: number;
      length_cm?: number;
      image_url?: string;
      stock_quantity?: number;
      low_stock_threshold?: number;
      is_active?: boolean;
    }) => {
      const { data: result, error } = await supabase
        .from('product_variations')
        .insert({
          tenant_id: tenantId,
          product_id: data.product_id,
          sku: data.sku,
          barcode: data.barcode || null,
          attributes: data.attributes,
          attribute_value_ids: data.attribute_value_ids || [],
          variation_name: data.variation_name || null,
          price: data.price || null,
          price_override: data.price_override ?? false,
          cost_price: data.cost_price || null,
          weight_kg: data.weight_kg || 0,
          height_cm: data.height_cm || 0,
          width_cm: data.width_cm || 0,
          length_cm: data.length_cm || 0,
          image_url: data.image_url || null,
          stock_quantity: data.stock_quantity || 0,
          low_stock_threshold: data.low_stock_threshold || 5,
          is_active: data.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-variations', variables.product_id] });
      queryClient.invalidateQueries({ queryKey: ['all-variations'] });
      toast.success('Variação criada com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error creating variation:', error);
      if (error.message.includes('duplicate')) {
        toast.error('Já existe uma variação com esse SKU');
      } else {
        toast.error('Erro ao criar variação');
      }
    },
  });
}

// Hook para criar múltiplas variações de uma vez
export function useCreateBulkVariations() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (variations: {
      product_id: string;
      sku: string;
      attributes: Record<string, string>;
      attribute_value_ids?: string[];
      variation_name?: string;
      price?: number;
    }[]) => {
      const insertData = variations.map(v => ({
        tenant_id: tenantId,
        product_id: v.product_id,
        sku: v.sku,
        attributes: v.attributes,
        attribute_value_ids: v.attribute_value_ids || [],
        variation_name: v.variation_name || null,
        price: v.price || null,
      }));

      const { error } = await supabase
        .from('product_variations')
        .insert(insertData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variations'] });
      queryClient.invalidateQueries({ queryKey: ['all-variations'] });
      toast.success('Variações criadas com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error creating variations:', error);
      toast.error('Erro ao criar variações');
    },
  });
}

// Hook para atualizar variação
export function useUpdateVariation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<ProductVariation> & { id: string }) => {
      const { error } = await supabase
        .from('product_variations')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variations'] });
      queryClient.invalidateQueries({ queryKey: ['all-variations'] });
      toast.success('Variação atualizada com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error updating variation:', error);
      toast.error('Erro ao atualizar variação');
    },
  });
}

// Hook para deletar variação
export function useDeleteVariation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_variations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variations'] });
      queryClient.invalidateQueries({ queryKey: ['all-variations'] });
      toast.success('Variação excluída com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error deleting variation:', error);
      toast.error('Erro ao excluir variação');
    },
  });
}

// Hook para atualizar estoque (usando a função do banco)
export function useUpdateStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      variationId,
      movementType,
      quantity,
      notes,
    }: {
      variationId: string;
      movementType: string;
      quantity: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc('register_inventory_movement', {
        p_variation_id: variationId,
        p_movement_type: movementType,
        p_quantity: quantity,
        p_notes: notes || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-variations'] });
      queryClient.invalidateQueries({ queryKey: ['all-variations'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      toast.success('Estoque atualizado com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error updating stock:', error);
      toast.error(error.message || 'Erro ao atualizar estoque');
    },
  });
}
