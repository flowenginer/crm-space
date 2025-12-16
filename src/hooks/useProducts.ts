import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrentTenantId } from './useTenant';
import type { Json } from '@/integrations/supabase/types';

export type PackagingType = 'stack' | 'box' | 'side_by_side' | 'layered' | 'custom';

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
  // Campos fiscais NF-e
  ncm: string | null;
  cest: string | null;
  cfop_venda: string | null;
  cfop_devolucao: string | null;
  origem: number | null;
  tipo_produto: string | null;
  sku: string | null;
  gtin: string | null;
  gtin_tributavel: string | null;
  codigo_beneficio_fiscal: string | null;
  unidade_comercial: string | null;
  unidade_tributavel: string | null;
  fator_conversao_tributavel: number | null;
  peso_bruto: number | null;
  peso_liquido: number | null;
  cst_icms: string | null;
  csosn: string | null;
  aliquota_icms: number | null;
  reducao_base_icms: number | null;
  icms_st_modalidade: string | null;
  icms_st_aliquota: number | null;
  icms_st_mva: number | null;
  cst_ipi: string | null;
  aliquota_ipi: number | null;
  codigo_enquadramento_ipi: string | null;
  ex_tipi: string | null;
  cst_pis: string | null;
  aliquota_pis: number | null;
  cst_cofins: string | null;
  aliquota_cofins: number | null;
  informacoes_adicionais: string | null;
  regime_tributario: string | null;
  // Shipping
  packaging_type: PackagingType | null;
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

// Tipo para criar/atualizar produto com campos fiscais
export interface ProductPayload {
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
  // Campos fiscais
  ncm?: string;
  cest?: string;
  cfop_venda?: string;
  cfop_devolucao?: string;
  origem?: number;
  tipo_produto?: string;
  sku?: string;
  gtin?: string;
  gtin_tributavel?: string;
  codigo_beneficio_fiscal?: string;
  unidade_comercial?: string;
  unidade_tributavel?: string;
  fator_conversao_tributavel?: number;
  peso_bruto?: number;
  peso_liquido?: number;
  cst_icms?: string;
  csosn?: string;
  aliquota_icms?: number;
  reducao_base_icms?: number;
  icms_st_modalidade?: string;
  icms_st_aliquota?: number;
  icms_st_mva?: number;
  cst_ipi?: string;
  aliquota_ipi?: number;
  codigo_enquadramento_ipi?: string;
  ex_tipi?: string;
  cst_pis?: string;
  aliquota_pis?: number;
  cst_cofins?: string;
  aliquota_cofins?: number;
  informacoes_adicionais?: string;
  regime_tributario?: string;
}

// Hook para criar produto
export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (data: ProductPayload) => {
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
          // Campos fiscais
          ncm: data.ncm || null,
          cest: data.cest || null,
          cfop_venda: data.cfop_venda || null,
          cfop_devolucao: data.cfop_devolucao || null,
          origem: data.origem ?? 0,
          tipo_produto: data.tipo_produto || '00',
          sku: data.sku || null,
          gtin: data.gtin || null,
          gtin_tributavel: data.gtin_tributavel || null,
          codigo_beneficio_fiscal: data.codigo_beneficio_fiscal || null,
          unidade_comercial: data.unidade_comercial || 'UN',
          unidade_tributavel: data.unidade_tributavel || 'UN',
          fator_conversao_tributavel: data.fator_conversao_tributavel ?? 1,
          peso_bruto: data.peso_bruto || null,
          peso_liquido: data.peso_liquido || null,
          cst_icms: data.cst_icms || null,
          csosn: data.csosn || null,
          aliquota_icms: data.aliquota_icms || null,
          reducao_base_icms: data.reducao_base_icms || null,
          icms_st_modalidade: data.icms_st_modalidade || null,
          icms_st_aliquota: data.icms_st_aliquota || null,
          icms_st_mva: data.icms_st_mva || null,
          cst_ipi: data.cst_ipi || null,
          aliquota_ipi: data.aliquota_ipi || null,
          codigo_enquadramento_ipi: data.codigo_enquadramento_ipi || null,
          ex_tipi: data.ex_tipi || null,
          cst_pis: data.cst_pis || null,
          aliquota_pis: data.aliquota_pis || null,
          cst_cofins: data.cst_cofins || null,
          aliquota_cofins: data.aliquota_cofins || null,
          informacoes_adicionais: data.informacoes_adicionais || null,
          regime_tributario: data.regime_tributario || null,
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
