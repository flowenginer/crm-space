import { Loader2 } from 'lucide-react';
import type { FunnelData } from '@/hooks/useDashboardAdvanced';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { generateGradientColors } from '@/lib/utils';

interface ConversionFunnelProps {
  data: FunnelData[];
  isLoading?: boolean;
}

export function ConversionFunnel({ data, isLoading }: ConversionFunnelProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <h3 className="text-lg font-semibold text-foreground mb-4">Funil de Conversão</h3>
        <div className="h-[300px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <h3 className="text-lg font-semibold text-foreground mb-4">Funil de Conversão</h3>
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">Nenhum dado disponível</p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const totalValue = data.reduce((sum, d) => sum + d.value, 0);
  const totalItems = data.length;
  const gradientColors = generateGradientColors(totalItems);

  const getWidthPercent = (index: number, value: number) => {
    const baseWidth = 100 - (index * (70 / totalItems));
    const valueFactor = maxValue > 0 ? (value / maxValue) : 0;
    return Math.max(baseWidth * 0.7 + valueFactor * 30, 15);
  };

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
      <h3 className="text-lg font-semibold text-foreground mb-2">Funil de Conversão</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Distribuição de leads por estágio
      </p>
      
      <TooltipProvider>
        <div className="space-y-0 py-4">
          {data.map((item, index) => {
            const currentWidth = getWidthPercent(index, item.value);
            const nextWidth = index < data.length - 1 
              ? getWidthPercent(index + 1, data[index + 1].value) 
              : currentWidth * 0.7;
            
            const isLast = index === data.length - 1;
            const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0;

            const topLeftOffset = (100 - currentWidth) / 2;
            const topRightOffset = (100 + currentWidth) / 2;
            const bottomLeftOffset = (100 - nextWidth) / 2;
            const bottomRightOffset = (100 + nextWidth) / 2;

            const clipPath = isLast
              ? `polygon(${topLeftOffset}% 0%, ${topRightOffset}% 0%, 50% 100%, 50% 100%)`
              : `polygon(${topLeftOffset}% 0%, ${topRightOffset}% 0%, ${bottomRightOffset}% 100%, ${bottomLeftOffset}% 100%)`;

            return (
              <Tooltip key={item.stage}>
                <TooltipTrigger asChild>
                  <div className="w-full transition-all duration-200 group hover:scale-[1.01]">
                    <div className="flex items-center gap-4">
                      {/* Left: Stage Name */}
                      <div className="w-[120px] flex-shrink-0 text-right pr-2">
                        <span className="text-sm font-medium truncate text-foreground">
                          {item.stage.length > 12 ? item.stage.slice(0, 12) + '...' : item.stage}
                        </span>
                      </div>

                      {/* Center: Funnel Trapezoid */}
                      <div className="flex-1 relative flex justify-center">
                        <div 
                          className="relative transition-all duration-300 group-hover:brightness-105"
                          style={{
                            width: '100%',
                            height: isLast ? '32px' : '40px',
                            clipPath,
                            backgroundColor: gradientColors[index],
                          }}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`font-bold text-white drop-shadow-md ${
                              isLast ? 'text-sm' : 'text-base'
                            }`}>
                              {item.value}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Percentage */}
                      <div className="w-[70px] flex-shrink-0 text-left pl-2">
                        <span className="text-sm font-semibold text-muted-foreground">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-sm">
                    <p className="font-medium">{item.stage}</p>
                    <p>Leads: <span className="font-semibold">{item.value}</span></p>
                    <p>Percentual: <span className="font-semibold text-primary">{percentage.toFixed(1)}%</span></p>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}
