import { KPICard } from '@/components/dashboard/KPICard';
import { type HRKPIs } from '@/hooks/useBusinessKPIs';
import { 
  Users, 
  UserCheck, 
  UserX, 
  TrendingDown,
  MessageSquare,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface HRKPISectionProps {
  data?: HRKPIs;
  isLoading: boolean;
}

export function HRKPISection({ data, isLoading }: HRKPISectionProps) {
  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatMinutes = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
          <Users className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Recursos Humanos</h2>
          <p className="text-sm text-muted-foreground">Métricas de equipe e produtividade</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Agentes Ativos"
          value={data?.activeAgents?.toString() || '0'}
          subtitle="Colaboradores disponíveis"
          icon={UserCheck}
          color="green"
          isLoading={isLoading}
        />

        <KPICard
          title="Agentes Inativos"
          value={data?.inactiveAgents?.toString() || '0'}
          subtitle="Colaboradores desligados"
          icon={UserX}
          color="orange"
          isLoading={isLoading}
        />

        <KPICard
          title="Taxa de Turnover"
          value={formatPercent(data?.turnoverRate || 0)}
          subtitle="Rotatividade de pessoal"
          icon={TrendingDown}
          color={(data?.turnoverRate || 0) > 20 ? 'orange' : 'blue'}
          trend={{
            value: data?.turnoverRate || 0,
            isPositive: false,
          }}
          isLoading={isLoading}
        />

        <KPICard
          title="Conversas por Agente"
          value={data?.avgConversationsPerAgent?.toString() || '0'}
          subtitle="Média no período"
          icon={MessageSquare}
          color="cyan"
          isLoading={isLoading}
        />

        <KPICard
          title="Tempo Médio de Resposta"
          value={formatMinutes(data?.avgResponseTime || 0)}
          subtitle="Primeira resposta"
          icon={Clock}
          color="purple"
          isLoading={isLoading}
        />

        <KPICard
          title="Total da Equipe"
          value={((data?.activeAgents || 0) + (data?.inactiveAgents || 0)).toString()}
          subtitle="Ativos + Inativos"
          icon={Users}
          color="pink"
          isLoading={isLoading}
        />
      </div>

      {/* Team Overview Card */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Visão Geral da Equipe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Active vs Inactive */}
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Ativos</span>
                  <span className="text-sm font-medium text-success">
                    {data?.activeAgents || 0}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-success transition-all duration-500"
                    style={{ 
                      width: `${((data?.activeAgents || 0) / ((data?.activeAgents || 0) + (data?.inactiveAgents || 1))) * 100}%` 
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Productivity */}
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {data?.avgConversationsPerAgent || 0}
              </div>
              <div className="text-xs text-muted-foreground">
                Conversas/Agente
              </div>
            </div>

            {/* Response Time */}
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">
                {formatMinutes(data?.avgResponseTime || 0)}
              </div>
              <div className="text-xs text-muted-foreground">
                Tempo de Resposta
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Note about limited HR metrics */}
      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
        <p className="font-medium mb-1">📊 Nota sobre métricas de RH</p>
        <p>
          Algumas métricas como Custo por Contratação, Tempo Médio de Vaga e Absenteísmo 
          requerem integração com um sistema de RH dedicado para serem calculadas com precisão.
        </p>
      </div>
    </div>
  );
}
