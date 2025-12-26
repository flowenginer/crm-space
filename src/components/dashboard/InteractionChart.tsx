import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';
import type { InteractionHourlyData } from '@/hooks/useDashboardAdvanced';

interface InteractionChartProps {
  data: InteractionHourlyData[];
  isLoading: boolean;
  agentName?: string;
}

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[160px]">
      <p className="font-medium text-foreground mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}</span>
          </div>
          <span className="font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export function InteractionChart({ data, isLoading, agentName }: InteractionChartProps) {
  const title = agentName 
    ? `Interação de ${agentName} por Hora` 
    : 'Interação Cliente vs Vendedor por Hora';

  // Calculate summary stats
  const totalClient = data.reduce((sum, d) => sum + d.clientMessages, 0);
  const totalAgent = data.reduce((sum, d) => sum + d.agentMessages, 0);
  const peakClientHour = data.length > 0 
    ? data.reduce((max, d) => d.clientMessages > max.clientMessages ? d : max, data[0]) 
    : null;
  const peakAgentHour = data.length > 0 
    ? data.reduce((max, d) => d.agentMessages > max.agentMessages ? d : max, data[0]) 
    : null;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const hasData = data.some(d => d.clientMessages > 0 || d.agentMessages > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] flex items-center justify-center">
          <p className="text-muted-foreground">Sem dados de interação para o período selecionado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
          
          {/* Summary badges */}
          <div className="flex flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-2 bg-info/10 text-info px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-info" />
              <span>Cliente: {totalClient} msgs</span>
              {peakClientHour && peakClientHour.clientMessages > 0 && (
                <span className="text-muted-foreground">(pico: {peakClientHour.hour})</span>
              )}
            </div>
            <div className="flex items-center gap-2 bg-success/10 text-success px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-success" />
              <span>Vendedor: {totalAgent} msgs</span>
              {peakAgentHour && peakAgentHour.agentMessages > 0 && (
                <span className="text-muted-foreground">(pico: {peakAgentHour.hour})</span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis 
                dataKey="hour" 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval={3}
              />
              <YAxis 
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '10px' }}
                formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
              />
              <Line 
                type="monotone" 
                dataKey="clientMessages" 
                name="Mensagens do Cliente"
                stroke="hsl(var(--info))" 
                strokeWidth={2.5}
                dot={{ fill: 'hsl(var(--info))', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
              <Line 
                type="monotone" 
                dataKey="agentMessages" 
                name="Mensagens do Vendedor"
                stroke="hsl(var(--success))" 
                strokeWidth={2.5}
                dot={{ fill: 'hsl(var(--success))', strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
