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
  const totalItems = data.length;

  // Calculate width for each stage (starts at 100% and decreases proportionally)
  const getWidthPercent = (index: number, count: number) => {
    // Base width decreases as we go down the funnel
    const baseWidth = 100 - (index * (70 / totalItems));
    // Also factor in the actual count relative to max
    const countFactor = maxCount > 0 ? (count / maxCount) : 0;
    // Blend both factors for a natural funnel look
    return Math.max(baseWidth * 0.7 + countFactor * 30, 15);
  };

  return (
    <div className="space-y-0 py-4">
      {data.map((item, index) => {
        const currentWidth = getWidthPercent(index, item.count);
        const nextWidth = index < data.length - 1 
          ? getWidthPercent(index + 1, data[index + 1].count) 
          : currentWidth * 0.7;
        
        const isSelected = selectedStatus === item.statusName;
        const isLast = index === data.length - 1;

        // Calculate clip-path for trapezoid shape
        const topLeftOffset = (100 - currentWidth) / 2;
        const topRightOffset = (100 + currentWidth) / 2;
        const bottomLeftOffset = (100 - nextWidth) / 2;
        const bottomRightOffset = (100 + nextWidth) / 2;

        const clipPath = isLast
          ? `polygon(${topLeftOffset}% 0%, ${topRightOffset}% 0%, 50% 100%, 50% 100%)`
          : `polygon(${topLeftOffset}% 0%, ${topRightOffset}% 0%, ${bottomRightOffset}% 100%, ${bottomLeftOffset}% 100%)`;

        return (
          <button
            key={item.statusId}
            onClick={() => onStatusClick?.(item.statusName)}
            className={`w-full transition-all duration-200 group ${
              isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-center gap-4">
              {/* Left: Status Name */}
              <div className="w-[140px] flex-shrink-0 text-right pr-2">
                <span className={`text-sm font-medium truncate ${
                  isSelected ? 'text-primary' : 'text-foreground'
                }`}>
                  {item.statusName}
                </span>
              </div>

              {/* Center: Funnel Trapezoid */}
              <div className="flex-1 relative flex justify-center">
                <div 
                  className={`relative transition-all duration-300 ${
                    isSelected ? 'brightness-110' : 'group-hover:brightness-105'
                  }`}
                  style={{
                    width: '100%',
                    height: isLast ? '32px' : '40px',
                    clipPath,
                    backgroundColor: item.color,
                  }}
                >
                  {/* Count centered in trapezoid */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`font-bold text-white drop-shadow-md ${
                      isLast ? 'text-sm' : 'text-base'
                    }`}>
                      {item.count}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Percentage */}
              <div className="w-[70px] flex-shrink-0 text-left pl-2">
                <span className={`text-sm font-semibold ${
                  isSelected ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
