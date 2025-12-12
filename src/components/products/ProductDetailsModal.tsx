import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ImageIcon,
  Package,
  Pencil,
  AlertTriangle,
  FileText,
  Layers,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type { ProductWithCatalog } from '@/hooks/useProducts';
import { useProductVariations } from '@/hooks/useProductVariations';
import { useProductTemplatesWithVariations, useApplyTemplateToProduct } from '@/hooks/useProductTemplates';
import { useAttributeTypes } from '@/hooks/useProductAttributes';
import { toast } from 'sonner';

interface ProductDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithCatalog | null;
  onEdit?: (product: ProductWithCatalog) => void;
}

export function ProductDetailsModal({
  open,
  onOpenChange,
  product,
  onEdit,
}: ProductDetailsModalProps) {
  const { data: variations, isLoading: loadingVariations, refetch: refetchVariations } = useProductVariations(
    product?.id
  );
  const { data: templates } = useProductTemplatesWithVariations();
  const { data: attributeTypes } = useAttributeTypes();
  const applyTemplate = useApplyTemplateToProduct();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const templatesWithVariations = templates?.filter(t => t.variations && t.variations.length > 0) || [];

  // Build a map of attribute value id -> display name
  const attrValueMap = new Map<string, string>();
  attributeTypes?.forEach(type => {
    type.values.forEach(val => {
      attrValueMap.set(val.id, val.display_value || val.value);
    });
  });

  // Get variation display name from attribute_value_ids
  const getVariationDisplayName = (attributeValueIds: string[] | null): string => {
    if (!attributeValueIds || attributeValueIds.length === 0) return '-';
    return attributeValueIds
      .map(id => attrValueMap.get(id) || id.slice(0, 4))
      .join(' - ');
  };

  if (!product) return null;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const discount = product.compare_at_price && product.compare_at_price > product.base_price
    ? Math.round(((product.compare_at_price - product.base_price) / product.compare_at_price) * 100)
    : null;

  const formatAttributes = (attributes: unknown) => {
    if (!attributes || typeof attributes !== 'object') return '-';
    const attrs = attributes as Record<string, string>;
    return Object.entries(attrs)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Detalhes do Produto
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 h-[calc(90vh-180px)] pr-4">
          <div className="space-y-6">
            {/* Header com imagem e info básica */}
            <div className="flex gap-4">
              {product.main_image_url ? (
                <img
                  src={product.main_image_url}
                  alt={product.name}
                  className="h-24 w-24 rounded-lg object-cover border"
                />
              ) : (
                <div className="h-24 w-24 rounded-lg bg-muted flex items-center justify-center border">
                  <ImageIcon className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{product.name}</h2>
                    {product.catalog && (
                      <Badge variant="secondary" className="mt-1">
                        {product.catalog.name}
                      </Badge>
                    )}
                  </div>
                  <Badge variant={product.is_active ? 'default' : 'secondary'}>
                    {product.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                {product.short_description && (
                  <p className="text-sm text-muted-foreground">
                    {product.short_description}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Preços */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Preço Base</p>
                <p className="text-lg font-semibold">{formatPrice(product.base_price)}</p>
              </div>
              {product.compare_at_price && product.compare_at_price > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Preço Comparativo</p>
                  <p className="text-lg text-muted-foreground line-through">
                    {formatPrice(product.compare_at_price)}
                  </p>
                  {discount && (
                    <Badge variant="destructive" className="text-xs">
                      -{discount}%
                    </Badge>
                  )}
                </div>
              )}
              {product.cost_price && product.cost_price > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground">Preço de Custo</p>
                  <p className="text-lg">{formatPrice(product.cost_price)}</p>
                </div>
              )}
            </div>

            {/* Info adicional */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              {product.sku && (
                <div>
                  <p className="text-muted-foreground">SKU</p>
                  <p className="font-mono">{product.sku}</p>
                </div>
              )}
              {product.gtin && (
                <div>
                  <p className="text-muted-foreground">GTIN/EAN</p>
                  <p className="font-mono">{product.gtin}</p>
                </div>
              )}
            </div>

            {/* Tags */}
            {product.tags && product.tags.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Tags</p>
                <div className="flex flex-wrap gap-1">
                  {product.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Descrição */}
            {product.description && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Descrição</p>
                <p className="text-sm whitespace-pre-wrap">{product.description}</p>
              </div>
            )}

            <Separator />

            {/* Variações */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-4 w-4" />
                <h3 className="font-medium">
                  Variações {variations && variations.length > 0 && `(${variations.length})`}
                </h3>
              </div>

              {loadingVariations ? (
                <div className="text-sm text-muted-foreground">Carregando variações...</div>
              ) : !variations || variations.length === 0 ? (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground py-4 text-center border rounded-md bg-muted/30">
                    Este produto não possui variações
                  </div>
                  
                  {/* Aplicar Template Section */}
                  {product.has_variations && templatesWithVariations.length > 0 && (
                    <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Aplicar Template</span>
                      </div>
                      <div className="flex gap-2">
                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecione um template" />
                          </SelectTrigger>
                          <SelectContent>
                            {templatesWithVariations.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name} ({template.variations?.length || 0} variações)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={!selectedTemplateId || applyTemplate.isPending}
                          onClick={async () => {
                            if (!selectedTemplateId || !product) return;
                            try {
                              await applyTemplate.mutateAsync({
                                productId: product.id,
                                templateId: selectedTemplateId,
                                basePrice: product.base_price,
                                productName: product.name,
                              });
                              toast.success('Variações aplicadas com sucesso!');
                              refetchVariations();
                              setSelectedTemplateId('');
                            } catch (error) {
                              toast.error('Erro ao aplicar template');
                            }
                          }}
                        >
                          {applyTemplate.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            'Aplicar'
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <ScrollArea className="h-[300px] border rounded-md">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead>Variação</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Preço</TableHead>
                        <TableHead className="text-right">Estoque</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {variations.map((variation) => {
                        const isLowStock = variation.stock_quantity <= variation.low_stock_threshold;
                        const finalPrice = variation.price_override && variation.price
                          ? variation.price
                          : product.base_price;

                        return (
                          <TableRow key={variation.id}>
                            <TableCell className="font-medium text-sm">
                              {variation.variation_name || getVariationDisplayName(variation.attribute_value_ids)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {variation.sku}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatPrice(finalPrice)}
                              {variation.price_override && (
                                <Badge variant="outline" className="ml-1 text-xs">
                                  Custom
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {isLowStock && (
                                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                                )}
                                <span className={isLowStock ? 'text-amber-600 font-medium' : ''}>
                                  {variation.stock_quantity}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={variation.is_active ? 'default' : 'secondary'} className="text-xs">
                                {variation.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </div>

            {/* Informações Fiscais (collapsible) */}
            {(product.ncm || product.cfop_venda || product.cest) && (
              <Accordion type="single" collapsible>
                <AccordionItem value="fiscal">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Informações Fiscais
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm pt-2">
                      {product.ncm && (
                        <div>
                          <p className="text-muted-foreground">NCM</p>
                          <p className="font-mono">{product.ncm}</p>
                        </div>
                      )}
                      {product.cfop_venda && (
                        <div>
                          <p className="text-muted-foreground">CFOP Venda</p>
                          <p className="font-mono">{product.cfop_venda}</p>
                        </div>
                      )}
                      {product.cfop_devolucao && (
                        <div>
                          <p className="text-muted-foreground">CFOP Devolução</p>
                          <p className="font-mono">{product.cfop_devolucao}</p>
                        </div>
                      )}
                      {product.cest && (
                        <div>
                          <p className="text-muted-foreground">CEST</p>
                          <p className="font-mono">{product.cest}</p>
                        </div>
                      )}
                      {product.origem !== null && product.origem !== undefined && (
                        <div>
                          <p className="text-muted-foreground">Origem</p>
                          <p>{product.origem}</p>
                        </div>
                      )}
                      {product.cst_icms && (
                        <div>
                          <p className="text-muted-foreground">CST ICMS</p>
                          <p className="font-mono">{product.cst_icms}</p>
                        </div>
                      )}
                      {product.cst_pis && (
                        <div>
                          <p className="text-muted-foreground">CST PIS</p>
                          <p className="font-mono">{product.cst_pis}</p>
                        </div>
                      )}
                      {product.cst_cofins && (
                        <div>
                          <p className="text-muted-foreground">CST COFINS</p>
                          <p className="font-mono">{product.cst_cofins}</p>
                        </div>
                      )}
                      {product.cst_ipi && (
                        <div>
                          <p className="text-muted-foreground">CST IPI</p>
                          <p className="font-mono">{product.cst_ipi}</p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        </ScrollArea>

        <Separator className="my-4" />

        {/* Footer */}
        <div className="flex justify-end gap-2">
          {onEdit && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onEdit(product);
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
