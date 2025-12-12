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
import { useCreateProduct, useUpdateProduct, generateSlug, type ProductWithCatalog } from '@/hooks/useProducts';
import { useProductCatalogs } from '@/hooks/useProductCatalogs';
import { Loader2 } from 'lucide-react';

const productSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().optional(),
  catalog_id: z.string().optional(),
  description: z.string().optional(),
  short_description: z.string().max(500, 'Máximo 500 caracteres').optional(),
  base_price: z.coerce.number().min(0, 'Preço deve ser positivo'),
  cost_price: z.coerce.number().min(0).optional(),
  compare_at_price: z.coerce.number().min(0).optional(),
  main_image_url: z.string().url('URL inválida').optional().or(z.literal('')),
  is_active: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  has_variations: z.boolean().default(true),
  track_inventory: z.boolean().default(false),
  tags: z.string().optional(), // Comma-separated
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithCatalog | null;
}

export function ProductModal({ open, onOpenChange, product }: ProductModalProps) {
  const { data: catalogs } = useProductCatalogs();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const isEditing = !!product;

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
      });
    }
  }, [product, form]);

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
    };

    if (isEditing) {
      await updateProduct.mutateAsync({ id: product.id, ...payload });
    } else {
      await createProduct.mutateAsync(payload);
    }

    onOpenChange(false);
  };

  const isSubmitting = createProduct.isPending || updateProduct.isPending;

  // Auto-generate slug from name
  const watchName = form.watch('name');
  useEffect(() => {
    if (!isEditing && watchName && !form.getValues('slug')) {
      form.setValue('slug', generateSlug(watchName));
    }
  }, [watchName, isEditing, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Produto' : 'Novo Produto'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
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
                    <Input
                      placeholder="Breve descrição do produto"
                      {...field}
                    />
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
                    <Textarea
                      placeholder="Descrição detalhada do produto..."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Prices */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="base_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preço Base *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        {...field}
                      />
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
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        {...field}
                      />
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
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Para mostrar desconto</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="main_image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL da Imagem Principal</FormLabel>
                  <FormControl>
                    <Input
                      type="url"
                      placeholder="https://..."
                      {...field}
                    />
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
                    <Input
                      placeholder="esporte, fitness, casual"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Separe as tags por vírgula</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Switches */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Produto Ativo</FormLabel>
                      <FormDescription>
                        Visível para venda
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

              <FormField
                control={form.control}
                name="is_featured"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Destaque</FormLabel>
                      <FormDescription>
                        Aparece em destaque
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

              <FormField
                control={form.control}
                name="has_variations"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Tem Variações</FormLabel>
                      <FormDescription>
                        Cor, tamanho, etc.
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

              <FormField
                control={form.control}
                name="track_inventory"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <FormLabel>Controlar Estoque</FormLabel>
                      <FormDescription>
                        Rastrear quantidade
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
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
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
