import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

interface FunnelDataItem {
  name: string;
  value: number;
  color: string;
}

interface DashboardFunnelChartProps {
  data: FunnelDataItem[];
}

export function DashboardFunnelChart({ data }: DashboardFunnelChartProps) {
  // Calcular percentuais em relação ao primeiro item (visitantes)
  const maxValue = data[0]?.value || 1;
  
  const chartData = data.map((item, index) => ({
    ...item,
    percentage: maxValue > 0 ? ((item.value / maxValue) * 100).toFixed(1) : '0',
    dropoff: index > 0 && data[index - 1].value > 0 
      ? (((data[index - 1].value - item.value) / data[index - 1].value) * 100).toFixed(1)
      : null
  }));

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={chartData}
          margin={{ top: 10, right: 80, left: 100, bottom: 10 }}
        >
          <XAxis type="number" hide />
          <YAxis 
            type="category" 
            dataKey="name" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--foreground))', fontSize: 13 }}
            width={90}
          />
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))' }}
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
            formatter={(value: number, name: string, props: any) => [
              `${value.toLocaleString()} (${props.payload.percentage}%)`,
              'Total'
            ]}
          />
          <Bar 
            dataKey="value" 
            radius={[0, 6, 6, 0]}
            maxBarSize={40}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
            <LabelList 
              dataKey="value" 
              position="right" 
              formatter={(value: number) => value.toLocaleString()}
              style={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Legenda de drop-off */}
      <div className="flex justify-center gap-6 mt-4 text-xs text-muted-foreground">
        {chartData.slice(1).map((item, index) => (
          item.dropoff && parseFloat(item.dropoff) > 0 && (
            <span key={index} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-destructive/60" />
              {chartData[index].name} → {item.name}: -{item.dropoff}%
            </span>
          )
        ))}
      </div>
    </div>
  );
}
