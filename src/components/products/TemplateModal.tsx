import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Trash2, Package, GripVertical, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useProductTemplate,
  useCreateProductTemplate,
  useUpdateProductTemplate,
  useCreateTemplateVariation,
  useDeleteTemplateVariation,
  useUpdateTemplateVariation,
  ProductTemplateVariation,
} from '@/hooks/useProductTemplates';
import { useAttributeTypes, AttributeValue } from '@/hooks/useProductAttributes';

const templateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  default_weight_kg: z.coerce.number().min(0).default(0),
  default_height_cm: z.coerce.number().min(0).default(0),
  default_width_cm: z.coerce.number().min(0).default(0),
  default_length_cm: z.coerce.number().min(0).default(0),
  use_global_price_rules: z.boolean().default(false),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string | null;
}

export function TemplateModal({ open, onOpenChange, templateId }: TemplateModalProps) {
  const isEditing = !!templateId;
  const [activeTab, setActiveTab] = useState('info');

  const { data: template, isLoading: loadingTemplate } = useProductTemplate(templateId || undefined);
  const { data: attributeTypes } = useAttributeTypes();
  const createTemplate = useCreateProductTemplate();
  const updateTemplate = useUpdateProductTemplate();
  const createVariation = useCreateTemplateVariation();
  const deleteVariation = useDeleteTemplateVariation();
  const updateVariation = useUpdateTemplateVariation();

  // State for new variation form
  const [newVariation, setNewVariation] = useState<{
    selectedAttributes: Record<string, string>;
    variation_name: string;
    price_adjustment: number;
    adjustment_type: 'fixed' | 'percentage';
    weight_override: number | null;
  }>({
    selectedAttributes: {},
    variation_name: '',
    price_adjustment: 0,
    adjustment_type: 'fixed',
    weight_override: null,
  });

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      description: '',
      default_weight_kg: 0,
      default_height_cm: 0,
      default_width_cm: 0,
      default_length_cm: 0,
      use_global_price_rules: false,
    },
  });

  useEffect(() => {
    if (template && isEditing) {
      form.reset({
        name: template.name,
        description: template.description || '',
        default_weight_kg: template.default_weight_kg,
        default_height_cm: template.default_height_cm,
        default_width_cm: template.default_width_cm,
        default_length_cm: template.default_length_cm,
        use_global_price_rules: template.use_global_price_rules ?? false,
      });
    } else if (!isEditing) {
      form.reset({
        name: '',
        description: '',
        default_weight_kg: 0,
        default_height_cm: 0,
        default_width_cm: 0,
        default_length_cm: 0,
        use_global_price_rules: false,
      });
      setActiveTab('info');
    }
  }, [template, isEditing, form]);

  const useGlobalRules = form.watch('use_global_price_rules');

  const onSubmit = async (data: TemplateFormData) => {
    if (isEditing && templateId) {
      await updateTemplate.mutateAsync({ id: templateId, ...data });
    } else {
      await createTemplate.mutateAsync({
        name: data.name,
        description: data.description,
        default_weight_kg: data.default_weight_kg,
        default_height_cm: data.default_height_cm,
        default_width_cm: data.default_width_cm,
        default_length_cm: data.default_length_cm,
      });
    }
    onOpenChange(false);
  };

  const handleAddVariation = async () => {
    if (!templateId) return;
    
    const attributeValueIds = Object.values(newVariation.selectedAttributes).filter(Boolean);
    if (attributeValueIds.length === 0) return;

    await createVariation.mutateAsync({
      template_id: templateId,
      attribute_value_ids: attributeValueIds,
      variation_name: newVariation.variation_name || undefined,
      price_adjustment: newVariation.price_adjustment,
      adjustment_type: newVariation.adjustment_type,
      weight_override: newVariation.weight_override || undefined,
    });

    setNewVariation({
      selectedAttributes: {},
      variation_name: '',
      price_adjustment: 0,
      adjustment_type: 'fixed',
      weight_override: null,
    });
  };

  const handleDeleteVariation = async (id: string) => {
    await deleteVariation.mutateAsync(id);
  };

  const getAttributeValueName = (valueId: string): string => {
    for (const type of attributeTypes || []) {
      const value = type.values.find((v: AttributeValue) => v.id === valueId);
      if (value) return value.display_value || value.value;
    }
    return valueId;
  };

  const formatPriceAdjustment = (variation: ProductTemplateVariation): string => {
    if (variation.price_adjustment === 0) return '-';
    const sign = variation.price_adjustment > 0 ? '+' : '';
    if (variation.adjustment_type === 'percentage') {
      return `${sign}${variation.price_adjustment}%`;
    }
    return `${sign}R$ ${variation.price_adjustment.toFixed(2)}`;
  };

  const isPending = createTemplate.isPending || updateTemplate.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {isEditing ? 'Editar Template' : 'Novo Template'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="variations" disabled={!isEditing}>
              Variações {template?.variations?.length ? `(${template.variations.length})` : ''}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="info" className="m-0 space-y-4">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Template</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Manga Longa" {...field} />
                        </FormControl>
                        <FormDescription>
                          Nome que identificará este modelo de produto
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Descreva o template..." 
                            {...field}
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  {/* Hybrid approach toggle */}
                  <FormField
                    control={form.control}
                    name="use_global_price_rules"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/50">
                        <div className="space-y-0.5 flex-1">
                          <div className="flex items-center gap-2">
                            <FormLabel className="text-base">Usar Regras de Preço Globais</FormLabel>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p><strong>Ativado:</strong> Ajustes de preço das variações vêm das Regras de Preço globais (menu Regras de Preço)</p>
                                  <p className="mt-1"><strong>Desativado:</strong> Cada variação tem seu próprio ajuste de preço definido aqui no template</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <FormDescription>
                            {field.value 
                              ? 'Os preços serão calculados automaticamente com base nas regras globais cadastradas'
                              : 'Você define o ajuste de preço para cada variação individualmente'
                            }
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="default_weight_kg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Peso Padrão (kg)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.001" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-2">
                      <FormField
                        control={form.control}
                        name="default_height_cm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Altura (cm)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" min="0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="default_width_cm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Largura (cm)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" min="0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="default_length_cm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Comp. (cm)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" min="0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isPending}>
                      {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Template'}
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="variations" className="m-0 space-y-4">
              {/* Add variation form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Adicionar Variação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Attribute selectors */}
                  <div className="grid gap-3 md:grid-cols-2">
                    {attributeTypes?.map((type) => (
                      <div key={type.id}>
                        <label className="text-sm font-medium">{type.name}</label>
                        <Select
                          value={newVariation.selectedAttributes[type.id] || ''}
                          onValueChange={(value) =>
                            setNewVariation((prev) => ({
                              ...prev,
                              selectedAttributes: {
                                ...prev.selectedAttributes,
                                [type.id]: value,
                              },
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Selecionar ${type.name}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {type.values.map((value: AttributeValue) => (
                              <SelectItem key={value.id} value={value.id}>
                                {value.display_value || value.value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>

                  {/* Price adjustment - only show if not using global rules */}
                  <div className={`grid gap-3 ${useGlobalRules ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
                    <div>
                      <label className="text-sm font-medium">Nome (opcional)</label>
                      <Input
                        placeholder="Ex: PP-GG Masculino"
                        value={newVariation.variation_name}
                        onChange={(e) =>
                          setNewVariation((prev) => ({
                            ...prev,
                            variation_name: e.target.value,
                          }))
                        }
                      />
                    </div>
                    {!useGlobalRules && (
                      <div>
                        <label className="text-sm font-medium">Ajuste de Preço</label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            step="0.01"
                            value={newVariation.price_adjustment}
                            onChange={(e) =>
                              setNewVariation((prev) => ({
                                ...prev,
                                price_adjustment: parseFloat(e.target.value) || 0,
                              }))
                            }
                          />
                          <Select
                            value={newVariation.adjustment_type}
                            onValueChange={(value: 'fixed' | 'percentage') =>
                              setNewVariation((prev) => ({
                                ...prev,
                                adjustment_type: value,
                              }))
                            }
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">R$</SelectItem>
                              <SelectItem value="percentage">%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium">Peso Override (kg)</label>
                      <Input
                        type="number"
                        step="0.001"
                        placeholder="Usar padrão"
                        value={newVariation.weight_override || ''}
                        onChange={(e) =>
                          setNewVariation((prev) => ({
                            ...prev,
                            weight_override: e.target.value ? parseFloat(e.target.value) : null,
                          }))
                        }
                      />
                    </div>
                  </div>

                  {useGlobalRules && (
                    <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      <Info className="h-4 w-4 inline mr-2" />
                      Ajustes de preço serão aplicados automaticamente das Regras de Preço globais ao aplicar este template.
                    </div>
                  )}

                  <Button
                    onClick={handleAddVariation}
                    disabled={Object.values(newVariation.selectedAttributes).filter(Boolean).length === 0}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Variação
                  </Button>
                </CardContent>
              </Card>

              {/* Variations list */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Variações do Template ({template?.variations?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {template?.variations?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">
                      Nenhuma variação cadastrada
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {template?.variations?.map((variation) => (
                        <div
                          key={variation.id}
                          className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50"
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="flex flex-wrap gap-1 mb-1">
                              {variation.attribute_value_ids.map((valueId) => (
                                <Badge key={valueId} variant="secondary" className="text-xs">
                                  {getAttributeValueName(valueId)}
                                </Badge>
                              ))}
                            </div>
                            {variation.variation_name && (
                              <span className="text-sm text-muted-foreground">
                                {variation.variation_name}
                              </span>
                            )}
                          </div>
                          {useGlobalRules ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              Regras Globais
                            </Badge>
                          ) : (
                            <Badge variant="outline">{formatPriceAdjustment(variation)}</Badge>
                          )}
                          {variation.weight_override && (
                            <Badge variant="outline">{variation.weight_override}kg</Badge>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteVariation(variation.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
