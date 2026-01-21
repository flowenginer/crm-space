import { KPICard } from '@/components/dashboard/KPICard';
import { Target, TrendingUp, MessageSquare, Users, Zap, Award, CheckCircle, Brain } from 'lucide-react';
import { EvaluationOverview } from '@/hooks/useSalesEvaluations';
import { EvaluationTargets } from '@/hooks/useEvaluationTargets';
import { PeriodComparison } from '@/hooks/usePeriodComparison';

interface EvaluationKPICardsProps {
  overview: EvaluationOverview | undefined;
  isLoading: boolean;
  targets?: EvaluationTargets;
  comparison?: PeriodComparison;
}

function getAiAccuracyColor(accuracy: number): 'green' | 'orange' | 'pink' {
  if (accuracy >= 80) return 'green';
  if (accuracy >= 60) return 'orange';
  return 'pink';
}

export function EvaluationKPICards({ overview, isLoading, targets, comparison }: EvaluationKPICardsProps) {
  const getTrend = (key: keyof PeriodComparison) => {
    if (!comparison) return undefined;
    const data = comparison[key];
    if (data.variation === 0) return undefined;
    return { value: Math.abs(data.variation), isPositive: data.variation > 0 };
  };

  const totalEvaluations = overview?.totalEvaluations || 0;
  const realConversions = totalEvaluations > 0 
    ? Math.round((overview?.closingRate || 0) * totalEvaluations / 100) 
    : 0;
  const aiPredictions = totalEvaluations > 0 
    ? Math.round((overview?.aiPredictedRate || 0) * totalEvaluations / 100) 
    : 0;
  const correctPredictions = totalEvaluations > 0 
    ? Math.round((overview?.aiAccuracy || 0) * totalEvaluations / 100) 
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
      <KPICard
        title="Total Avaliações"
        value={overview?.totalEvaluations || 0}
        icon={MessageSquare}
        color="blue"
        isLoading={isLoading}
        trend={getTrend('totalEvaluations')}
      />
      <KPICard
        title="Score Médio"
        value={overview?.avgScore.toFixed(1) || '0.0'}
        subtitle={targets ? `Meta: ${targets.targetOverallScore}` : 'de 10'}
        icon={Award}
        color="purple"
        isLoading={isLoading}
        trend={getTrend('avgScore')}
      />
      <KPICard
        title="Taxa de Conversão"
        value={`${overview?.closingRate || 0}%`}
        subtitle={targets ? `Meta: ${targets.targetTaxaFechamento}%` : `${realConversions} conversões`}
        icon={Target}
        color="green"
        isLoading={isLoading}
        trend={getTrend('closingRate')}
      />
      <KPICard
        title="Assertividade IA"
        value={`${overview?.aiAccuracy || 0}%`}
        subtitle={`${correctPredictions}/${totalEvaluations} acertos`}
        icon={Brain}
        color={getAiAccuracyColor(overview?.aiAccuracy || 0)}
        isLoading={isLoading}
      />
      <KPICard
        title="Efic. Objeções"
        value={`${overview?.objectionEfficiency || 0}%`}
        subtitle={targets ? `Meta: ${targets.targetEficienciaObjecoes}%` : undefined}
        icon={CheckCircle}
        color="cyan"
        isLoading={isLoading}
        trend={getTrend('objectionEfficiency')}
      />
      <KPICard
        title="Nota Objeções"
        value={overview?.avgObjectionScore.toFixed(1) || '0.0'}
        subtitle={targets ? `Meta: ${targets.targetNotaObjecoes}` : 'média'}
        icon={Zap}
        color="orange"
        isLoading={isLoading}
        trend={getTrend('avgObjectionScore')}
      />
      <KPICard
        title="Comunicação"
        value={overview?.avgCommunicationScore.toFixed(1) || '0.0'}
        subtitle="média"
        icon={Users}
        color="cyan"
        isLoading={isLoading}
        trend={getTrend('avgCommunicationScore')}
      />
      <KPICard
        title="Condução"
        value={overview?.avgConductionScore.toFixed(1) || '0.0'}
        subtitle={targets ? `Meta: ${targets.targetConducao}` : 'média'}
        icon={TrendingUp}
        color="pink"
        isLoading={isLoading}
        trend={getTrend('avgConductionScore')}
      />
    </div>
  );
}
