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
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  type AttributeTypeWithValues,
  useCreateAttributeType,
  useUpdateAttributeType,
  generateSlug,
} from '@/hooks/useProductAttributes';
import { toast } from 'sonner';

const formSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório'),
  description: z.string().optional(),
  is_required: z.boolean().default(false),
  allow_multiple: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface AttributeTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingType: AttributeTypeWithValues | null;
}

export function AttributeTypeModal({ open, onOpenChange, editingType }: AttributeTypeModalProps) {
  const createMutation = useCreateAttributeType();
  const updateMutation = useUpdateAttributeType();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      is_required: false,
      allow_multiple: false,
      is_active: true,
    },
  });

  useEffect(() => {
    if (editingType) {
      form.reset({
        name: editingType.name,
        slug: editingType.slug,
        description: editingType.description || '',
        is_required: editingType.is_required,
        allow_multiple: editingType.allow_multiple,
        is_active: editingType.is_active,
      });
    } else {
      form.reset({
        name: '',
        slug: '',
        description: '',
        is_required: false,
        allow_multiple: false,
        is_active: true,
      });
    }
  }, [editingType, form, open]);

  const handleNameChange = (value: string) => {
    form.setValue('name', value);
    if (!editingType) {
      form.setValue('slug', generateSlug(value));
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      if (editingType) {
        await updateMutation.mutateAsync({ id: editingType.id, ...values });
        toast.success('Atributo atualizado com sucesso');
      } else {
        await createMutation.mutateAsync({
          name: values.name,
          slug: values.slug,
          description: values.description,
          is_required: values.is_required,
          allow_multiple: values.allow_multiple,
          is_active: values.is_active,
        });
        toast.success('Atributo criado com sucesso');
      }
      onOpenChange(false);
    } catch (error: any) {
      if (error?.message?.includes('duplicate key')) {
        toast.error('Já existe um atributo com este slug');
      } else {
        toast.error('Erro ao salvar atributo');
      }
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingType ? 'Editar Atributo' : 'Novo Tipo de Atributo'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Atributo *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="Ex: Tamanho"
                    />
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
                    <Input {...field} placeholder="tamanho" />
                  </FormControl>
                  <FormDescription>
                    Identificador único gerado automaticamente
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
                      {...field}
                      placeholder="Descrição opcional do atributo"
                      rows={2}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3 rounded-lg border p-4">
              <FormField
                control={form.control}
                name="is_required"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="font-normal">Obrigatório</FormLabel>
                      <FormDescription className="text-xs">
                        Produto deve ter este atributo
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="allow_multiple"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div>
                      <FormLabel className="font-normal">Múltipla seleção</FormLabel>
                      <FormDescription className="text-xs">
                        Permitir selecionar vários valores
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

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
                    <div>
                      <FormLabel className="font-normal">Ativo</FormLabel>
                      <FormDescription className="text-xs">
                        Atributo disponível para uso
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Salvando...' : editingType ? 'Salvar Alterações' : 'Salvar Atributo'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
