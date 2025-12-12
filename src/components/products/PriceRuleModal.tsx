import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAttributeTypes } from '@/hooks/useProductAttributes';
import {
  useCreatePriceRule,
  useCreateBulkPriceRules,
  useUpdatePriceRule,
  type PriceRuleWithDetails,
} from '@/hooks/useAttributePriceRules';
import { toast } from 'sonner';

const formSchema = z.object({
  apply_to: z.enum(['all', 'specific']),
  product_id: z.string().optional(),
  attribute_type_id: z.string().min(1, 'Selecione um atributo'),
  adjustment_type: z.enum(['fixed', 'percentage']),
  adjustment_value: z.coerce.number(),
  is_active: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface PriceRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule: PriceRuleWithDetails | null;
}

export function PriceRuleModal({ open, onOpenChange, editingRule }: PriceRuleModalProps) {
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  
  const { data: attributeTypes = [] } = useAttributeTypes();
  const createMutation = useCreatePriceRule();
  const createBulkMutation = useCreateBulkPriceRules();
  const updateMutation = useUpdatePriceRule();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      apply_to: 'all',
      product_id: '',
      attribute_type_id: '',
      adjustment_type: 'fixed',
      adjustment_value: 0,
      is_active: true,
    },
  });

  const selectedTypeId = form.watch('attribute_type_id');
  const adjustmentType = form.watch('adjustment_type');
  const adjustmentValue = form.watch('adjustment_value');

  const selectedType = useMemo(() => {
    return attributeTypes.find(t => t.id === selectedTypeId);
  }, [attributeTypes, selectedTypeId]);

  useEffect(() => {
    if (editingRule) {
      form.reset({
        apply_to: editingRule.product_id ? 'specific' : 'all',
        product_id: editingRule.product_id || '',
        attribute_type_id: editingRule.attribute_value?.attribute_type?.id || '',
        adjustment_type: editingRule.adjustment_type,
        adjustment_value: editingRule.adjustment_value,
        is_active: editingRule.is_active,
      });
      setSelectedValues([editingRule.attribute_value_id]);
    } else {
      form.reset({
        apply_to: 'all',
        product_id: '',
        attribute_type_id: '',
        adjustment_type: 'fixed',
        adjustment_value: 0,
        is_active: true,
      });
      setSelectedValues([]);
    }
  }, [editingRule, form, open]);

  // Reset selected values when attribute type changes
  useEffect(() => {
    if (!editingRule) {
      setSelectedValues([]);
    }
  }, [selectedTypeId, editingRule]);

  const toggleValue = (valueId: string) => {
    setSelectedValues(prev =>
      prev.includes(valueId)
        ? prev.filter(v => v !== valueId)
        : [...prev, valueId]
    );
  };

  const selectAllValues = () => {
    if (selectedType) {
      setSelectedValues(selectedType.values.map(v => v.id));
    }
  };

  const onSubmit = async (values: FormValues) => {
    if (selectedValues.length === 0) {
      toast.error('Selecione pelo menos um valor');
      return;
    }

    try {
      if (editingRule) {
        await updateMutation.mutateAsync({
          id: editingRule.id,
          product_id: values.apply_to === 'specific' ? values.product_id : null,
          adjustment_type: values.adjustment_type,
          adjustment_value: values.adjustment_value,
          is_active: values.is_active,
        });
        toast.success('Regra atualizada com sucesso');
      } else {
        // Create multiple rules (one per selected value)
        const rules = selectedValues.map(valueId => ({
          product_id: values.apply_to === 'specific' ? values.product_id : null,
          attribute_value_id: valueId,
          adjustment_type: values.adjustment_type as 'fixed' | 'percentage',
          adjustment_value: values.adjustment_value,
          is_active: values.is_active,
        }));

        await createBulkMutation.mutateAsync(rules);
        toast.success(`${rules.length} ${rules.length === 1 ? 'regra criada' : 'regras criadas'} com sucesso`);
      }
      onOpenChange(false);
    } catch (error: any) {
      if (error?.message?.includes('duplicate key')) {
        toast.error('Já existe uma regra para um ou mais valores selecionados');
      } else {
        toast.error('Erro ao salvar regra');
      }
    }
  };

  const isLoading = createMutation.isPending || createBulkMutation.isPending || updateMutation.isPending;

  // Preview calculation
  const previewPrice = 89.90;
  const calculatedPrice = useMemo(() => {
    if (adjustmentType === 'fixed') {
      return previewPrice + (adjustmentValue || 0);
    }
    return previewPrice * (1 + (adjustmentValue || 0) / 100);
  }, [adjustmentType, adjustmentValue]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingRule ? 'Editar Regra de Preço' : 'Nova Regra de Preço'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Apply to */}
            <FormField
              control={form.control}
              name="apply_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Aplicar em</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="all" id="all" />
                        <Label htmlFor="all" className="font-normal">Todos os produtos</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="specific" id="specific" />
                        <Label htmlFor="specific" className="font-normal">Produto específico</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Attribute Type */}
            <FormField
              control={form.control}
              name="attribute_type_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Atributo *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!!editingRule}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um atributo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {attributeTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Attribute Values */}
            {selectedType && selectedType.values.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Valores a aplicar *</Label>
                  {!editingRule && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={selectAllValues}
                      className="h-auto p-0 text-xs"
                    >
                      Selecionar todos
                    </Button>
                  )}
                </div>
                <div className="rounded-lg border p-3 max-h-40 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {selectedType.values.map((value) => (
                      <button
                        key={value.id}
                        type="button"
                        onClick={() => !editingRule && toggleValue(value.id)}
                        disabled={!!editingRule}
                        className="focus:outline-none"
                      >
                        <Badge
                          variant={selectedValues.includes(value.id) ? 'default' : 'outline'}
                          className="cursor-pointer transition-colors"
                        >
                          {value.display_value || value.value}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
                {selectedValues.length > 0 && !editingRule && (
                  <p className="text-xs text-muted-foreground">
                    {selectedValues.length} {selectedValues.length === 1 ? 'valor selecionado' : 'valores selecionados'}
                  </p>
                )}
              </div>
            )}

            {/* Adjustment Type */}
            <FormField
              control={form.control}
              name="adjustment_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Ajuste</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="fixed" id="fixed" />
                        <Label htmlFor="fixed" className="font-normal">Valor fixo (R$)</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="percentage" id="percentage" />
                        <Label htmlFor="percentage" className="font-normal">Percentual (%)</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Adjustment Value */}
            <FormField
              control={form.control}
              name="adjustment_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor do Ajuste *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {adjustmentType === 'fixed' ? 'R$' : '%'}
                      </span>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        className="pl-10"
                        placeholder="10.00"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preview */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm font-medium text-foreground mb-2">Preview</p>
              <p className="text-sm text-muted-foreground">
                Produto com preço base <span className="font-medium">R$ {previewPrice.toFixed(2).replace('.', ',')}</span>
              </p>
              <p className="text-sm mt-1">
                Com ajuste: <span className="font-semibold text-primary">R$ {calculatedPrice.toFixed(2).replace('.', ',')}</span>
              </p>
            </div>

            {/* Is Active */}
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">Regra ativa</FormLabel>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || selectedValues.length === 0}>
                {isLoading ? 'Salvando...' : editingRule ? 'Salvar Alterações' : 'Salvar Regra'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
