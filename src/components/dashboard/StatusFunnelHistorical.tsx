import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusFunnelData, formatDuration } from '@/hooks/useLeadJourneyDashboard';

interface StatusFunnelHistoricalProps {
  data: StatusFunnelData[];
  isLoading?: boolean;
  selectedOrigin?: string | null;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-foreground">{data.status}</p>
        <p className="text-sm text-muted-foreground">
          Leads que passaram: <span className="font-semibold text-foreground">{data.count}</span>
        </p>
        {data.avgDuration > 0 && (
          <p className="text-sm text-muted-foreground">
            Tempo médio no status: <span className="font-semibold text-primary">{formatDuration(data.avgDuration)}</span>
          </p>
        )}
      </div>
    );
  }
  return null;
};

export function StatusFunnelHistorical({ data, isLoading, selectedOrigin }: StatusFunnelHistoricalProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Funil de Passagem (Histórico)
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
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Funil de Passagem (Histórico)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-80">
          <p className="text-muted-foreground">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    );
  }

  // Truncate long status names
  const chartData = data.map(d => ({
    ...d,
    shortName: d.status.length > 15 ? d.status.slice(0, 15) + '...' : d.status,
  }));

  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          Funil de Passagem (Histórico)
          {selectedOrigin && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2">
              Filtrado
            </span>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Quantos leads passaram por cada status no período
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis 
              type="number" 
              domain={[0, maxCount * 1.1]}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis 
              type="category" 
              dataKey="shortName"
              width={100}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="count" 
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
              <LabelList 
                dataKey="count" 
                position="right" 
                fill="hsl(var(--foreground))"
                fontSize={12}
                fontWeight={600}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
