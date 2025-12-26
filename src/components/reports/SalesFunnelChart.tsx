import { useMemo } from 'react';

interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
  color: string;
}

interface SalesFunnelChartProps {
  data: FunnelStage[];
}

export function SalesFunnelChart({ data }: SalesFunnelChartProps) {
  const maxCount = useMemo(() => Math.max(...data.map(d => d.count), 1), [data]);

  return (
    <div className="space-y-3">
      {data.map((stage, index) => {
        const widthPercent = Math.max((stage.count / maxCount) * 100, 10);
        
        return (
          <div key={stage.stage} className="relative">
            <div className="flex items-center gap-3">
              <div className="w-32 text-sm font-medium text-foreground truncate">
                {stage.stage}
              </div>
              <div className="flex-1 relative">
                <div
                  className="h-10 rounded-lg flex items-center justify-end px-3 transition-all duration-500"
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: stage.color,
                    opacity: 0.9 - (index * 0.1),
                  }}
                >
                  <span className="text-white text-sm font-bold">
                    {stage.count}
                  </span>
                </div>
              </div>
              <div className="w-14 text-right text-sm text-muted-foreground">
                {stage.percentage}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
