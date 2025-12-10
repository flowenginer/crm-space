import { Loader2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusFunnelData, formatDuration } from '@/hooks/useLeadJourneyDashboard';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface StatusFunnelRealtimeProps {
  data: StatusFunnelData[];
  isLoading?: boolean;
}

export function StatusFunnelRealtime({ data, isLoading }: StatusFunnelRealtimeProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            Status Atual (Tempo Real)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-80">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            Status Atual (Tempo Real)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-80">
          <p className="text-muted-foreground">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.map(d => d.count));
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);
  const totalItems = data.length;

  const getWidthPercent = (index: number, count: number) => {
    const baseWidth = 100 - (index * (70 / totalItems));
    const countFactor = maxCount > 0 ? (count / maxCount) : 0;
    return Math.max(baseWidth * 0.7 + countFactor * 30, 15);
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          Status Atual (Tempo Real)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Quantos leads estão em cada status agora
        </p>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="space-y-0 py-4">
            {data.map((item, index) => {
              const currentWidth = getWidthPercent(index, item.count);
              const nextWidth = index < data.length - 1 
                ? getWidthPercent(index + 1, data[index + 1].count) 
                : currentWidth * 0.7;
              
              const isLast = index === data.length - 1;
              const percentage = totalCount > 0 ? (item.count / totalCount) * 100 : 0;

              const topLeftOffset = (100 - currentWidth) / 2;
              const topRightOffset = (100 + currentWidth) / 2;
              const bottomLeftOffset = (100 - nextWidth) / 2;
              const bottomRightOffset = (100 + nextWidth) / 2;

              const clipPath = isLast
                ? `polygon(${topLeftOffset}% 0%, ${topRightOffset}% 0%, 50% 100%, 50% 100%)`
                : `polygon(${topLeftOffset}% 0%, ${topRightOffset}% 0%, ${bottomRightOffset}% 100%, ${bottomLeftOffset}% 100%)`;

              return (
                <Tooltip key={item.status}>
                  <TooltipTrigger asChild>
                    <div className="w-full transition-all duration-200 group hover:scale-[1.01]">
                      <div className="flex items-center gap-4">
                        {/* Left: Status Name */}
                        <div className="w-[120px] flex-shrink-0 text-right pr-2">
                          <span className="text-sm font-medium truncate text-foreground">
                            {item.status.length > 12 ? item.status.slice(0, 12) + '...' : item.status}
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
                              backgroundColor: item.color,
                            }}
                          >
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
                          <span className="text-sm font-semibold text-muted-foreground">
                            {percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <p className="font-medium">{item.status}</p>
                      <p>Leads: <span className="font-semibold">{item.count}</span></p>
                      {item.avgDuration > 0 && (
                        <p>Tempo médio: <span className="font-semibold text-primary">{formatDuration(item.avgDuration)}</span></p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
