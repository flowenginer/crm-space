import { useState } from 'react';
import { Plus, Pencil, Trash2, Star, ToggleLeft, ToggleRight, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  useProductCatalogs,
  useDeleteCatalog,
  useSetDefaultCatalog,
  useUpdateCatalog,
  ProductCatalog,
} from '@/hooks/useProductCatalogs';
import { CatalogModal } from '@/components/products/CatalogModal';

export default function Catalogs() {
  const { data: catalogs, isLoading } = useProductCatalogs();
  const deleteMutation = useDeleteCatalog();
  const setDefaultMutation = useSetDefaultCatalog();
  const updateMutation = useUpdateCatalog();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<ProductCatalog | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (catalog: ProductCatalog) => {
    setEditingCatalog(catalog);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditingCatalog(null);
    setModalOpen(true);
  };

  const handleToggleActive = (catalog: ProductCatalog) => {
    updateMutation.mutate({ id: catalog.id, is_active: !catalog.is_active });
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className="container mx-auto max-w-5xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <FolderOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Catálogos</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie os catálogos de produtos
              </p>
            </div>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Catálogo
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : catalogs && catalogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/20 py-16">
          <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
          <h3 className="mt-4 text-lg font-medium text-foreground">Nenhum catálogo cadastrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie seu primeiro catálogo de produtos
          </p>
          <Button onClick={handleCreate} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Novo Catálogo
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Imagem</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-center">Padrão</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-[140px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {catalogs?.map((catalog) => (
                <TableRow key={catalog.id}>
                  <TableCell>
                    {catalog.cover_image_url ? (
                      <img
                        src={catalog.cover_image_url}
                        alt={catalog.name}
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                        <FolderOpen className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{catalog.name}</TableCell>
                  <TableCell className="text-muted-foreground">/{catalog.slug}</TableCell>
                  <TableCell className="text-center">
                    {catalog.is_default ? (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="h-3 w-3 fill-current" />
                        Padrão
                      </Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDefaultMutation.mutate(catalog.id)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Definir
                      </Button>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <button
                      onClick={() => handleToggleActive(catalog)}
                      className="flex items-center gap-1.5 mx-auto"
                    >
                      {catalog.is_active ? (
                        <>
                          <ToggleRight className="h-5 w-5 text-green-500" />
                          <span className="text-sm text-green-600">Ativo</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Inativo</span>
                        </>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(catalog)}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(catalog.id)}
                        title="Excluir"
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
      )}

      <CatalogModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        catalog={editingCatalog}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir catálogo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Os produtos vinculados a este catálogo ficarão sem categoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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