import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustomFieldDefinition {
  id: string;
  name: string;
  field_type: string;
  entity_type: string;
  options: string[] | null;
  is_required: boolean | null;
  order_position: number | null;
  created_at: string;
}

export function useCustomFields(entityType?: string) {
  return useQuery({
    queryKey: ['custom_fields', entityType],
    queryFn: async () => {
      let query = supabase
        .from('custom_field_definitions')
        .select('*')
        .order('order_position');

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as CustomFieldDefinition[];
    },
  });
}

export function useCreateCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (field: Omit<CustomFieldDefinition, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('custom_field_definitions')
        .insert(field)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom_fields'] });
    },
  });
}

export function useUpdateCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...field }: Partial<CustomFieldDefinition> & { id: string }) => {
      const { error } = await supabase
        .from('custom_field_definitions')
        .update(field)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom_fields'] });
    },
  });
}

export function useDeleteCustomField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custom_field_definitions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom_fields'] });
    },
  });
}
