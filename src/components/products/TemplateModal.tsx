import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Package, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from '@/hooks/useProductTemplates';
import { useAttributeTypes } from '@/hooks/useProductAttributes';
import { usePriceRules } from '@/hooks/useAttributePriceRules';
import { TemplateVariationsBulkGenerator } from './TemplateVariationsBulkGenerator';

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
  const { data: priceRules } = usePriceRules();
  const createTemplate = useCreateProductTemplate();
  const updateTemplate = useUpdateProductTemplate();

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

            <TabsContent value="variations" className="m-0">
              {templateId && attributeTypes && priceRules !== undefined && (
                <TemplateVariationsBulkGenerator
                  templateId={templateId}
                  attributeTypes={attributeTypes}
                  priceRules={priceRules || []}
                  existingVariations={template?.variations || []}
                  useGlobalRules={useGlobalRules}
                />
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
