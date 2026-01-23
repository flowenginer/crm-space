import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DailyTemplateStat } from '@/hooks/useTemplateStats';

interface TemplatesTimelineChartProps {
  data: DailyTemplateStat[];
  isLoading?: boolean;
}

export function TemplatesTimelineChart({ data, isLoading }: TemplatesTimelineChartProps) {
  const chartData = data.map(stat => ({
    date: stat.date,
    displayDate: format(parseISO(stat.date), 'dd/MM', { locale: ptBR }),
    count: stat.count,
  }));

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Envios por Dia
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[250px] flex items-center justify-center">
          <div className="text-muted-foreground">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Envios por Dia
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[250px] flex items-center justify-center">
          <div className="text-muted-foreground text-sm">Nenhum dado disponível</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Envios por Dia
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="displayDate" 
              className="text-xs"
              tick={{ fontSize: 11 }}
            />
            <YAxis className="text-xs" tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => [
                `${value.toLocaleString('pt-BR')} templates`,
                'Enviados',
              ]}
              labelFormatter={(label) => {
                const item = chartData.find(d => d.displayDate === label);
                return item ? format(parseISO(item.date), "dd 'de' MMMM", { locale: ptBR }) : label;
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCount)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
