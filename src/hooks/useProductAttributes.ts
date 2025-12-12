import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface AttributeType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  is_required: boolean;
  allow_multiple: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttributeValue {
  id: string;
  attribute_type_id: string;
  value: string;
  display_value: string | null;
  slug: string;
  display_order: number;
  is_active: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface AttributeTypeWithValues extends AttributeType {
  values: AttributeValue[];
}

// Hook para buscar todos os tipos de atributos com seus valores
export function useAttributeTypes() {
  return useQuery({
    queryKey: ['product-attribute-types'],
    queryFn: async () => {
      const { data: types, error: typesError } = await supabase
        .from('product_attribute_types')
        .select('*')
        .order('display_order');

      if (typesError) throw typesError;

      const { data: values, error: valuesError } = await supabase
        .from('product_attribute_values')
        .select('*')
        .order('display_order');

      if (valuesError) throw valuesError;

      // Map values to their types
      const typesWithValues = (types || []).map((type) => ({
        ...type,
        values: (values || []).filter((v) => v.attribute_type_id === type.id),
      }));

      return typesWithValues as AttributeTypeWithValues[];
    },
  });
}

// Hook para criar tipo de atributo
export function useCreateAttributeType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      slug: string;
      description?: string;
      is_required?: boolean;
      allow_multiple?: boolean;
      is_active?: boolean;
    }) => {
      // Get max display_order
      const { data: maxOrder } = await supabase
        .from('product_attribute_types')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      const { data: result, error } = await supabase
        .from('product_attribute_types')
        .insert({
          ...data,
          display_order: (maxOrder?.display_order || 0) + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-attribute-types'] });
    },
  });
}

// Hook para atualizar tipo de atributo
export function useUpdateAttributeType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<AttributeType> & { id: string }) => {
      const { error } = await supabase
        .from('product_attribute_types')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-attribute-types'] });
    },
  });
}

// Hook para deletar tipo de atributo
export function useDeleteAttributeType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_attribute_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-attribute-types'] });
    },
  });
}

// Hook para reordenar tipos de atributos
export function useReorderAttributeTypes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { id: string; display_order: number }[]) => {
      const updates = items.map(({ id, display_order }) =>
        supabase
          .from('product_attribute_types')
          .update({ display_order })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-attribute-types'] });
    },
  });
}

// Hook para criar valor de atributo
export function useCreateAttributeValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      attribute_type_id: string;
      value: string;
      display_value?: string;
      slug: string;
    }) => {
      // Get max display_order for this type
      const { data: maxOrder } = await supabase
        .from('product_attribute_values')
        .select('display_order')
        .eq('attribute_type_id', data.attribute_type_id)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      const { data: result, error } = await supabase
        .from('product_attribute_values')
        .insert({
          ...data,
          display_order: (maxOrder?.display_order || 0) + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-attribute-types'] });
    },
  });
}

// Hook para criar múltiplos valores
export function useCreateBulkAttributeValues() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      attribute_type_id,
      values,
    }: {
      attribute_type_id: string;
      values: { value: string; slug: string }[];
    }) => {
      // Get max display_order for this type
      const { data: maxOrder } = await supabase
        .from('product_attribute_values')
        .select('display_order')
        .eq('attribute_type_id', attribute_type_id)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      let currentOrder = (maxOrder?.display_order || 0) + 1;

      const insertData = values.map((v) => ({
        attribute_type_id,
        value: v.value,
        slug: v.slug,
        display_order: currentOrder++,
      }));

      const { error } = await supabase
        .from('product_attribute_values')
        .insert(insertData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-attribute-types'] });
    },
  });
}

// Hook para atualizar valor de atributo
export function useUpdateAttributeValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: { id: string; value?: string; display_value?: string | null; slug?: string; is_active?: boolean }) => {
      const { error } = await supabase
        .from('product_attribute_values')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-attribute-types'] });
    },
  });
}

// Hook para deletar valor de atributo
export function useDeleteAttributeValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_attribute_values')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-attribute-types'] });
    },
  });
}

// Hook para reordenar valores de atributos
export function useReorderAttributeValues() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { id: string; display_order: number }[]) => {
      const updates = items.map(({ id, display_order }) =>
        supabase
          .from('product_attribute_values')
          .update({ display_order })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-attribute-types'] });
    },
  });
}

// Utility: Generate slug from text
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}
