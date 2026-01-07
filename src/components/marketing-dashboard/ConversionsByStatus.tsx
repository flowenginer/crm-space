import { Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { StatusDistribution } from '@/hooks/useMarketingDashboard';

interface ConversionsByStatusProps {
  data: StatusDistribution[] | undefined;
  isLoading: boolean;
}

const COLORS = [
  'hsl(160, 84%, 39%)', // success
  'hsl(217, 91%, 60%)', // info
  'hsl(262, 83%, 58%)', // primary
  'hsl(330, 81%, 60%)', // secondary
  'hsl(38, 92%, 50%)',  // warning
  'hsl(0, 84%, 60%)',   // destructive
  'hsl(215, 13%, 34%)', // muted
];

export function ConversionsByStatus({ data, isLoading }: ConversionsByStatusProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Nenhum dado de status disponível
      </div>
    );
  }

  const chartData = data.map((item, index) => ({
    name: item.status,
    value: item.count,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6">
      <div className="w-full lg:w-1/2 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => value.toLocaleString('pt-BR')}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full lg:w-1/2 space-y-2">
        {data.map((item, index) => (
          <div key={item.status} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-sm font-medium text-foreground flex-1 truncate">
              {item.status}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {item.count.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-muted-foreground min-w-[40px] text-right">
              {item.percentage.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
