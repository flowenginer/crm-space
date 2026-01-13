import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { Radio } from 'lucide-react';

interface CommunicationMetrics {
  clareza: number;
  cordialidade: number;
  proatividade: number;
  conhecimentoProduto: number;
}

interface CommunicationRadarProps {
  metrics: CommunicationMetrics | undefined;
  isLoading: boolean;
  title?: string;
}

export function CommunicationRadar({ metrics, isLoading, title = 'Comunicação' }: CommunicationRadarProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            {title}
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

  if (!metrics) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            {title}
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

  const data = [
    { subject: 'Clareza', value: metrics.clareza, fullMark: 10 },
    { subject: 'Cordialidade', value: metrics.cordialidade, fullMark: 10 },
    { subject: 'Proatividade', value: metrics.proatividade, fullMark: 10 },
    { subject: 'Conhecimento', value: metrics.conhecimentoProduto, fullMark: 10 },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--muted-foreground) / 0.3)"
            />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }}
            />
            <PolarRadiusAxis 
              angle={30} 
              domain={[0, 10]} 
              tick={{ fontSize: 10 }}
              tickCount={6}
            />
            <Tooltip 
              formatter={(value: number) => [value.toFixed(1), 'Nota']}
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Radar
              name="Comunicação"
              dataKey="value"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
