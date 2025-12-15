import { LucideIcon, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface IntegrationCardProps {
  icon: LucideIcon;
  name: string;
  description: string;
  isConfigured: boolean;
  color?: string;
  category?: string;
  onClick: () => void;
}

export function IntegrationCard({
  icon: Icon,
  name,
  description,
  isConfigured,
  color = 'hsl(var(--primary))',
  category,
  onClick,
}: IntegrationCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center p-3 rounded-lg border bg-card",
        "hover:shadow-md hover:border-primary/30 transition-all duration-200",
        "text-center group cursor-pointer min-h-[100px]"
      )}
    >
      {/* Status indicator */}
      {isConfigured && (
        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
          <Check className="h-2.5 w-2.5 text-white" />
        </div>
      )}

      {/* Category badge */}
      {category && (
        <Badge 
          variant="secondary" 
          className="absolute top-2 left-2 text-[10px] px-1.5 py-0 h-4 font-normal opacity-70"
        >
          {category}
        </Badge>
      )}

      {/* Icon */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mb-2 mt-3"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="h-5 w-5" style={{ color }} />
      </div>

      {/* Name */}
      <h4 className="font-medium text-sm text-foreground leading-tight">{name}</h4>

      {/* Description */}
      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{description}</p>
    </button>
  );
}
