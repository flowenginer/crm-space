import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SortableTagCardProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function SortableTagCard({ id, children, disabled }: SortableTagCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group/sortable",
        isDragging && "z-50 opacity-80 shadow-2xl scale-[1.02]"
      )}
    >
      {!disabled && (
        <button
          {...attributes}
          {...listeners}
          className={cn(
            "absolute top-2 left-2 z-10",
            "flex items-center justify-center p-1 rounded-md",
            "bg-muted/80 backdrop-blur-sm border border-border",
            "opacity-0 group-hover/sortable:opacity-100 transition-opacity duration-200",
            "cursor-grab active:cursor-grabbing",
            "hover:bg-muted hover:border-primary/50"
          )}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
      {children}
    </div>
  );
}
