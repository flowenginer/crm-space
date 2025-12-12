import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrentTenantId } from './useTenant';
import type { Json } from '@/integrations/supabase/types';

export interface Product {
  id: string;
  tenant_id: string | null;
  catalog_id: string | null;
  name: string;
  slug: string | null;
  description: string | null;
  short_description: string | null;
  base_price: number;
  cost_price: number | null;
  compare_at_price: number | null;
  main_image_url: string | null;
  gallery_images: Json;
  is_active: boolean;
  is_featured: boolean;
  has_variations: boolean;
  track_inventory: boolean;
  tags: string[] | null;
  display_order: number;
  metadata: Json;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ProductWithCatalog extends Product {
  catalog: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// Hook para buscar todos os produtos
export function useProducts(filters?: {
  catalogId?: string;
  isActive?: boolean;
  search?: string;
}) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['products', tenantId, filters],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          catalog:product_catalogs(id, name, slug)
        `)
        .order('display_order', { ascending: true });

      if (filters?.catalogId) {
        query = query.eq('catalog_id', filters.catalogId);
      }

      if (filters?.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ProductWithCatalog[];
    },
  });
}

// Hook para buscar um produto específico
export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          catalog:product_catalogs(id, name, slug)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as ProductWithCatalog;
    },
    enabled: !!id,
  });
}

// Hook para criar produto
export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      slug?: string;
      catalog_id?: string;
      description?: string;
      short_description?: string;
      base_price: number;
      cost_price?: number;
      compare_at_price?: number;
      main_image_url?: string;
      gallery_images?: string[];
      is_active?: boolean;
      is_featured?: boolean;
      has_variations?: boolean;
      track_inventory?: boolean;
      tags?: string[];
    }) => {
      const slug = data.slug || generateSlug(data.name);

      const { data: result, error } = await supabase
        .from('products')
        .insert({
          tenant_id: tenantId,
          name: data.name,
          slug,
          catalog_id: data.catalog_id || null,
          description: data.description || null,
          short_description: data.short_description || null,
          base_price: data.base_price,
          cost_price: data.cost_price || null,
          compare_at_price: data.compare_at_price || null,
          main_image_url: data.main_image_url || null,
          gallery_images: data.gallery_images || [],
          is_active: data.is_active ?? true,
          is_featured: data.is_featured ?? false,
          has_variations: data.has_variations ?? true,
          track_inventory: data.track_inventory ?? false,
          tags: data.tags || [],
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto criado com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error creating product:', error);
      if (error.message.includes('duplicate')) {
        toast.error('Já existe um produto com esse slug');
      } else {
        toast.error('Erro ao criar produto');
      }
    },
  });
}

// Hook para atualizar produto
export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<Product> & { id: string }) => {
      const { error } = await supabase
        .from('products')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', variables.id] });
      toast.success('Produto atualizado com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error updating product:', error);
      toast.error('Erro ao atualizar produto');
    },
  });
}

// Hook para deletar produto
export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto excluído com sucesso');
    },
    onError: (error: Error) => {
      console.error('Error deleting product:', error);
      toast.error('Erro ao excluir produto');
    },
  });
}

// Hook para toggle status do produto
export function useToggleProductStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('products')
        .update({ is_active })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// Hook para reordenar produtos
export function useReorderProducts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { id: string; display_order: number }[]) => {
      const updates = items.map(({ id, display_order }) =>
        supabase
          .from('products')
          .update({ display_order })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}
