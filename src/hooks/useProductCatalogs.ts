import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrentTenantId } from './useTenant';

export interface ProductCatalog {
  id: string;
  tenant_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  is_active: boolean;
  is_default: boolean;
  display_order: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function useProductCatalogs() {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['product-catalogs', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_catalogs')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as ProductCatalog[];
    },
    // RLS handles tenant filtering automatically
  });
}

export function useCreateCatalog() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      slug?: string;
      description?: string;
      cover_image_url?: string;
      is_active?: boolean;
      is_default?: boolean;
    }) => {
      const slug = data.slug || generateSlug(data.name);
      
      const { data: result, error } = await supabase
        .from('product_catalogs')
        .insert({
          tenant_id: tenantId,
          name: data.name,
          slug,
          description: data.description || null,
          cover_image_url: data.cover_image_url || null,
          is_active: data.is_active ?? true,
          is_default: data.is_default ?? false,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-catalogs'] });
      toast.success('Catálogo criado com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error creating catalog:', error);
      if (error.message.includes('duplicate')) {
        toast.error('Já existe um catálogo com esse slug');
      } else {
        toast.error('Erro ao criar catálogo');
      }
    },
  });
}

export function useUpdateCatalog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      name?: string;
      slug?: string;
      description?: string | null;
      cover_image_url?: string | null;
      is_active?: boolean;
      is_default?: boolean;
    }) => {
      const { data: result, error } = await supabase
        .from('product_catalogs')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-catalogs'] });
      toast.success('Catálogo atualizado com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error updating catalog:', error);
      toast.error('Erro ao atualizar catálogo');
    },
  });
}

export function useDeleteCatalog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_catalogs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-catalogs'] });
      toast.success('Catálogo excluído com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error deleting catalog:', error);
      toast.error('Erro ao excluir catálogo');
    },
  });
}

export function useReorderCatalogs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('product_catalogs')
          .update({ display_order: index })
          .eq('id', id)
      );

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) throw errors[0].error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-catalogs'] });
    },
    onError: (error: Error) => {
      console.error('Error reordering catalogs:', error);
      toast.error('Erro ao reordenar catálogos');
    },
  });
}

export function useSetDefaultCatalog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // First, unset all defaults
      await supabase
        .from('product_catalogs')
        .update({ is_default: false })
        .neq('id', id);

      // Then set the new default
      const { error } = await supabase
        .from('product_catalogs')
        .update({ is_default: true })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-catalogs'] });
      toast.success('Catálogo definido como padrão');
    },
    onError: (error: Error) => {
      console.error('Error setting default catalog:', error);
      toast.error('Erro ao definir catálogo padrão');
    },
  });
}
