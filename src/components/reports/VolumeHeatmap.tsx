import { useMemo } from 'react';

interface HourlyData {
  day: string;
  hour: number;
  value: number;
}

interface VolumeHeatmapProps {
  data: HourlyData[];
}

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function getColor(value: number, max: number): string {
  if (max === 0 || value === 0) return 'hsl(var(--muted))';
  const intensity = Math.min(value / max, 1);
  
  if (intensity > 0.75) return 'hsl(var(--primary))';
  if (intensity > 0.5) return 'hsl(var(--primary) / 0.7)';
  if (intensity > 0.25) return 'hsl(var(--primary) / 0.4)';
  return 'hsl(var(--primary) / 0.15)';
}

export function VolumeHeatmap({ data }: VolumeHeatmapProps) {
  const { grid, maxValue } = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let maxValue = 0;

    data.forEach(d => {
      const dayIndex = DAYS.findIndex(day => d.day.startsWith(day));
      if (dayIndex >= 0 && d.hour >= 0 && d.hour < 24) {
        grid[dayIndex][d.hour] += d.value;
        maxValue = Math.max(maxValue, grid[dayIndex][d.hour]);
      }
    });

    return { grid, maxValue };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Sem dados para gerar o heatmap
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header - Hours */}
        <div className="flex gap-1 mb-1 ml-10">
          {HOURS.filter((_, i) => i % 3 === 0).map(hour => (
            <div 
              key={hour} 
              className="text-xs text-muted-foreground text-center"
              style={{ width: '36px' }}
            >
              {hour.toString().padStart(2, '0')}h
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex flex-col gap-1">
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground w-8 text-right">{day}</span>
              <div className="flex gap-0.5">
                {HOURS.map(hour => {
                  const value = grid[dayIndex][hour];
                  return (
                    <div
                      key={`${day}-${hour}`}
                      className="w-3 h-3 rounded-sm transition-colors cursor-default"
                      style={{ backgroundColor: getColor(value, maxValue) }}
                      title={`${day} ${hour}h: ${value} atendimentos`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-end gap-2 mt-3">
          <span className="text-xs text-muted-foreground">Menos</span>
          <div className="flex gap-0.5">
            {[0.1, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: getColor(intensity * maxValue, maxValue) }}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">Mais</span>
        </div>
      </div>
    </div>
  );
}
