import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { Loader2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusFunnelData, formatDuration } from '@/hooks/useLeadJourneyDashboard';

interface StatusDurationChartProps {
  data: StatusFunnelData[];
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-foreground">{data.status}</p>
        <p className="text-sm text-muted-foreground">
          Tempo médio: <span className="font-semibold text-primary">{formatDuration(data.avgDuration)}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Leads: <span className="font-semibold text-foreground">{data.count}</span>
        </p>
      </div>
    );
  }
  return null;
};

// Custom label that shows formatted duration
const DurationLabel = (props: any) => {
  const { x, y, width, value } = props;
  if (!value || value === 0) return null;
  
  return (
    <text
      x={x + width + 5}
      y={y + 12}
      fill="hsl(var(--foreground))"
      fontSize={11}
      fontWeight={500}
    >
      {formatDuration(value)}
    </text>
  );
};

export function StatusDurationChart({ data, isLoading }: StatusDurationChartProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Tempo em Cada Status
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-80">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  // Filter only statuses with duration data
  const filteredData = data?.filter(d => d.avgDuration > 0) || [];

  if (filteredData.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Tempo em Cada Status
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-80 gap-2">
          <Clock className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground text-center">
            Dados de duração serão exibidos<br />após mudanças de status
          </p>
        </CardContent>
      </Card>
    );
  }

  // Truncate long status names
  const chartData = filteredData.map(d => ({
    ...d,
    shortName: d.status.length > 18 ? d.status.slice(0, 18) + '...' : d.status,
  }));

  const maxDuration = Math.max(...filteredData.map(d => d.avgDuration));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Tempo em Cada Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 80, left: 20, bottom: 5 }}
          >
            <XAxis 
              type="number" 
              domain={[0, maxDuration * 1.2]}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickFormatter={(value) => formatDuration(value)}
            />
            <YAxis 
              type="category" 
              dataKey="shortName"
              width={110}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="avgDuration" 
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={`hsl(var(--primary) / ${0.4 + (index * 0.1)})`}
                />
              ))}
              <LabelList 
                dataKey="avgDuration" 
                content={<DurationLabel />}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
