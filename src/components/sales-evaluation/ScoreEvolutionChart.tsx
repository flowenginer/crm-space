import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ScoreEvolutionData {
  week: string;
  avgScore: number;
  count: number;
}

interface ScoreEvolutionChartProps {
  data: ScoreEvolutionData[] | undefined;
  isLoading: boolean;
}

export function ScoreEvolutionChart({ data, isLoading }: ScoreEvolutionChartProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolução do Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolução do Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Dados não disponíveis
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(d => ({
    ...d,
    weekLabel: format(parseISO(d.week), 'dd/MM', { locale: ptBR }),
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Evolução do Score (Semanal)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="weekLabel" 
              tick={{ fontSize: 11 }}
              tickLine={false}
            />
            <YAxis 
              domain={[0, 10]} 
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip 
              formatter={(value: number, name: string) => {
                if (name === 'avgScore') return [value.toFixed(1), 'Score Médio'];
                if (name === 'count') return [value, 'Avaliações'];
                return [value, name];
              }}
              labelFormatter={(label: string) => `Semana de ${label}`}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <ReferenceLine 
              y={7} 
              stroke="hsl(142, 76%, 36%)" 
              strokeDasharray="3 3" 
              label={{ value: 'Meta', position: 'right', fontSize: 10 }}
            />
            <ReferenceLine 
              y={5} 
              stroke="hsl(48, 96%, 53%)" 
              strokeDasharray="3 3"
            />
            <Area
              type="monotone"
              dataKey="avgScore"
              stroke="hsl(var(--primary))"
              fill="url(#scoreGradient)"
              strokeWidth={0}
            />
            <Line
              type="monotone"
              dataKey="avgScore"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
