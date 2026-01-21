import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import { Settings2 } from 'lucide-react';

export interface CriteriaMetrics {
  tempoResposta: number;
  personalizacao: number;
  sensoUrgencia: number;
  recuperacaoFinal: number;
  qualificacaoLead: number;
  followupEstruturado: number;
}

interface CriteriaRadarProps {
  metrics: CriteriaMetrics | undefined;
  isLoading: boolean;
  title?: string;
}

export function CriteriaRadar({ metrics, isLoading, title = 'Critérios Adicionais' }: CriteriaRadarProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
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
            <Settings2 className="h-5 w-5" />
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
    { subject: 'Tempo Resposta', value: metrics.tempoResposta, fullMark: 10 },
    { subject: 'Personalização', value: metrics.personalizacao, fullMark: 10 },
    { subject: 'Senso Urgência', value: metrics.sensoUrgencia, fullMark: 10 },
    { subject: 'Recuperação', value: metrics.recuperacaoFinal, fullMark: 10 },
    { subject: 'Qualificação', value: metrics.qualificacaoLead, fullMark: 10 },
    { subject: 'Follow-up', value: metrics.followupEstruturado, fullMark: 10 },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings2 className="h-5 w-5" />
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
              tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
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
              name="Critérios"
              dataKey="value"
              stroke="hsl(var(--chart-2))"
              fill="hsl(var(--chart-2))"
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
