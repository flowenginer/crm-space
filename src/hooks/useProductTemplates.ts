import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from './useTenant';
import { toast } from 'sonner';

export interface ProductTemplate {
  id: string;
  tenant_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  default_weight_kg: number;
  default_height_cm: number;
  default_width_cm: number;
  default_length_cm: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductTemplateVariation {
  id: string;
  tenant_id: string | null;
  template_id: string;
  attribute_value_ids: string[];
  variation_name: string | null;
  price_adjustment: number;
  adjustment_type: 'fixed' | 'percentage';
  weight_override: number | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export interface ProductTemplateWithVariations extends ProductTemplate {
  variations: ProductTemplateVariation[];
}

// Utility function to generate slug
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

// Fetch all templates
export function useProductTemplates() {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['product-templates', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_templates')
        .select('*')
        .order('display_order');

      if (error) throw error;
      return data as ProductTemplate[];
    },
  });
}

// Fetch single template with variations
export function useProductTemplate(id: string | undefined) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['product-template', id, tenantId],
    enabled: !!id,
    queryFn: async () => {
      const { data: template, error: templateError } = await supabase
        .from('product_templates')
        .select('*')
        .eq('id', id!)
        .single();

      if (templateError) throw templateError;

      const { data: variations, error: variationsError } = await supabase
        .from('product_template_variations')
        .select('*')
        .eq('template_id', id!)
        .order('display_order');

      if (variationsError) throw variationsError;

      return {
        ...template,
        variations: variations || [],
      } as ProductTemplateWithVariations;
    },
  });
}

// Fetch all templates with variations (for template selection)
export function useProductTemplatesWithVariations() {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['product-templates-with-variations', tenantId],
    queryFn: async () => {
      const { data: templates, error: templatesError } = await supabase
        .from('product_templates')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (templatesError) throw templatesError;

      const { data: variations, error: variationsError } = await supabase
        .from('product_template_variations')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (variationsError) throw variationsError;

      return (templates || []).map(template => ({
        ...template,
        variations: (variations || []).filter(v => v.template_id === template.id),
      })) as ProductTemplateWithVariations[];
    },
  });
}

// Create template
export function useCreateProductTemplate() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      default_weight_kg?: number;
      default_height_cm?: number;
      default_width_cm?: number;
      default_length_cm?: number;
    }) => {
      // Get max display_order
      const { data: maxOrder } = await supabase
        .from('product_templates')
        .select('display_order')
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      const slug = generateSlug(data.name);

      const { data: result, error } = await supabase
        .from('product_templates')
        .insert({
          ...data,
          slug,
          tenant_id: tenantId,
          display_order: (maxOrder?.display_order || 0) + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return result as ProductTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-templates'] });
      toast.success('Template criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar template: ' + error.message);
    },
  });
}

// Update template
export function useUpdateProductTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ProductTemplate> & { id: string }) => {
      const updateData: Record<string, unknown> = { ...data };
      if (data.name) {
        updateData.slug = generateSlug(data.name);
      }

      const { error } = await supabase
        .from('product_templates')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-templates'] });
      queryClient.invalidateQueries({ queryKey: ['product-template'] });
      toast.success('Template atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar template: ' + error.message);
    },
  });
}

// Delete template
export function useDeleteProductTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-templates'] });
      toast.success('Template excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir template: ' + error.message);
    },
  });
}

// Create template variation
export function useCreateTemplateVariation() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (data: {
      template_id: string;
      attribute_value_ids: string[];
      variation_name?: string;
      price_adjustment?: number;
      adjustment_type?: 'fixed' | 'percentage';
      weight_override?: number;
    }) => {
      // Get max display_order
      const { data: maxOrder } = await supabase
        .from('product_template_variations')
        .select('display_order')
        .eq('template_id', data.template_id)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      const { data: result, error } = await supabase
        .from('product_template_variations')
        .insert({
          ...data,
          tenant_id: tenantId,
          display_order: (maxOrder?.display_order || 0) + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return result as ProductTemplateVariation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-template'] });
      queryClient.invalidateQueries({ queryKey: ['product-templates-with-variations'] });
      toast.success('Variação adicionada ao template!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar variação: ' + error.message);
    },
  });
}

