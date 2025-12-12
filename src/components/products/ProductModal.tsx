import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useCreateProduct, useUpdateProduct, generateSlug, type ProductWithCatalog } from '@/hooks/useProducts';
import { useProductCatalogs } from '@/hooks/useProductCatalogs';
import { useProductTemplatesWithVariations, useApplyTemplateToProduct, ProductTemplateWithVariations } from '@/hooks/useProductTemplates';
import { Loader2, Package, DollarSign, FileText, Calculator, Boxes, LayoutTemplate, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import {
  ORIGEM_OPTIONS,
  CST_ICMS_OPTIONS,
  CSOSN_OPTIONS,
  CST_PIS_COFINS_OPTIONS,
  CST_IPI_OPTIONS,
  UNIDADE_COMERCIAL_OPTIONS,
  TIPO_PRODUTO_OPTIONS,
  REGIME_TRIBUTARIO_OPTIONS,
  CFOP_VENDA_OPTIONS,
} from './fiscal-constants';

const productSchema = z.object({
  // Dados básicos
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().optional(),
  catalog_id: z.string().optional(),
  description: z.string().optional(),
  short_description: z.string().max(500, 'Máximo 500 caracteres').optional(),
  main_image_url: z.string().url('URL inválida').optional().or(z.literal('')),
  tags: z.string().optional(),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  has_variations: z.boolean().default(true),
  track_inventory: z.boolean().default(false),
  // Preços
  base_price: z.coerce.number().min(0, 'Preço deve ser positivo'),
  cost_price: z.coerce.number().min(0).optional(),
  compare_at_price: z.coerce.number().min(0).optional(),
  // Fiscal - Identificação
  sku: z.string().max(60).optional(),
  gtin: z.string().max(14).optional(),
  gtin_tributavel: z.string().max(14).optional(),
  ncm: z.string().max(10).optional(),
  cest: z.string().max(7).optional(),
  cfop_venda: z.string().max(4).optional(),
  cfop_devolucao: z.string().max(4).optional(),
  origem: z.coerce.number().min(0).max(8).optional(),
  tipo_produto: z.string().max(2).optional(),
  codigo_beneficio_fiscal: z.string().max(10).optional(),
  // Fiscal - Unidades e Peso
  unidade_comercial: z.string().max(6).optional(),
  unidade_tributavel: z.string().max(6).optional(),
  fator_conversao_tributavel: z.coerce.number().min(0).optional(),
  peso_bruto: z.coerce.number().min(0).optional(),
  peso_liquido: z.coerce.number().min(0).optional(),
  // Impostos - ICMS
  regime_tributario: z.string().optional(),
  cst_icms: z.string().max(3).optional(),
  csosn: z.string().max(3).optional(),
  aliquota_icms: z.coerce.number().min(0).max(100).optional(),
  reducao_base_icms: z.coerce.number().min(0).max(100).optional(),
  icms_st_modalidade: z.string().max(2).optional(),
  icms_st_aliquota: z.coerce.number().min(0).max(100).optional(),
  icms_st_mva: z.coerce.number().min(0).optional(),
  // Impostos - IPI
  cst_ipi: z.string().max(2).optional(),
  aliquota_ipi: z.coerce.number().min(0).max(100).optional(),
  codigo_enquadramento_ipi: z.string().max(3).optional(),
  ex_tipi: z.string().max(3).optional(),
  // Impostos - PIS/COFINS
  cst_pis: z.string().max(2).optional(),
  aliquota_pis: z.coerce.number().min(0).max(100).optional(),
  cst_cofins: z.string().max(2).optional(),
  aliquota_cofins: z.coerce.number().min(0).max(100).optional(),
  // Informações adicionais
  informacoes_adicionais: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithCatalog | null;
}

export function ProductModal({ open, onOpenChange, product }: ProductModalProps) {
  const { data: catalogs } = useProductCatalogs();
  const { data: templates } = useProductTemplatesWithVariations();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const applyTemplate = useApplyTemplateToProduct();
  const isEditing = !!product;
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const selectedTemplate = templates?.find(t => t.id === selectedTemplateId);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      slug: '',
      catalog_id: '',
      description: '',
      short_description: '',
      base_price: 0,
      cost_price: 0,
      compare_at_price: 0,
      main_image_url: '',
      is_active: true,
      is_featured: false,
      has_variations: true,
      track_inventory: false,
      tags: '',
      // Fiscais
      sku: '',
      gtin: '',
      gtin_tributavel: '',
      ncm: '',
      cest: '',
      cfop_venda: '',
      cfop_devolucao: '',
      origem: 0,
      tipo_produto: '00',
      codigo_beneficio_fiscal: '',
      unidade_comercial: 'UN',
      unidade_tributavel: 'UN',
      fator_conversao_tributavel: 1,
      peso_bruto: 0,
      peso_liquido: 0,
      regime_tributario: '',
      cst_icms: '',
      csosn: '',
      aliquota_icms: 0,
      reducao_base_icms: 0,
      icms_st_modalidade: '',
      icms_st_aliquota: 0,
      icms_st_mva: 0,
      cst_ipi: '',
      aliquota_ipi: 0,
      codigo_enquadramento_ipi: '',
      ex_tipi: '',
      cst_pis: '',
      aliquota_pis: 0,
      cst_cofins: '',
      aliquota_cofins: 0,
      informacoes_adicionais: '',
    },
  });

  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        slug: product.slug || '',
        catalog_id: product.catalog_id || '',
        description: product.description || '',
        short_description: product.short_description || '',
        base_price: product.base_price,
        cost_price: product.cost_price || 0,
        compare_at_price: product.compare_at_price || 0,
        main_image_url: product.main_image_url || '',
        is_active: product.is_active,
        is_featured: product.is_featured,
        has_variations: product.has_variations,
        track_inventory: product.track_inventory,
        tags: product.tags?.join(', ') || '',
        // Fiscais
        sku: product.sku || '',
        gtin: product.gtin || '',
        gtin_tributavel: product.gtin_tributavel || '',
        ncm: product.ncm || '',
        cest: product.cest || '',
        cfop_venda: product.cfop_venda || '',
        cfop_devolucao: product.cfop_devolucao || '',
        origem: product.origem ?? 0,
        tipo_produto: product.tipo_produto || '00',
        codigo_beneficio_fiscal: product.codigo_beneficio_fiscal || '',
        unidade_comercial: product.unidade_comercial || 'UN',
        unidade_tributavel: product.unidade_tributavel || 'UN',
        fator_conversao_tributavel: product.fator_conversao_tributavel ?? 1,
        peso_bruto: product.peso_bruto || 0,
        peso_liquido: product.peso_liquido || 0,
        regime_tributario: product.regime_tributario || '',
        cst_icms: product.cst_icms || '',
        csosn: product.csosn || '',
        aliquota_icms: product.aliquota_icms || 0,
        reducao_base_icms: product.reducao_base_icms || 0,
        icms_st_modalidade: product.icms_st_modalidade || '',
        icms_st_aliquota: product.icms_st_aliquota || 0,
        icms_st_mva: product.icms_st_mva || 0,
        cst_ipi: product.cst_ipi || '',
        aliquota_ipi: product.aliquota_ipi || 0,
        codigo_enquadramento_ipi: product.codigo_enquadramento_ipi || '',
        ex_tipi: product.ex_tipi || '',
        cst_pis: product.cst_pis || '',
        aliquota_pis: product.aliquota_pis || 0,
        cst_cofins: product.cst_cofins || '',
        aliquota_cofins: product.aliquota_cofins || 0,
        informacoes_adicionais: product.informacoes_adicionais || '',
      });
    } else {
      form.reset({
        name: '',
        slug: '',
        catalog_id: '',
        description: '',
        short_description: '',
        base_price: 0,
        cost_price: 0,
        compare_at_price: 0,
        main_image_url: '',
        is_active: true,
        is_featured: false,
        has_variations: true,
        track_inventory: false,
        tags: '',
        sku: '',
        gtin: '',
        gtin_tributavel: '',
        ncm: '',
        cest: '',
        cfop_venda: '',
        cfop_devolucao: '',
        origem: 0,
        tipo_produto: '00',
        codigo_beneficio_fiscal: '',
        unidade_comercial: 'UN',
        unidade_tributavel: 'UN',
        fator_conversao_tributavel: 1,
        peso_bruto: 0,
        peso_liquido: 0,
        regime_tributario: '',
        cst_icms: '',
        csosn: '',
        aliquota_icms: 0,
        reducao_base_icms: 0,
        icms_st_modalidade: '',
        icms_st_aliquota: 0,
        icms_st_mva: 0,
        cst_ipi: '',
        aliquota_ipi: 0,
        codigo_enquadramento_ipi: '',
        ex_tipi: '',
        cst_pis: '',
        aliquota_pis: 0,
        cst_cofins: '',
        aliquota_cofins: 0,
        informacoes_adicionais: '',
      });
    }
  }, [product, form]);

  // Reset template selection when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedTemplateId(null);
    }
  }, [open]);

  const onSubmit = async (data: ProductFormData) => {
    const tags = data.tags
      ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    const payload = {
      name: data.name,
      slug: data.slug || generateSlug(data.name),
      catalog_id: data.catalog_id || undefined,
      description: data.description || undefined,
      short_description: data.short_description || undefined,
      base_price: data.base_price,
      cost_price: data.cost_price || undefined,
      compare_at_price: data.compare_at_price || undefined,
      main_image_url: data.main_image_url || undefined,
      is_active: data.is_active,
      is_featured: data.is_featured,
      has_variations: data.has_variations,
      track_inventory: data.track_inventory,
      tags,
      // Fiscais
      sku: data.sku || undefined,
      gtin: data.gtin || undefined,
      gtin_tributavel: data.gtin_tributavel || undefined,
      ncm: data.ncm || undefined,
      cest: data.cest || undefined,
      cfop_venda: data.cfop_venda || undefined,
      cfop_devolucao: data.cfop_devolucao || undefined,
      origem: data.origem,
      tipo_produto: data.tipo_produto || undefined,
      codigo_beneficio_fiscal: data.codigo_beneficio_fiscal || undefined,
      unidade_comercial: data.unidade_comercial || undefined,
      unidade_tributavel: data.unidade_tributavel || undefined,
      fator_conversao_tributavel: data.fator_conversao_tributavel || undefined,
      peso_bruto: data.peso_bruto || undefined,
      peso_liquido: data.peso_liquido || undefined,
      regime_tributario: data.regime_tributario || undefined,
      cst_icms: data.cst_icms || undefined,
      csosn: data.csosn || undefined,
      aliquota_icms: data.aliquota_icms || undefined,
      reducao_base_icms: data.reducao_base_icms || undefined,
      icms_st_modalidade: data.icms_st_modalidade || undefined,
      icms_st_aliquota: data.icms_st_aliquota || undefined,
      icms_st_mva: data.icms_st_mva || undefined,
      cst_ipi: data.cst_ipi || undefined,
      aliquota_ipi: data.aliquota_ipi || undefined,
      codigo_enquadramento_ipi: data.codigo_enquadramento_ipi || undefined,
      ex_tipi: data.ex_tipi || undefined,
      cst_pis: data.cst_pis || undefined,
      aliquota_pis: data.aliquota_pis || undefined,
      cst_cofins: data.cst_cofins || undefined,
      aliquota_cofins: data.aliquota_cofins || undefined,
      informacoes_adicionais: data.informacoes_adicionais || undefined,
    };

    if (isEditing) {
      await updateProduct.mutateAsync({ id: product.id, ...payload });
    } else {
      const result = await createProduct.mutateAsync(payload);
      
      // Apply template if selected
      if (selectedTemplateId && result?.id) {
        await applyTemplate.mutateAsync({
          productId: result.id,
          templateId: selectedTemplateId,
          basePrice: data.base_price,
        });
      }
    }

    onOpenChange(false);
  };

  const isSubmitting = createProduct.isPending || updateProduct.isPending || applyTemplate.isPending;

  // Handle template selection - apply template defaults
  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId || null);
    const template = templates?.find(t => t.id === templateId);
    if (template) {
      form.setValue('peso_bruto', template.default_weight_kg);
      form.setValue('peso_liquido', template.default_weight_kg);
      toast.info(`Template "${template.name}" selecionado. Peso e dimensões aplicados.`);
    }
  };

  // Auto-generate slug from name
  const watchName = form.watch('name');
  useEffect(() => {
    if (!isEditing && watchName && !form.getValues('slug')) {
      form.setValue('slug', generateSlug(watchName));
    }
  }, [watchName, isEditing, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Produto' : 'Novo Produto'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Tabs defaultValue="basico" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basico" className="flex items-center gap-1.5">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">Básico</span>
                </TabsTrigger>
                <TabsTrigger value="precos" className="flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4" />
                  <span className="hidden sm:inline">Preços</span>
                </TabsTrigger>
                <TabsTrigger value="fiscal" className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Fiscal</span>
                </TabsTrigger>
                <TabsTrigger value="impostos" className="flex items-center gap-1.5">
                  <Calculator className="h-4 w-4" />
                  <span className="hidden sm:inline">Impostos</span>
                </TabsTrigger>
                <TabsTrigger value="estoque" className="flex items-center gap-1.5">
                  <Boxes className="h-4 w-4" />
                  <span className="hidden sm:inline">Estoque</span>
                </TabsTrigger>
              </TabsList>

              {/* TAB BÁSICO */}
              <TabsContent value="basico" className="space-y-4 mt-4">
                {/* Template Selector - only for new products */}
                {!isEditing && templates && templates.length > 0 && (
                  <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                    <div className="flex items-center gap-2 mb-3">
                      <LayoutTemplate className="h-5 w-5 text-primary" />
                      <span className="font-medium">Usar Template</span>
                      <Badge variant="secondary" className="text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Agilize o cadastro
                      </Badge>
                    </div>
                    <Select value={selectedTemplateId || ''} onValueChange={handleTemplateChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um template para aplicar variações automaticamente" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name} ({template.variations?.length || 0} variações)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedTemplate && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Peso: {selectedTemplate.default_weight_kg}kg | 
                        Dimensões: {selectedTemplate.default_height_cm}x{selectedTemplate.default_width_cm}x{selectedTemplate.default_length_cm}cm | 
                        {selectedTemplate.variations?.length || 0} variações serão criadas automaticamente
                      </p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Nome do Produto *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Camiseta Esportiva" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug</FormLabel>
                        <FormControl>
                          <Input placeholder="camiseta-esportiva" {...field} />
                        </FormControl>
                        <FormDescription>URL amigável (auto-gerado)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="catalog_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Catálogo</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um catálogo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {catalogs?.map((catalog) => (
                              <SelectItem key={catalog.id} value={catalog.id}>
                                {catalog.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="short_description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição Curta</FormLabel>
                      <FormControl>
                        <Input placeholder="Breve descrição do produto" {...field} />
                      </FormControl>
                      <FormDescription>Máximo 500 caracteres</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição Completa</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Descrição detalhada do produto..." rows={4} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="main_image_url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da Imagem Principal</FormLabel>
                      <FormControl>
                        <Input type="url" placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tags</FormLabel>
                      <FormControl>
                        <Input placeholder="esporte, fitness, casual" {...field} />
                      </FormControl>
                      <FormDescription>Separe as tags por vírgula</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <FormLabel>Produto Ativo</FormLabel>
                          <FormDescription>Visível para venda</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="is_featured"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <FormLabel>Destaque</FormLabel>
                          <FormDescription>Aparece em destaque</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* TAB PREÇOS */}
              <TabsContent value="precos" className="space-y-4 mt-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="base_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço de Venda *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" placeholder="0,00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cost_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço de Custo</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" placeholder="0,00" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="compare_at_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço "De"</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" placeholder="0,00" {...field} />
                        </FormControl>
                        <FormDescription>Para mostrar desconto</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* TAB FISCAL */}
              <TabsContent value="fiscal" className="space-y-6 mt-4">
                {/* Identificação */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-muted-foreground">Identificação</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>SKU / Código Interno</FormLabel>
                          <FormControl>
                            <Input placeholder="ABC-001" maxLength={60} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gtin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GTIN / EAN</FormLabel>
                          <FormControl>
                            <Input placeholder="7891234567890" maxLength={14} {...field} />
                          </FormControl>
                          <FormDescription>Código de barras</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gtin_tributavel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GTIN Tributável</FormLabel>
                          <FormControl>
                            <Input placeholder="Se diferente do GTIN" maxLength={14} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Classificação Fiscal */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-muted-foreground">Classificação Fiscal</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="ncm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>NCM</FormLabel>
                          <FormControl>
                            <Input placeholder="00000000" maxLength={10} {...field} />
                          </FormControl>
                          <FormDescription>8 dígitos</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cest"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEST</FormLabel>
                          <FormControl>
                            <Input placeholder="0000000" maxLength={7} {...field} />
                          </FormControl>
                          <FormDescription>Subst. Tributária</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="origem"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Origem</FormLabel>
                          <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ORIGEM_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cfop_venda"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CFOP Venda</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CFOP_VENDA_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cfop_devolucao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CFOP Devolução</FormLabel>
                          <FormControl>
                            <Input placeholder="1202" maxLength={4} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="tipo_produto"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Produto</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TIPO_PRODUTO_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Unidades e Peso */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-muted-foreground">Unidades de Medida e Peso</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="unidade_comercial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unidade Comercial</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="UN" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {UNIDADE_COMERCIAL_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="unidade_tributavel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Unidade Tributável</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="UN" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {UNIDADE_COMERCIAL_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="fator_conversao_tributavel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fator de Conversão</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.0001" min="0" placeholder="1" {...field} />
                          </FormControl>
                          <FormDescription>Ex: 1 CX = 12 UN</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="peso_bruto"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Peso Bruto (kg)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.0001" min="0" placeholder="0.000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="peso_liquido"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Peso Líquido (kg)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.0001" min="0" placeholder="0.000" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="codigo_beneficio_fiscal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cód. Benefício Fiscal</FormLabel>
                          <FormControl>
                            <Input placeholder="UF12345678" maxLength={10} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* TAB IMPOSTOS */}
              <TabsContent value="impostos" className="space-y-6 mt-4">
                {/* Regime */}
                <FormField
                  control={form.control}
                  name="regime_tributario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Regime Tributário</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-[300px]">
                            <SelectValue placeholder="Selecione o regime" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {REGIME_TRIBUTARIO_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* ICMS */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-muted-foreground">ICMS</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="cst_icms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CST ICMS</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CST_ICMS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>Regime Normal</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="csosn"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CSOSN</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CSOSN_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>Simples Nacional</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="aliquota_icms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alíquota ICMS (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" max="100" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="reducao_base_icms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Redução Base ICMS (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" max="100" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="icms_st_aliquota"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alíquota ICMS ST (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" max="100" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="icms_st_mva"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MVA ICMS ST (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* IPI */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-muted-foreground">IPI</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="cst_ipi"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CST IPI</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CST_IPI_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="aliquota_ipi"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alíquota IPI (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" max="100" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="codigo_enquadramento_ipi"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cód. Enquadramento</FormLabel>
                          <FormControl>
                            <Input placeholder="999" maxLength={3} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ex_tipi"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ex TIPI</FormLabel>
                          <FormControl>
                            <Input placeholder="01" maxLength={3} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* PIS/COFINS */}
                <div>
                  <h4 className="text-sm font-medium mb-3 text-muted-foreground">PIS / COFINS</h4>
                  <div className="grid grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="cst_pis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CST PIS</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CST_PIS_COFINS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="aliquota_pis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alíquota PIS (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" max="100" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cst_cofins"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CST COFINS</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CST_PIS_COFINS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="aliquota_cofins"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alíquota COFINS (%)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" max="100" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Informações Adicionais */}
                <FormField
                  control={form.control}
                  name="informacoes_adicionais"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Informações Adicionais (NF-e)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Informações que aparecerão na nota fiscal..." rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* TAB ESTOQUE */}
              <TabsContent value="estoque" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="has_variations"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <FormLabel>Tem Variações</FormLabel>
                          <FormDescription>Cor, tamanho, etc.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="track_inventory"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <FormLabel>Controlar Estoque</FormLabel>
                          <FormDescription>Rastrear quantidade</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    O controle de estoque por variação é gerenciado na tela de variações do produto.
                    Ative "Tem Variações" para cadastrar cores, tamanhos e outras opções.
                  </p>
                </div>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Salvar' : 'Criar Produto'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
