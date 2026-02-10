import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';

export interface TimelineDataPoint {
  date: string;
  leads: number;
  catalogo: number;
  layout: number;
  fechado: number;
}

interface CampaignTimelineChartProps {
  data: TimelineDataPoint[];
  isLoading?: boolean;
}

const COLORS = {
  leads: '#6366F1',      // Indigo
  catalogo: '#F59E0B',   // Amber
  layout: '#8B5CF6',     // Violet
  fechado: '#10B981',    // Emerald
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
        <p className="font-semibold text-foreground mb-3">{label}</p>
        <div className="space-y-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{entry.name}</span>
              </div>
              <span className="font-semibold text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function CampaignTimelineChart({ data, isLoading }: CampaignTimelineChartProps) {
  const hasData = data && data.length > 0 && data.some(d => d.leads > 0);

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Evolução Temporal</h3>
        </div>
        <div className="h-[350px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Evolução Temporal</h3>
        <span className="text-sm text-muted-foreground ml-2">
          (Leads por dia e status)
        </span>
      </div>

      {!hasData ? (
        <div className="h-[350px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum dado disponível para o período</p>
          </div>
        </div>
      ) : (
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
            >
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
                wrapperStyle={{ fontSize: '13px', paddingTop: '20px' }}
                iconType="circle"
              />

              <Line
                type="monotone"
                dataKey="leads"
                stroke={COLORS.leads}
                strokeWidth={2}
                name="Total Leads"
                dot={{ fill: COLORS.leads, strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />

              <Line
                type="monotone"
                dataKey="catalogo"
                stroke={COLORS.catalogo}
                strokeWidth={2}
                name="Catálogo"
                dot={{ fill: COLORS.catalogo, strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />

              <Line
                type="monotone"
                dataKey="layout"
                stroke={COLORS.layout}
                strokeWidth={2}
                name="Layout"
                dot={{ fill: COLORS.layout, strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />

              <Line
                type="monotone"
                dataKey="fechado"
                stroke={COLORS.fechado}
                strokeWidth={2}
                name="Pedido Fechado"
                dot={{ fill: COLORS.fechado, strokeWidth: 0, r: 3 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
