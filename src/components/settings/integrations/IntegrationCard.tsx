import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IntegrationCardProps {
  icon: LucideIcon;
  name: string;
  description: string;
  isConfigured: boolean;
  color?: string;
  onClick: () => void;
}

export function IntegrationCard({
  icon: Icon,
  name,
  description,
  isConfigured,
  color = 'hsl(var(--primary))',
  onClick,
}: IntegrationCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-center justify-center p-6 rounded-xl border bg-card text-card-foreground',
        'transition-all duration-200 hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5',
        'focus:outline-none focus:ring-2 focus:ring-primary/20',
        isConfigured && 'border-green-500/30'
      )}
    >
      {/* Status indicator */}
      <div
        className={cn(
          'absolute top-3 right-3 w-2 h-2 rounded-full',
          isConfigured ? 'bg-green-500' : 'bg-muted-foreground/30'
        )}
      />

      {/* Icon */}
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-7 h-7" style={{ color }} />
      </div>

      {/* Name */}
      <h3 className="font-semibold text-sm mb-1">{name}</h3>

      {/* Description */}
      <p className="text-xs text-muted-foreground text-center line-clamp-2">
        {description}
      </p>

      {/* Status badge */}
      <span
        className={cn(
          'mt-3 px-2.5 py-1 rounded-full text-[10px] font-medium uppercase tracking-wide',
          isConfigured
            ? 'bg-green-500/10 text-green-600'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isConfigured ? 'Configurado' : 'Não configurado'}
      </span>
    </button>
  );
}
