import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface OriginData {
  origin: string;
  count: number;
  revenue: number;
  percentage: number;
}

interface SalesOriginChartProps {
  data: OriginData[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#8B5CF6',
  '#06B6D4',
  '#EF4444',
];

export function SalesOriginChart({ data }: SalesOriginChartProps) {
  const chartData = data.map((item, index) => ({
    name: item.origin,
    value: item.count,
    revenue: item.revenue,
    color: COLORS[index % COLORS.length],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Conversões: <span className="text-foreground font-medium">{data.value}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Faturamento: <span className="text-status-success font-medium">
              R$ {data.revenue.toLocaleString()}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
