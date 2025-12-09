import { FunnelData } from '@/hooks/useMetaAdsAnalytics';
import { Loader2 } from 'lucide-react';

interface MetaFunnelChartProps {
  data: FunnelData[];
  isLoading?: boolean;
  onStatusClick?: (statusName: string) => void;
  selectedStatus?: string | null;
}

export function MetaFunnelChart({ 
  data, 
  isLoading, 
  onStatusClick,
  selectedStatus 
}: MetaFunnelChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <p>Nenhum dado de funil disponível</p>
      </div>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count));

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const widthPercent = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
        const isSelected = selectedStatus === item.statusName;

        return (
          <button
            key={item.statusId}
            onClick={() => onStatusClick?.(item.statusName)}
            className={`w-full text-left transition-all duration-200 group ${
              isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                {/* Background bar */}
                <div className="h-10 rounded-lg bg-muted/30 overflow-hidden">
                  {/* Filled bar */}
                  <div
                    className={`h-full rounded-lg transition-all duration-500 ${
                      isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                    }`}
                    style={{
                      width: `${Math.max(widthPercent, 5)}%`,
                      backgroundColor: item.color,
                      opacity: isSelected ? 1 : 0.85,
                    }}
                  />
                </div>
                {/* Label overlay */}
                <div className="absolute inset-0 flex items-center px-3">
                  <span className="text-sm font-medium text-foreground truncate">
                    {item.statusName}
                  </span>
                </div>
              </div>
              {/* Count */}
              <div className={`min-w-[60px] text-right ${
                isSelected ? 'text-primary font-bold' : 'text-foreground font-semibold'
              }`}>
                <span className="text-lg">{item.count}</span>
                <span className="text-xs text-muted-foreground ml-1">
                  ({item.percentage.toFixed(1)}%)
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
