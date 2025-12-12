import { useState } from 'react';
import { 
  useMenuHierarchy, 
  useCreateMenuItem, 
  useUpdateMenuItem, 
  useDeleteMenuItem,
  useReorderMenuItems,
  MenuItem,
  MenuItemInput 
} from '@/hooks/useMenuConfig';
import { MenuItemModal } from './MenuItemModal';
import { DynamicIcon } from './IconSelector';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Plus, 
  GripVertical, 
  Pencil, 
  Trash2, 
  ChevronDown, 
  ChevronRight,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableMenuItemProps {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  onToggleActive: (item: MenuItem) => void;
  onAddSubmenu: (parentId: string) => void;
  expandedItems: Set<string>;
  toggleExpanded: (id: string) => void;
  sensors: ReturnType<typeof useSensors>;
  onSubmenuDragEnd: (event: DragEndEvent, parentId: string, children: MenuItem[]) => void;
}

function SortableMenuItem({ 
  item, 
  onEdit, 
  onDelete, 
  onToggleActive, 
  onAddSubmenu,
  expandedItems,
  toggleExpanded,
  sensors,
  onSubmenuDragEnd,
}: SortableMenuItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.has(item.id);
  const isCascadeMenu = !item.href && hasChildren;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'flex items-center gap-2 p-3 rounded-lg border bg-card transition-all',
          isDragging && 'opacity-50 shadow-lg',
          !item.is_active && 'opacity-60'
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab hover:bg-muted p-1 rounded"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>

        {hasChildren && (
          <button
            onClick={() => toggleExpanded(item.id)}
            className="p-1 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}

        <div className={cn(
          'flex items-center justify-center w-8 h-8 rounded-lg',
          item.is_active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        )}>
          <DynamicIcon name={item.icon} className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{item.title}</span>
            {isCascadeMenu && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                cascata
              </span>
            )}
            {item.show_badge && (
              <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">
                badge
              </span>
            )}
          </div>
          {item.href && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              {item.href}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={item.is_active}
            onCheckedChange={() => onToggleActive(item)}
            className="data-[state=checked]:bg-green-500"
          />
          
          {!item.parent_id && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onAddSubmenu(item.id)}
              title="Adicionar submenu"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(item)}
          >
            <Pencil className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(item)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Submenus with drag & drop */}
      {isExpanded && hasChildren && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => onSubmenuDragEnd(event, item.id, item.children!)}
        >
          <SortableContext
            items={item.children!.map(child => child.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="ml-8 mt-2 space-y-2 border-l-2 border-primary/20 pl-4">
              {item.children!.map((child) => (
                <SortableSubmenuItem
                  key={child.id}
                  item={child}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleActive={onToggleActive}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// Componente para submenu arrastável
interface SortableSubmenuItemProps {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  onToggleActive: (item: MenuItem) => void;
}

function SortableSubmenuItem({
  item,
  onEdit,
  onDelete,
  onToggleActive,
}: SortableSubmenuItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg border bg-card/50',
        isDragging && 'opacity-50 shadow-lg z-50',
        !item.is_active && 'opacity-60'
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab hover:bg-muted p-1 rounded"
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>

      <div className="flex items-center justify-center w-6 h-6 rounded bg-muted">
        <DynamicIcon name={item.icon} className="h-3 w-3" />
      </div>

      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate">{item.title}</span>
        {item.href && (
          <span className="text-xs text-muted-foreground ml-2">{item.href}</span>
        )}
      </div>

      <Switch
        checked={item.is_active}
        onCheckedChange={() => onToggleActive(item)}
        className="scale-75"
      />

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onEdit(item)}
      >
        <Pencil className="h-3 w-3" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={() => onDelete(item)}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function MenuConfiguration() {
  const { data: menuHierarchy, items: allItems, isLoading } = useMenuHierarchy();
  const createMenuItem = useCreateMenuItem();
  const updateMenuItem = useUpdateMenuItem();
  const deleteMenuItem = useDeleteMenuItem();
  const reorderMenuItems = useReorderMenuItems();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [parentIdForNew, setParentIdForNew] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<MenuItem | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAddMenu = () => {
    setEditingItem(null);
    setParentIdForNew(null);
    setIsModalOpen(true);
  };

  const handleAddSubmenu = (parentId: string) => {
    setEditingItem(null);
    setParentIdForNew(parentId);
    setExpandedItems(prev => new Set([...prev, parentId]));
    setIsModalOpen(true);
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setParentIdForNew(null);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (item: MenuItem) => {
    await updateMenuItem.mutateAsync({
      id: item.id,
      is_active: !item.is_active,
    });
  };

  const handleSave = async (data: MenuItemInput) => {
    if (editingItem) {
      await updateMenuItem.mutateAsync({
        id: editingItem.id,
        ...data,
      });
    } else {
      await createMenuItem.mutateAsync(data);
    }
    setIsModalOpen(false);
    setEditingItem(null);
    setParentIdForNew(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteMenuItem.mutateAsync(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id && menuHierarchy) {
      const oldIndex = menuHierarchy.findIndex((item) => item.id === active.id);
      const newIndex = menuHierarchy.findIndex((item) => item.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(menuHierarchy, oldIndex, newIndex);
        const updates = newOrder.map((item, index) => ({
          id: item.id,
          position: index + 1,
        }));

        await reorderMenuItems.mutateAsync(updates);
      }
    }
  };

  const handleSubmenuDragEnd = async (event: DragEndEvent, parentId: string, children: MenuItem[]) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = children.findIndex((item) => item.id === active.id);
      const newIndex = children.findIndex((item) => item.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(children, oldIndex, newIndex);
        const updates = newOrder.map((item, index) => ({
          id: item.id,
          position: index + 1,
          parent_id: parentId,
        }));

        await reorderMenuItems.mutateAsync(updates);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Configuração do Menu</CardTitle>
            <CardDescription>
              Organize a estrutura do menu lateral. Arraste para reordenar, deixe a rota vazia para criar menus cascata.
            </CardDescription>
          </div>
          <Button onClick={handleAddMenu}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Menu
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {menuHierarchy && menuHierarchy.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={menuHierarchy.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {menuHierarchy.map((item) => (
                  <SortableMenuItem
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                    onDelete={setDeleteConfirm}
                    onToggleActive={handleToggleActive}
                    onAddSubmenu={handleAddSubmenu}
                    expandedItems={expandedItems}
                    toggleExpanded={toggleExpanded}
                    sensors={sensors}
                    onSubmenuDragEnd={handleSubmenuDragEnd}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>Nenhum item de menu configurado.</p>
            <Button variant="outline" className="mt-4" onClick={handleAddMenu}>
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro menu
            </Button>
          </div>
        )}
      </CardContent>

      <MenuItemModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
          setParentIdForNew(null);
        }}
        onSave={handleSave}
        editingItem={editingItem}
        parentId={parentIdForNew}
        isSubmitting={createMenuItem.isPending || updateMenuItem.isPending}
        allMenuItems={allItems || []}
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteConfirm?.title}"?
              {deleteConfirm?.children && deleteConfirm.children.length > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  Atenção: Todos os {deleteConfirm.children.length} submenus também serão excluídos!
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMenuItem.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
