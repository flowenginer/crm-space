import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggableDashboardCardProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function DraggableDashboardCard({ id, children, className }: DraggableDashboardCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        isDragging && "z-50 opacity-90 shadow-2xl scale-[1.02]",
        className
      )}
    >
      {/* Drag Handle */}
      <button
        {...attributes}
        {...listeners}
        className={cn(
          "absolute -top-2 left-1/2 -translate-x-1/2 z-10",
          "flex items-center gap-1 px-2 py-1 rounded-full",
          "bg-muted/80 backdrop-blur-sm border border-border shadow-sm",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
          "cursor-grab active:cursor-grabbing",
          "hover:bg-muted hover:border-primary/50"
        )}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground font-medium">Arrastar</span>
      </button>
      
      {children}
    </div>
  );
}
