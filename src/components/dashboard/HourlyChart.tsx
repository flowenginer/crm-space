import { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { Loader2, Clock } from 'lucide-react';
import type { HourlyData } from '@/hooks/useDashboardAdvanced';

interface HourlyChartProps {
  data: HourlyData[];
  isLoading?: boolean;
}

const METRICS = [
  { key: 'newLeads', name: 'Novos Leads', color: '#8B5CF6' },
  { key: 'messagesSent', name: 'Msgs Enviadas', color: '#10B981' },
  { key: 'messagesReceived', name: 'Msgs Recebidas', color: '#3B82F6' },
  { key: 'leadResponses', name: 'Respostas de Leads', color: '#F59E0B' },
  { key: 'noResponse', name: 'Sem Resposta', color: '#EF4444' },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function HourlyChart({ data, isLoading }: HourlyChartProps) {
  const [visibleMetrics, setVisibleMetrics] = useState<Set<string>>(
    new Set(METRICS.map(m => m.key))
  );

  const toggleMetric = (key: string) => {
    setVisibleMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasData = data.some(d => 
    d.newLeads > 0 || 
    d.messagesSent > 0 || 
    d.messagesReceived > 0 || 
    d.leadResponses > 0 || 
    d.noResponse > 0
  );

  if (!hasData) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado disponível para o período</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Interactive Legend */}
      <div className="flex flex-wrap gap-2 justify-center">
        {METRICS.map(metric => (
          <button
            key={metric.key}
            onClick={() => toggleMetric(metric.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              visibleMetrics.has(metric.key)
                ? 'bg-opacity-20 border-2'
                : 'bg-muted/50 border-2 border-transparent opacity-50'
            }`}
            style={{
              backgroundColor: visibleMetrics.has(metric.key) ? `${metric.color}20` : undefined,
              borderColor: visibleMetrics.has(metric.key) ? metric.color : 'transparent',
              color: visibleMetrics.has(metric.key) ? metric.color : undefined
            }}
          >
            <div 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: metric.color }}
            />
            {metric.name}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              {METRICS.map(metric => (
                <linearGradient key={metric.key} id={`color${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metric.color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={metric.color} stopOpacity={0}/>
                </linearGradient>
              ))}
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            
            <XAxis 
              dataKey="hour" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              interval={1}
            />
            
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            {METRICS.map(metric => (
              visibleMetrics.has(metric.key) && (
                <Area
                  key={metric.key}
                  type="monotone"
                  dataKey={metric.key}
                  stroke={metric.color}
                  strokeWidth={2}
                  fill={`url(#color${metric.key})`}
                  name={metric.name}
                  dot={{ fill: metric.color, strokeWidth: 2, r: 2 }}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              )
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}