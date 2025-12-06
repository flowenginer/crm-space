import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  LabelList
} from 'recharts';
import { Loader2 } from 'lucide-react';
import type { FunnelData } from '@/hooks/useDashboardAdvanced';

interface ConversionFunnelProps {
  data: FunnelData[];
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-card border border-border rounded-xl p-3 shadow-lg">
        <p className="font-semibold text-foreground">{data.stage}</p>
        <p className="text-sm text-muted-foreground">
          {data.value} leads
        </p>
      </div>
    );
  }
  return null;
};

export function ConversionFunnel({ data, isLoading }: ConversionFunnelProps) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <h3 className="text-lg font-semibold text-foreground mb-4">Funil de Conversão</h3>
        <div className="h-[250px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
      <h3 className="text-lg font-semibold text-foreground mb-4">Funil de Conversão</h3>
      
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ top: 5, right: 50, left: 20, bottom: 5 }}
          >
            <XAxis type="number" hide domain={[0, maxValue]} />
            <YAxis 
              type="category" 
              dataKey="stage" 
              width={100}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="value" 
              radius={[0, 8, 8, 0]}
              barSize={32}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
              <LabelList 
                dataKey="value" 
                position="right" 
                fill="hsl(var(--foreground))"
                fontSize={14}
                fontWeight={600}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
