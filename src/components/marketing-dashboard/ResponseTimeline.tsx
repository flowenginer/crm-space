import { Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ResponseTimelineData } from '@/hooks/useMarketingDashboard';

interface ResponseTimelineProps {
  data: ResponseTimelineData[] | undefined;
  isLoading: boolean;
}

export function ResponseTimeline({ data, isLoading }: ResponseTimelineProps) {
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
        Nenhuma resposta registrada no período
      </div>
    );
  }

  const chartData = data.map(item => ({
    ...item,
    dateFormatted: format(parseISO(item.date), 'dd/MM', { locale: ptBR }),
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="dateFormatted"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
            }}
            labelFormatter={(value) => `Data: ${value}`}
            formatter={(value: number, name: string) => [
              value.toLocaleString('pt-BR'),
              name === 'responses' ? 'Respostas' : 'Conclusões'
            ]}
          />
          <Legend
            formatter={(value) => value === 'responses' ? 'Respostas' : 'Conclusões'}
          />
          <Line
            type="monotone"
            dataKey="responses"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="completions"
            stroke="hsl(var(--success))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--success))', strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
