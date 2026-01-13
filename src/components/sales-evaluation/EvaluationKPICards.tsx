import { KPICard } from '@/components/dashboard/KPICard';
import { Target, TrendingUp, MessageSquare, Users, Zap, Award } from 'lucide-react';
import { EvaluationOverview } from '@/hooks/useSalesEvaluations';

interface EvaluationKPICardsProps {
  overview: EvaluationOverview | undefined;
  isLoading: boolean;
}

export function EvaluationKPICards({ overview, isLoading }: EvaluationKPICardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <KPICard
        title="Total Avaliações"
        value={overview?.totalEvaluations || 0}
        icon={MessageSquare}
        color="blue"
        isLoading={isLoading}
      />
      <KPICard
        title="Score Médio"
        value={overview?.avgScore.toFixed(1) || '0.0'}
        subtitle="de 10"
        icon={Award}
        color="purple"
        isLoading={isLoading}
      />
      <KPICard
        title="Taxa de Fechamento"
        value={`${overview?.closingRate || 0}%`}
        icon={Target}
        color="green"
        isLoading={isLoading}
      />
      <KPICard
        title="Nota Objeções"
        value={overview?.avgObjectionScore.toFixed(1) || '0.0'}
        subtitle="média"
        icon={Zap}
        color="orange"
        isLoading={isLoading}
      />
      <KPICard
        title="Comunicação"
        value={overview?.avgCommunicationScore.toFixed(1) || '0.0'}
        subtitle="média"
        icon={Users}
        color="cyan"
        isLoading={isLoading}
      />
      <KPICard
        title="Condução"
        value={overview?.avgConductionScore.toFixed(1) || '0.0'}
        subtitle="média"
        icon={TrendingUp}
        color="pink"
        isLoading={isLoading}
      />
    </div>
  );
}
