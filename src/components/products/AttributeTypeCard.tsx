import { useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, MoreHorizontal, Pencil, Plus, Trash2, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  type AttributeTypeWithValues,
  useDeleteAttributeType,
  useReorderAttributeValues,
} from '@/hooks/useProductAttributes';
import { AttributeValueRow } from './AttributeValueRow';
import { AttributeValueModal } from './AttributeValueModal';
import { BulkValueModal } from './BulkValueModal';
import { toast } from 'sonner';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

interface AttributeTypeCardProps {
  attributeType: AttributeTypeWithValues;
  onEdit: (type: AttributeTypeWithValues) => void;
}

export function AttributeTypeCard({ attributeType, onEdit }: AttributeTypeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showValueModal, setShowValueModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingValue, setEditingValue] = useState<AttributeTypeWithValues['values'][0] | null>(null);

  const deleteMutation = useDeleteAttributeType();
  const reorderValuesMutation = useReorderAttributeValues();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: attributeType.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(attributeType.id);
      toast.success('Atributo excluído com sucesso');
      setShowDeleteDialog(false);
    } catch (error) {
      toast.error('Erro ao excluir atributo');
    }
  };

  const handleValueDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = attributeType.values.findIndex((v) => v.id === active.id);
      const newIndex = attributeType.values.findIndex((v) => v.id === over.id);

      const newOrder = arrayMove(attributeType.values, oldIndex, newIndex);
      const updates = newOrder.map((item, index) => ({
        id: item.id,
        display_order: index + 1,
      }));

      reorderValuesMutation.mutate(updates);
    }
  };

  const handleEditValue = (value: AttributeTypeWithValues['values'][0]) => {
    setEditingValue(value);
    setShowValueModal(true);
  };

  const handleCloseValueModal = () => {
    setShowValueModal(false);
    setEditingValue(null);
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'rounded-xl border bg-card transition-all',
          isDragging && 'opacity-50 shadow-lg',
          isExpanded && 'ring-2 ring-primary/20'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          >
            <GripVertical className="h-5 w-5" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex flex-1 items-center gap-3 text-left"
          >
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">{attributeType.name}</span>
                {attributeType.is_required && (
                  <Badge variant="secondary" className="text-xs">Obrigatório</Badge>
                )}
                {!attributeType.is_active && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                )}
              </div>
              {attributeType.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{attributeType.description}</p>
              )}
            </div>
            <Badge variant="outline" className="text-xs">
              {attributeType.values.length} {attributeType.values.length === 1 ? 'valor' : 'valores'}
            </Badge>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(attributeType)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t px-4 pb-4">
            {/* Values List */}
            {attributeType.values.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleValueDragEnd}
              >
                <SortableContext
                  items={attributeType.values.map((v) => v.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="mt-3 space-y-1">
                    {attributeType.values.map((value) => (
                      <AttributeValueRow
                        key={value.id}
                        value={value}
                        onEdit={handleEditValue}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="mt-4 flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 py-6">
                <p className="text-sm text-muted-foreground">Nenhum valor cadastrado</p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowValueModal(true)}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar Valor
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkModal(true)}
                className="gap-2"
              >
                <List className="h-4 w-4" />
                Adicionar Vários
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir atributo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o atributo "{attributeType.name}"? 
              {attributeType.values.length > 0 && (
                <span className="block mt-2 text-destructive">
                  Isso também excluirá {attributeType.values.length} {attributeType.values.length === 1 ? 'valor associado' : 'valores associados'}.
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
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Value Modal */}
      <AttributeValueModal
        open={showValueModal}
        onOpenChange={handleCloseValueModal}
        attributeTypeId={attributeType.id}
        editingValue={editingValue}
      />

      {/* Bulk Modal */}
      <BulkValueModal
        open={showBulkModal}
        onOpenChange={setShowBulkModal}
        attributeTypeId={attributeType.id}
      />
    </>
  );
}