// Update template variation
export function useUpdateTemplateVariation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<ProductTemplateVariation> & { id: string }) => {
      const { error } = await supabase
        .from('product_template_variations')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-template'] });
      queryClient.invalidateQueries({ queryKey: ['product-templates-with-variations'] });
      toast.success('Variação atualizada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar variação: ' + error.message);
    },
  });
}

// Delete template variation
export function useDeleteTemplateVariation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_template_variations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-template'] });
      queryClient.invalidateQueries({ queryKey: ['product-templates-with-variations'] });
      toast.success('Variação removida!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir variação: ' + error.message);
    },
  });
}

// Create bulk template variations
export function useCreateBulkTemplateVariations() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({
      template_id,
      variations,
    }: {
      template_id: string;
      variations: {
        attribute_value_ids: string[];
        variation_name?: string;
        price_adjustment?: number;
        adjustment_type?: 'fixed' | 'percentage';
        weight_override?: number;
      }[];
    }) => {
      // Get max display_order
      const { data: maxOrder } = await supabase
        .from('product_template_variations')
        .select('display_order')
        .eq('template_id', template_id)
        .order('display_order', { ascending: false })
        .limit(1)
        .single();

      let currentOrder = (maxOrder?.display_order || 0) + 1;

      const insertData = variations.map((v) => ({
        ...v,
        template_id,
        tenant_id: tenantId,
        display_order: currentOrder++,
      }));

      const { error } = await supabase
        .from('product_template_variations')
        .insert(insertData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-template'] });
      queryClient.invalidateQueries({ queryKey: ['product-templates-with-variations'] });
      toast.success('Variações criadas com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar variações: ' + error.message);
    },
  });
}

// Apply template to product - creates all variations
export function useApplyTemplateToProduct() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async ({
      productId,
      templateId,
      basePrice,
    }: {
      productId: string;
      templateId: string;
      basePrice: number;
    }) => {
      // Fetch template with variations
      const { data: template, error: templateError } = await supabase
        .from('product_templates')
        .select('*')
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;

      const { data: templateVariations, error: variationsError } = await supabase
        .from('product_template_variations')
        .select('*')
        .eq('template_id', templateId)
        .eq('is_active', true);

      if (variationsError) throw variationsError;

      // Update product with template info
      const { error: updateError } = await supabase
        .from('products')
        .update({
          template_id: templateId,
          weight_kg: template.default_weight_kg,
          height_cm: template.default_height_cm,
          width_cm: template.default_width_cm,
          length_cm: template.default_length_cm,
        })
        .eq('id', productId);

      if (updateError) throw updateError;

      // Create product variations based on template
      if (templateVariations && templateVariations.length > 0) {
        const productVariations = templateVariations.map((tv, index) => {
          let price = basePrice;
          if (tv.adjustment_type === 'fixed') {
            price = basePrice + (tv.price_adjustment || 0);
          } else if (tv.adjustment_type === 'percentage') {
            price = basePrice * (1 + (tv.price_adjustment || 0) / 100);
          }

          return {
            product_id: productId,
            tenant_id: tenantId,
            sku: `${productId.slice(0, 8)}-${index + 1}`,
            price,
            stock_quantity: 0,
            weight_kg: tv.weight_override || template.default_weight_kg,
            attribute_value_ids: tv.attribute_value_ids,
            display_order: index,
            is_active: true,
          };
        });

        const { error: insertError } = await supabase
          .from('product_variations')
          .insert(productVariations);

        if (insertError) throw insertError;
      }

      return { template, variationsCreated: templateVariations?.length || 0 };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-variations'] });
      toast.success(`Template aplicado! ${data.variationsCreated} variações criadas.`);
    },
    onError: (error: Error) => {
      toast.error('Erro ao aplicar template: ' + error.message);
    },
  });
}
