import { useState } from 'react';
import {
  useProductVariations,
  useCreateVariation,
  useUpdateVariation,
  useDeleteVariation,
  ProductVariationWithProduct,
} from '@/hooks/useProductVariations';
import { useAttributeTypes } from '@/hooks/useProductAttributes';
import { usePriceRules } from '@/hooks/useAttributePriceRules';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ProductVariationsGenerator } from './ProductVariationsGenerator';
import { Loader2, Plus, Pencil, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';

interface ProductVariationsTabProps {
  productId: string;
  productName: string;
  basePrice: number;
}

export function ProductVariationsTab({ productId, productName, basePrice }: ProductVariationsTabProps) {
  const { data: variations, isLoading } = useProductVariations(productId);
  const { data: attributeTypes } = useAttributeTypes();
  const { data: priceRules } = usePriceRules();
  const createVariation = useCreateVariation();
  const updateVariation = useUpdateVariation();
  const deleteVariation = useDeleteVariation();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingVariation, setEditingVariation] = useState<ProductVariationWithProduct | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Edit form state
  const [editSku, setEditSku] = useState('');
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editStock, setEditStock] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  const existingVariationIds = variations?.map(v => v.attribute_value_ids || []) || [];

  const handleAddVariations = async (newVariations: {
    attributeValueIds: string[];
    name: string;
    attributes: Record<string, string>;
    priceAdjustment: number;
  }[]) => {
    const productPrefix = productName.toUpperCase().split(/\s+/).map(w => w.charAt(0)).join('').slice(0, 4);

    for (const v of newVariations) {
      await createVariation.mutateAsync({
        product_id: productId,
        sku: `${productPrefix}-${v.attributeValueIds.map(id => id.slice(-4)).join('-')}`.toUpperCase(),
        attributes: v.attributes,
        attribute_value_ids: v.attributeValueIds,
        variation_name: v.name,
        price: basePrice + v.priceAdjustment,
      });
    }

    setShowAddDialog(false);
  };

  const openEditDialog = (variation: ProductVariationWithProduct) => {
    setEditingVariation(variation);
    setEditSku(variation.sku);
    setEditName(variation.variation_name || '');
    setEditPrice(String(variation.price || basePrice));
    setEditStock(String(variation.stock_quantity || 0));
    setEditIsActive(variation.is_active);
  };

  const handleSaveEdit = async () => {
    if (!editingVariation) return;

    await updateVariation.mutateAsync({
      id: editingVariation.id,
      sku: editSku,
      variation_name: editName,
      price: parseFloat(editPrice) || basePrice,
      stock_quantity: parseInt(editStock) || 0,
      is_active: editIsActive,
    });

    setEditingVariation(null);
  };

  const handleDelete = async (id: string) => {
    await deleteVariation.mutateAsync(id);
    setDeleteConfirm(null);
  };

  const handleToggleActive = async (variation: ProductVariationWithProduct) => {
    await updateVariation.mutateAsync({
      id: variation.id,
      is_active: !variation.is_active,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Variações do Produto</span>
          {variations && variations.length > 0 && (
            <Badge variant="secondary">{variations.length}</Badge>
          )}
        </div>
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar
        </Button>
      </div>

      {/* Variations Table */}
      {variations && variations.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variação</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead className="text-center">Estoque</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variations.map((variation) => (
                <TableRow key={variation.id}>
                  <TableCell className="font-medium">
                    {variation.variation_name || 'Sem nome'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {variation.sku}
                  </TableCell>
                  <TableCell className="text-right">
                    R$ {(variation.price || basePrice).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={variation.stock_quantity <= variation.low_stock_threshold ? 'destructive' : 'outline'}
                    >
                      {variation.stock_quantity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      onClick={() => handleToggleActive(variation)}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                        variation.is_active
                          ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-950'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {variation.is_active ? 'Ativo' : 'Inativo'}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(variation)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(variation.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Package className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground">Nenhuma variação cadastrada</p>
          <p className="text-sm text-muted-foreground/80 mt-1">
            Adicione variações como cores, tamanhos, etc.
          </p>
          <Button className="mt-4" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Adicionar Variações
          </Button>
        </div>
      )}

      {/* Add Variations Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Variações</DialogTitle>
          </DialogHeader>
          <ProductVariationsGenerator
            onVariationsGenerated={handleAddVariations}
            existingVariationIds={existingVariationIds}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Variation Dialog */}
      <Dialog open={!!editingVariation} onOpenChange={(open) => !open && setEditingVariation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Variação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Variação</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ex: Azul - M"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">SKU</label>
              <Input
                value={editSku}
                onChange={(e) => setEditSku(e.target.value)}
                placeholder="Código único"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Preço (R$)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Estoque</label>
                <Input
                  type="number"
                  value={editStock}
                  onChange={(e) => setEditStock(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Variação Ativa</p>
                <p className="text-xs text-muted-foreground">Visível para venda</p>
              </div>
              <Switch checked={editIsActive} onCheckedChange={setEditIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingVariation(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={updateVariation.isPending}>
              {updateVariation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Variação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A variação será permanentemente removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
