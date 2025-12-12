import { useState } from 'react';
import { useProducts, useDeleteProduct, useToggleProductStatus } from '@/hooks/useProducts';
import { useProductCatalogs } from '@/hooks/useProductCatalogs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Package,
  Layers,
  ImageIcon,
} from 'lucide-react';
import { ProductModal } from '@/components/products/ProductModal';
import { ProductDetailsModal } from '@/components/products/ProductDetailsModal';
import type { ProductWithCatalog } from '@/hooks/useProducts';

export default function Products() {
  const [search, setSearch] = useState('');
  const [catalogFilter, setCatalogFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithCatalog | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewingProduct, setViewingProduct] = useState<ProductWithCatalog | null>(null);

  const { data: products, isLoading } = useProducts({
    catalogId: catalogFilter !== 'all' ? catalogFilter : undefined,
    isActive: statusFilter === 'all' ? undefined : statusFilter === 'active',
    search: search || undefined,
  });
  const { data: catalogs } = useProductCatalogs();
  const deleteProduct = useDeleteProduct();
  const toggleStatus = useToggleProductStatus();

  const handleEdit = (product: ProductWithCatalog) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteProduct.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleToggleStatus = async (product: ProductWithCatalog) => {
    await toggleStatus.mutateAsync({
      id: product.id,
      is_active: !product.is_active,
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-muted-foreground">
            Gerencie seus produtos e variações
          </p>
        </div>
        <Button onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={catalogFilter} onValueChange={setCatalogFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Catálogo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os catálogos</SelectItem>
                {catalogs?.map((catalog) => (
                  <SelectItem key={catalog.id} value={catalog.id}>
                    {catalog.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : products?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum produto encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Comece criando seu primeiro produto
              </p>
              <Button onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Produto
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Imagem</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Catálogo</TableHead>
                  <TableHead className="text-right">Preço Base</TableHead>
                  <TableHead className="text-center">Variações</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((product) => (
                  <TableRow 
                    key={product.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setViewingProduct(product)}
                  >
                    <TableCell>
                      {product.main_image_url ? (
                        <img
                          src={product.main_image_url}
                          alt={product.name}
                          className="h-12 w-12 rounded-md object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        {product.short_description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {product.short_description}
                          </div>
                        )}
                        {product.tags && product.tags.length > 0 && (
                          <div className="flex gap-1 mt-1">
                            {product.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {product.tags.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{product.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.catalog ? (
                        <Badge variant="secondary">{product.catalog.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(product.base_price)}
                      {product.compare_at_price && product.compare_at_price > product.base_price && (
                        <div className="text-xs text-muted-foreground line-through">
                          {formatPrice(product.compare_at_price)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {product.has_variations ? (
                        <Badge variant="outline">
                          <Layers className="h-3 w-3 mr-1" />
                          Sim
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">Não</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={product.is_active ? 'default' : 'secondary'}>
                        {product.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewingProduct(product)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(product)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(product)}>
                            {product.is_active ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteId(product.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Product Modal */}
      <ProductModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        product={editingProduct}
      />

      {/* Product Details Modal */}
      <ProductDetailsModal
        open={!!viewingProduct}
        onOpenChange={(open) => !open && setViewingProduct(null)}
        product={viewingProduct}
        onEdit={(product) => {
          setViewingProduct(null);
          handleEdit(product);
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O produto e todas as suas variações
              serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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
