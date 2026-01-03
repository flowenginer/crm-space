import { cn } from "@/lib/utils";
import { Users, MessageSquare, User } from "lucide-react";

interface SwipeIndicatorProps {
  total: number;
  current: number;
  labels?: string[];
  onSelect?: (index: number) => void;
}

const icons = [Users, MessageSquare, User];

export function SwipeIndicator({
  total,
  current,
  labels = [],
  onSelect,
}: SwipeIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1 py-3 px-4 bg-background border-t border-border safe-area-inset-bottom">
      {Array.from({ length: total }).map((_, index) => {
        const Icon = icons[index] || MessageSquare;
        const isActive = index === current;

        return (
          <button
            key={index}
            onClick={() => onSelect?.(index)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full transition-all duration-200",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-4 w-4" />
            {labels[index] && (
              <span className={cn(
                "text-xs font-medium transition-all",
                isActive ? "max-w-20 opacity-100" : "max-w-0 opacity-0 overflow-hidden"
              )}>
                {labels[index]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
