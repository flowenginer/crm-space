import { useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  useCreateCatalog,
  useUpdateCatalog,
  generateSlug,
  ProductCatalog,
} from '@/hooks/useProductCatalogs';

const catalogSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório'),
  description: z.string().optional(),
  cover_image_url: z.string().url('URL inválida').optional().or(z.literal('')),
  is_active: z.boolean(),
  is_default: z.boolean(),
});

type CatalogFormData = z.infer<typeof catalogSchema>;

interface CatalogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: ProductCatalog | null;
}

export function CatalogModal({ open, onOpenChange, catalog }: CatalogModalProps) {
  const createMutation = useCreateCatalog();
  const updateMutation = useUpdateCatalog();

  const form = useForm<CatalogFormData>({
    resolver: zodResolver(catalogSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      cover_image_url: '',
      is_active: true,
      is_default: false,
    },
  });

  useEffect(() => {
    if (catalog) {
      form.reset({
        name: catalog.name,
        slug: catalog.slug,
        description: catalog.description || '',
        cover_image_url: catalog.cover_image_url || '',
        is_active: catalog.is_active,
        is_default: catalog.is_default,
      });
    } else {
      form.reset({
        name: '',
        slug: '',
        description: '',
        cover_image_url: '',
        is_active: true,
        is_default: false,
      });
    }
  }, [catalog, form]);

  const watchName = form.watch('name');

  useEffect(() => {
    if (!catalog && watchName) {
      form.setValue('slug', generateSlug(watchName), { shouldValidate: true });
    }
  }, [watchName, catalog, form]);

  const onSubmit = async (data: CatalogFormData) => {
    try {
      if (catalog) {
        await updateMutation.mutateAsync({
          id: catalog.id,
          name: data.name,
          slug: data.slug,
          description: data.description || null,
          cover_image_url: data.cover_image_url || null,
          is_active: data.is_active,
          is_default: data.is_default,
        });
      } else {
        await createMutation.mutateAsync({
          name: data.name,
          slug: data.slug,
          description: data.description,
          cover_image_url: data.cover_image_url,
          is_active: data.is_active,
          is_default: data.is_default,
        });
      }
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {catalog ? 'Editar Catálogo' : 'Novo Catálogo'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Roupas Masculinas" {...field} />
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
                    <Input placeholder="roupas-masculinas" {...field} />
                  </FormControl>
                  <FormDescription>
                    Identificador único para URLs
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
                      placeholder="Descrição do catálogo..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cover_image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL da Imagem de Capa</FormLabel>
                  <FormControl>
                    <Input placeholder="https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-6">
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Ativo</FormLabel>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_default"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">Catálogo Padrão</FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Salvando...' : catalog ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
