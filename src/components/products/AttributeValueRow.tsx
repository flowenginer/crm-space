import { useState } from 'react';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { type AttributeValue, useDeleteAttributeValue } from '@/hooks/useProductAttributes';
import { toast } from 'sonner';

interface AttributeValueRowProps {
  value: AttributeValue;
  onEdit: (value: AttributeValue) => void;
}

export function AttributeValueRow({ value, onEdit }: AttributeValueRowProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteMutation = useDeleteAttributeValue();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: value.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(value.id);
      toast.success('Valor excluído com sucesso');
      setShowDeleteDialog(false);
    } catch (error) {
      toast.error('Erro ao excluir valor');
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2 transition-all hover:bg-muted',
          isDragging && 'opacity-50 shadow-md'
        )}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1">
          <span className="text-sm font-medium text-foreground">
            {value.display_value || value.value}
          </span>
          {value.display_value && (
            <span className="ml-2 text-xs text-muted-foreground">({value.value})</span>
          )}
        </div>

        <Badge variant="outline" className="text-xs text-muted-foreground">
          {value.slug}
        </Badge>

        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(value)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir valor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o valor "{value.value}"?
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
    </>
  );
}
