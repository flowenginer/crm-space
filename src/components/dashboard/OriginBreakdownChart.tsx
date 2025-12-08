import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LeadOriginData } from '@/hooks/useLeadJourneyDashboard';

interface OriginBreakdownChartProps {
  data: LeadOriginData[];
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-foreground">{data.label}</p>
        <p className="text-sm text-muted-foreground">
          Total: <span className="font-semibold text-foreground">{data.total}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Conversões: <span className="font-semibold text-primary">{data.converted}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          Taxa: <span className="font-semibold text-accent">{data.conversionRate.toFixed(1)}%</span>
        </p>
      </div>
    );
  }
  return null;
};

const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {payload?.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export function OriginBreakdownChart({ data, isLoading }: OriginBreakdownChartProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Leads por Origem
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
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
            <TrendingUp className="h-4 w-4 text-primary" />
            Leads por Origem
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    );
  }

  const total = data.reduce((sum, d) => sum + d.total, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Leads por Origem
          </span>
          <span className="text-2xl font-bold text-foreground">{total}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="total"
              nameKey="label"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  className="transition-opacity hover:opacity-80"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {data.slice(0, 4).map((origin) => (
            <div 
              key={origin.origin}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: origin.color }}
                />
                <span className="text-xs text-muted-foreground">{origin.label}</span>
              </div>
              <span className="text-xs font-semibold">{origin.total}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
