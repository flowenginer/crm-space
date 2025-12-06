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
import { Loader2, BarChart3 } from 'lucide-react';
import type { TimelineData } from '@/hooks/useDashboardAdvanced';

interface TimelineChartProps {
  data: TimelineData[];
  isLoading?: boolean;
}

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

export function TimelineChart({ data, isLoading }: TimelineChartProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <h3 className="text-lg font-semibold text-foreground mb-4">Timeline</h3>
        <div className="h-[300px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const hasData = data.some(d => d.newLeads > 0 || d.conversions > 0);

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
      <h3 className="text-lg font-semibold text-foreground mb-4">Timeline</h3>
      
      {!hasData ? (
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum dado disponível para o período</p>
          </div>
        </div>
      ) : (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorConversions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              
              <XAxis 
                dataKey="date" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              
              <YAxis 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              
              <Tooltip content={<CustomTooltip />} />
              
              <Legend 
                wrapperStyle={{ fontSize: '14px', paddingTop: '20px' }}
                iconType="circle"
              />
              
              <Area
                type="monotone"
                dataKey="newLeads"
                stroke="#8B5CF6"
                strokeWidth={2}
                fill="url(#colorLeads)"
                name="Novos Leads"
                dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
              
              <Area
                type="monotone"
                dataKey="conversions"
                stroke="#10B981"
                strokeWidth={2}
                fill="url(#colorConversions)"
                name="Conversões"
                dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
