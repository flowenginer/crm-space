import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import type { UserTemplateStat } from '@/hooks/useTemplateStats';

interface TemplatesByUserChartProps {
  data: UserTemplateStat[];
  isLoading?: boolean;
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function TemplatesByUserChart({ data, isLoading }: TemplatesByUserChartProps) {
  // Take top 10 users
  const chartData = data.slice(0, 10).map(stat => ({
    name: stat.userName.split(' ')[0], // First name only for chart
    fullName: stat.userName,
    total: stat.totalCount,
    marketing: stat.marketingCount,
    utility: stat.utilityCount,
  }));

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Envios por Usuário
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="text-muted-foreground">Carregando...</div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Envios por Usuário
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <div className="text-muted-foreground text-sm">Nenhum dado disponível</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          Envios por Usuário (Top 10)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis type="number" className="text-xs" />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={80}
              className="text-xs"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number, name: string) => [
                value.toLocaleString('pt-BR'),
                name === 'total' ? 'Total' : name === 'marketing' ? 'Marketing' : 'Utility',
              ]}
              labelFormatter={(label) => chartData.find(d => d.name === label)?.fullName || label}
            />
            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
