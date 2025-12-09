import { Loader2, PieChart } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { SegmentData } from '@/hooks/useMetaAdsAnalytics';

interface SegmentChartProps {
  data: SegmentData[];
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as SegmentData;
    return (
      <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
        <p className="font-semibold text-foreground mb-2">{data.segment}</p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Leads:</span>
            <span className="font-medium text-foreground">{data.leads}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Conversões:</span>
            <span className="font-medium text-foreground">{data.conversions}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Taxa:</span>
            <span className="font-medium text-foreground">{data.conversionRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function SegmentChart({ data, isLoading }: SegmentChartProps) {
  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <PieChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum dado de segmento disponível</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 10, right: 60, left: 80, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={true} vertical={false} />
          <XAxis
            type="number"
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="segment"
            stroke="hsl(var(--muted-foreground))"
            fontSize={13}
            tickLine={false}
            axisLine={false}
            width={75}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
          <Bar
            dataKey="leads"
            radius={[0, 6, 6, 0]}
            maxBarSize={40}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
            <LabelList
              dataKey="leads"
              position="right"
              fill="hsl(var(--foreground))"
              fontSize={12}
              fontWeight={600}
              formatter={(value: number) => value.toLocaleString('pt-BR')}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legenda com métricas */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {data.map((segment) => (
          <div
            key={segment.segment}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50"
          >
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: segment.color }}
            />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{segment.segment}</p>
              <p className="text-xs text-muted-foreground">
                {segment.conversionRate.toFixed(1)}% conv.
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
