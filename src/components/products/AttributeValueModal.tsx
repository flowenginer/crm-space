import { useEffect } from 'react';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  type AttributeValue,
  useCreateAttributeValue,
  useUpdateAttributeValue,
  generateSlug,
} from '@/hooks/useProductAttributes';
import { toast } from 'sonner';

const formSchema = z.object({
  value: z.string().min(1, 'Valor é obrigatório'),
  display_value: z.string().optional(),
  slug: z.string().min(1, 'Slug é obrigatório'),
});

type FormValues = z.infer<typeof formSchema>;

interface AttributeValueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attributeTypeId: string;
  editingValue: AttributeValue | null;
}

export function AttributeValueModal({
  open,
  onOpenChange,
  attributeTypeId,
  editingValue,
}: AttributeValueModalProps) {
  const createMutation = useCreateAttributeValue();
  const updateMutation = useUpdateAttributeValue();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      value: '',
      display_value: '',
      slug: '',
    },
  });

  useEffect(() => {
    if (editingValue) {
      form.reset({
        value: editingValue.value,
        display_value: editingValue.display_value || '',
        slug: editingValue.slug,
      });
    } else {
      form.reset({
        value: '',
        display_value: '',
        slug: '',
      });
    }
  }, [editingValue, form, open]);

  const handleValueChange = (value: string) => {
    form.setValue('value', value);
    if (!editingValue) {
      form.setValue('slug', generateSlug(value));
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      if (editingValue) {
        await updateMutation.mutateAsync({
          id: editingValue.id,
          value: values.value,
          slug: values.slug,
          display_value: values.display_value || null,
        });
        toast.success('Valor atualizado com sucesso');
      } else {
        await createMutation.mutateAsync({
          attribute_type_id: attributeTypeId,
          value: values.value,
          slug: values.slug,
          display_value: values.display_value || undefined,
        });
        toast.success('Valor criado com sucesso');
      }
      onOpenChange(false);
    } catch (error: any) {
      if (error?.message?.includes('duplicate key')) {
        toast.error('Já existe um valor com este slug neste atributo');
      } else {
        toast.error('Erro ao salvar valor');
      }
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingValue ? 'Editar Valor' : 'Adicionar Valor'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => handleValueChange(e.target.value)}
                      placeholder="Ex: G1"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="display_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor de Exibição</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Ex: G1 (Plus Size)" />
                  </FormControl>
                  <FormDescription>
                    Texto alternativo para exibição (opcional)
                  </FormDescription>
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
                    <Input {...field} placeholder="g1" />
                  </FormControl>
                  <FormDescription>
                    Identificador único gerado automaticamente
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Salvando...' : editingValue ? 'Salvar Alterações' : 'Salvar Valor'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
