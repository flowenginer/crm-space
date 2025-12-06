import { LucideIcon, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: 'purple' | 'blue' | 'orange' | 'green' | 'pink' | 'cyan';
  isLoading?: boolean;
}

const colorVariants = {
  purple: {
    gradient: 'from-purple-500 to-pink-500',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    text: 'text-purple-600 dark:text-purple-400',
  },
  blue: {
    gradient: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
  },
  orange: {
    gradient: 'from-orange-500 to-amber-500',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-600 dark:text-orange-400',
  },
  green: {
    gradient: 'from-green-500 to-emerald-500',
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-600 dark:text-green-400',
  },
  pink: {
    gradient: 'from-pink-500 to-rose-500',
    bg: 'bg-pink-100 dark:bg-pink-900/30',
    text: 'text-pink-600 dark:text-pink-400',
  },
  cyan: {
    gradient: 'from-cyan-500 to-teal-500',
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-600 dark:text-cyan-400',
  },
};

export function KPICard({ title, value, subtitle, icon: Icon, trend, color, isLoading }: KPICardProps) {
  const colors = colorVariants[color];

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-5 shadow-elevated hover:shadow-elevated-lg transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            {title}
          </p>
          
          {isLoading ? (
            <div className="h-9 flex items-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <h3 className="text-2xl font-bold text-foreground tracking-tight">
                {value}
              </h3>
              
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
              
              {trend && (
                <div className={cn(
                  "flex items-center gap-1 text-sm font-medium",
                  trend.isPositive ? "text-success" : "text-destructive"
                )}>
                  {trend.isPositive ? (
                    <TrendingUp className="h-4 w-4" />
                  ) : (
                    <TrendingDown className="h-4 w-4" />
                  )}
                  <span>{trend.value}%</span>
                </div>
              )}
            </>
          )}
        </div>
        
        <div className={cn(
          "p-3 rounded-xl bg-gradient-to-br shadow-lg group-hover:scale-110 transition-transform duration-300",
          colors.gradient
        )}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}
