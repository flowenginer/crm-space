import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAgentResponseHistory } from '@/hooks/useAgentMonitor';

interface ResponseTimeChartProps {
  alertMinutes: number;
}

// Colors for different agents
const AGENT_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#00C49F',
];

export function ResponseTimeChart({ alertMinutes }: ResponseTimeChartProps) {
  const { data: historyData = [], isLoading } = useAgentResponseHistory(7);

  // Transform data for chart
  const { chartData, agents } = useMemo(() => {
    if (!historyData.length) return { chartData: [], agents: [] };

    // Get unique agents
    const uniqueAgents = [...new Set(historyData.map(d => d.agent_name))];
    
    // Get unique dates
    const uniqueDates = [...new Set(historyData.map(d => d.report_date))].sort();

    // Create chart data structure
    const data = uniqueDates.map(date => {
      const row: Record<string, string | number | null> = {
        date,
        dateLabel: format(parseISO(date), 'dd/MM', { locale: ptBR }),
      };

      uniqueAgents.forEach(agent => {
        const record = historyData.find(
          d => d.report_date === date && d.agent_name === agent
        );
        row[agent] = record?.avg_response_minutes ?? null;
      });

      return row;
    });

    return { chartData: data, agents: uniqueAgents };
  }, [historyData]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!chartData.length) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          <p>Sem dados de histórico disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp size={18} className="text-primary" />
          Tempo Médio de Resposta (últimos 7 dias)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis 
              dataKey="dateLabel" 
              className="text-xs fill-muted-foreground"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              className="text-xs fill-muted-foreground"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${value}min`}
              domain={[0, 'auto']}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number | null) => 
                value !== null ? [`${value.toFixed(1)} min`, ''] : ['Sem dados', '']
              }
            />
            <Legend />
            
            {/* Reference line for alert threshold */}
            <ReferenceLine 
              y={alertMinutes} 
              stroke="hsl(var(--destructive))" 
              strokeDasharray="5 5"
              label={{ 
                value: `Limite (${alertMinutes}min)`, 
                position: 'right',
                fill: 'hsl(var(--destructive))',
                fontSize: 11
              }}
            />

            {/* Lines for each agent */}
            {agents.map((agent, index) => (
              <Line
                key={agent}
                type="monotone"
                dataKey={agent}
                name={agent.split(' ')[0]} // First name only
                stroke={AGENT_COLORS[index % AGENT_COLORS.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>

        {/* Legend with agent names and avg */}
        <div className="mt-4 flex flex-wrap gap-4 justify-center">
          {agents.map((agent, index) => {
            const agentData = historyData.filter(d => d.agent_name === agent);
            const avgMinutes = agentData.length > 0
              ? agentData.reduce((sum, d) => sum + (d.avg_response_minutes || 0), 0) / agentData.length
              : 0;
            
            return (
              <div 
                key={agent}
                className="flex items-center gap-2 text-sm"
              >
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: AGENT_COLORS[index % AGENT_COLORS.length] }}
                />
                <span className="text-muted-foreground">{agent.split(' ')[0]}:</span>
                <span className={`font-semibold ${
                  avgMinutes > alertMinutes ? 'text-destructive' : 'text-foreground'
                }`}>
                  {avgMinutes.toFixed(1)}min
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
