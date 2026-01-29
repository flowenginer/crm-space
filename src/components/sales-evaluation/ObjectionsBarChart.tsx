import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, MousePointerClick } from 'lucide-react';
import { ObjectionAnalysis } from '@/hooks/useSalesEvaluations';

interface ObjectionsBarChartProps {
  data: ObjectionAnalysis[] | undefined;
  isLoading: boolean;
  onSelectObjection?: (objection: ObjectionAnalysis) => void;
}

function getBarColor(score: number): string {
  if (score >= 7) return 'hsl(142, 76%, 36%)'; // green
  if (score >= 5) return 'hsl(48, 96%, 53%)'; // yellow
  if (score >= 3) return 'hsl(25, 95%, 53%)'; // orange
  return 'hsl(0, 84%, 60%)'; // red
}

export function ObjectionsBarChart({ data, isLoading, onSelectObjection }: ObjectionsBarChartProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Top Objeções
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = (data || []).slice(0, 8).map(obj => ({
    ...obj,
    name: obj.name.length > 15 ? obj.name.substring(0, 15) + '...' : obj.name,
    fullName: obj.name,
    originalData: obj,
  }));

  if (chartData.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Top Objeções
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Dados não disponíveis
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleBarClick = (entry: typeof chartData[0]) => {
    if (onSelectObjection && entry.originalData) {
      onSelectObjection(entry.originalData);
    }
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Top Objeções (frequência)
          </div>
          {onSelectObjection && (
            <span className="text-xs text-muted-foreground font-normal flex items-center gap-1">
              <MousePointerClick className="h-3 w-3" />
              Clique para detalhes
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis type="number" hide />
            <YAxis 
              type="category" 
              dataKey="name" 
              width={100}
              tick={{ fontSize: 11 }}
            />
            <Tooltip 
              formatter={(value: number, name: string, props: { payload: typeof chartData[0] }) => {
                if (name === 'frequency') {
                  const hasTrechos = props.payload.originalData?.trechos?.length > 0;
                  return [
                    `${value}x (nota média: ${props.payload.avgScore})${hasTrechos ? ' • Clique para ver trechos' : ''}`, 
                    'Frequência'
                  ];
                }
                return [value, name];
              }}
              labelFormatter={(label: string, payload: { payload: typeof chartData[0] }[]) => 
                payload[0]?.payload?.fullName || label
              }
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Bar 
              dataKey="frequency" 
              radius={[0, 4, 4, 0]}
              cursor={onSelectObjection ? 'pointer' : undefined}
              onClick={(data) => handleBarClick(data)}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.avgScore)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(142, 76%, 36%)' }} />
            <span>≥7 Bom</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(48, 96%, 53%)' }} />
            <span>≥5 Regular</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(25, 95%, 53%)' }} />
            <span>≥3 Fraco</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: 'hsl(0, 84%, 60%)' }} />
            <span>&lt;3 Crítico</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
