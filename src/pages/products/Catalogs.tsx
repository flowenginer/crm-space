import { useState } from 'react';
import { Plus, GripVertical, Pencil, Trash2, Star, Image, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  useReorderCatalogs,
  useSetDefaultCatalog,
  useUpdateCatalog,
  ProductCatalog,
} from '@/hooks/useProductCatalogs';
import { CatalogModal } from '@/components/products/CatalogModal';

function SortableCatalogCard({
  catalog,
  onEdit,
  onDelete,
  onSetDefault,
  onToggleActive,
}: {
  catalog: ProductCatalog;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onToggleActive: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: catalog.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group ${isDragging ? 'z-50 opacity-50' : ''}`}
    >
      <Card className={`transition-all ${!catalog.is_active ? 'opacity-60' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <button
              type="button"
              className="mt-1 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-5 w-5" />
            </button>

            <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
              {catalog.cover_image_url ? (
                <img
                  src={catalog.cover_image_url}
                  alt={catalog.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Image className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{catalog.name}</h3>
                {catalog.is_default && (
                  <Badge variant="secondary" className="gap-1">
                    <Star className="h-3 w-3 fill-current" />
                    Padrão
                  </Badge>
                )}
                {!catalog.is_active && (
                  <Badge variant="outline">Inativo</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">/{catalog.slug}</p>
              {catalog.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {catalog.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleActive}
                title={catalog.is_active ? 'Desativar' : 'Ativar'}
              >
                {catalog.is_active ? (
                  <ToggleRight className="h-4 w-4 text-green-500" />
                ) : (
                  <ToggleLeft className="h-4 w-4" />
                )}
              </Button>
              {!catalog.is_default && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onSetDefault}
                  title="Definir como padrão"
                >
                  <Star className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Catalogs() {
  const { data: catalogs, isLoading } = useProductCatalogs();
  const deleteMutation = useDeleteCatalog();
  const reorderMutation = useReorderCatalogs();
  const setDefaultMutation = useSetDefaultCatalog();
  const updateMutation = useUpdateCatalog();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<ProductCatalog | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !catalogs) return;

    const oldIndex = catalogs.findIndex((c) => c.id === active.id);
    const newIndex = catalogs.findIndex((c) => c.id === over.id);
    const newOrder = arrayMove(catalogs, oldIndex, newIndex);
    reorderMutation.mutate(newOrder.map((c) => c.id));
  };

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
    <div className="container mx-auto max-w-4xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catálogos</h1>
          <p className="text-muted-foreground">Gerencie os catálogos de produtos</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Catálogo
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="h-16 w-16 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : catalogs && catalogs.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={catalogs.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {catalogs.map((catalog) => (
                <SortableCatalogCard
                  key={catalog.id}
                  catalog={catalog}
                  onEdit={() => handleEdit(catalog)}
                  onDelete={() => setDeleteId(catalog.id)}
                  onSetDefault={() => setDefaultMutation.mutate(catalog.id)}
                  onToggleActive={() => handleToggleActive(catalog)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Nenhum catálogo</CardTitle>
            <CardDescription>Crie seu primeiro catálogo de produtos</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Catálogo
            </Button>
          </CardContent>
        </Card>
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
