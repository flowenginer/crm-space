import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { Loader2 } from 'lucide-react';
import type { LeadStatusCount } from '@/hooks/useDashboardAdvanced';

interface LeadStatusChartProps {
  data: LeadStatusCount[];
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-lg">
        <p className="font-semibold text-foreground">{data.status}</p>
        <p className="text-sm text-muted-foreground">
          {data.count} leads
        </p>
      </div>
    );
  }
  return null;
};

export function LeadStatusChart({ data, isLoading }: LeadStatusChartProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <h3 className="text-lg font-semibold text-foreground mb-4">Leads por Status</h3>
        <div className="h-[300px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Truncate status names for display
  const chartData = data.slice(0, 10).map(item => ({
    ...item,
    shortStatus: item.status.length > 20 
      ? item.status.substring(0, 20) + '...' 
      : item.status
  }));

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
      <h3 className="text-lg font-semibold text-foreground mb-4">Leads por Status</h3>
      
      {chartData.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          <p>Nenhum dado disponível</p>
        </div>
      ) : (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
            >
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="shortStatus" 
                width={95}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="count" 
                radius={[0, 6, 6, 0]}
                barSize={24}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
