import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, BarChart3, Settings } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useEvaluationOverview, useAgentRanking, useObjectionsAnalysis, useScoreEvolution, useFunnelAnalysis, EvaluationDetail, ObjectionAnalysis } from '@/hooks/useSalesEvaluations';
import { useEvaluationTargets } from '@/hooks/useEvaluationTargets';
import { usePeriodComparison } from '@/hooks/usePeriodComparison';
import { EvaluationKPICards } from '@/components/sales-evaluation/EvaluationKPICards';
import { AgentRankingTable } from '@/components/sales-evaluation/AgentRankingTable';
import { EvaluationRankingTable } from '@/components/sales-evaluation/EvaluationRankingTable';
import { EvaluationDetailSheet } from '@/components/sales-evaluation/EvaluationDetailSheet';
import { SalesFunnelChart } from '@/components/sales-evaluation/SalesFunnelChart';
import { ObjectionsBarChart } from '@/components/sales-evaluation/ObjectionsBarChart';
import { ObjectionDetailModal } from '@/components/sales-evaluation/ObjectionDetailModal';
import { CommunicationRadar } from '@/components/sales-evaluation/CommunicationRadar';
import { CriteriaRadar } from '@/components/sales-evaluation/CriteriaRadar';
import { ScoreEvolutionChart } from '@/components/sales-evaluation/ScoreEvolutionChart';
import { TargetsConfigModal } from '@/components/sales-evaluation/TargetsConfigModal';
import { AgentFilterSelect } from '@/components/sales-evaluation/AgentFilterSelect';
import { RankingMetricSelect, RankingMetric } from '@/components/sales-evaluation/RankingMetricSelect';

export default function SalesEvaluationDashboard() {
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [filterAgentId, setFilterAgentId] = useState<string | null>(null);
  const [rankingMetric, setRankingMetric] = useState<RankingMetric>('avgScore');
  const [targetsModalOpen, setTargetsModalOpen] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationDetail | null>(null);
  const [selectedObjection, setSelectedObjection] = useState<ObjectionAnalysis | null>(null);

  const { data: overview, isLoading: overviewLoading } = useEvaluationOverview(dateRange.from, dateRange.to, filterAgentId);
  const { data: ranking, isLoading: rankingLoading } = useAgentRanking(dateRange.from, dateRange.to);
  const { data: objections, isLoading: objectionsLoading } = useObjectionsAnalysis(dateRange.from, dateRange.to);
  const { data: scoreEvolution, isLoading: evolutionLoading } = useScoreEvolution(filterAgentId, 6);
  const { data: funnel, isLoading: funnelLoading } = useFunnelAnalysis(dateRange.from, dateRange.to);
  const { data: targets } = useEvaluationTargets();
  const { data: comparison } = usePeriodComparison(dateRange.from, dateRange.to);

  const communicationMetrics = overview ? {
    clareza: overview.avgClareza,
    cordialidade: overview.avgCordialidade,
    proatividade: overview.avgProatividade,
    conhecimentoProduto: overview.avgConhecimento,
  } : undefined;

  const criteriaMetrics = overview ? {
    tempoResposta: overview.avgTempoResposta,
    personalizacao: overview.avgPersonalizacao,
    sensoUrgencia: overview.avgSensoUrgencia,
    recuperacaoFinal: overview.avgRecuperacao,
    qualificacaoLead: overview.avgQualificacao,
    followupEstruturado: overview.avgFollowup,
  } : undefined;

  // Sort ranking by selected metric
  const sortedRanking = ranking ? [...ranking].sort((a, b) => {
    const getValue = (agent: typeof a) => {
      switch (rankingMetric) {
        case 'evaluations': return agent.evaluations;
        case 'closingRate': return agent.closingRate;
        case 'avgConduction': return agent.avgConduction;
        case 'avgObjectionScore': return agent.avgObjectionScore;
        case 'avgClareza': return agent.avgClareza;
        case 'avgCordialidade': return agent.avgCordialidade;
        case 'avgProatividade': return agent.avgProatividade;
        case 'avgConhecimento': return agent.avgConhecimento;
        case 'avgTempoResposta': return agent.avgTempoResposta;
        case 'avgPersonalizacao': return agent.avgPersonalizacao;
        case 'avgSensoUrgencia': return agent.avgSensoUrgencia;
        case 'avgRecuperacao': return agent.avgRecuperacao;
        case 'avgQualificacao': return agent.avgQualificacao;
        case 'avgFollowup': return agent.avgFollowup;
        default: return agent.avgScore;
      }
    };
    return getValue(b) - getValue(a);
  }) : undefined;

  const quickFilters = [
    { label: 'Este mês', from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
    { label: 'Mês passado', from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) },
    { label: 'Últimos 3 meses', from: startOfMonth(subMonths(new Date(), 2)), to: endOfMonth(new Date()) },
  ];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Avaliação de Vendedores
          </h1>
          <p className="text-muted-foreground">
            Análise de performance baseada em IA
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <AgentFilterSelect value={filterAgentId} onChange={setFilterAgentId} />
          <RankingMetricSelect value={rankingMetric} onChange={setRankingMetric} />
          
          {quickFilters.map((filter) => (
            <Button
              key={filter.label}
              variant={dateRange.from.getTime() === filter.from.getTime() ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateRange({ from: filter.from, to: filter.to })}
            >
              {filter.label}
            </Button>
          ))}
          
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("w-[200px] justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, 'dd/MM', { locale: ptBR })} - {format(dateRange.to, 'dd/MM', { locale: ptBR })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" onClick={() => setTargetsModalOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Metas
          </Button>
        </div>
      </div>

      <EvaluationKPICards 
        overview={overview} 
        isLoading={overviewLoading} 
        targets={targets}
        comparison={comparison}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesFunnelChart data={funnel} isLoading={funnelLoading} />
        <ObjectionsBarChart 
          data={objections} 
          isLoading={objectionsLoading} 
          onSelectObjection={setSelectedObjection}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ScoreEvolutionChart data={scoreEvolution} isLoading={evolutionLoading} />
        <CommunicationRadar metrics={communicationMetrics} isLoading={overviewLoading} title="Comunicação (Média Geral)" />
        <CriteriaRadar metrics={criteriaMetrics} isLoading={overviewLoading} title="Critérios Adicionais" />
      </div>

      {/* Conditional rendering: Agent ranking vs Evaluation ranking */}
      {filterAgentId ? (
        <EvaluationRankingTable
          agentId={filterAgentId}
          dateRange={dateRange}
          onSelectEvaluation={setSelectedEvaluation}
        />
      ) : (
        <AgentRankingTable 
          agents={sortedRanking} 
          isLoading={rankingLoading} 
          onSelectAgent={(agentId) => setSelectedAgentId(agentId)}
        />
      )}

      <TargetsConfigModal open={targetsModalOpen} onOpenChange={setTargetsModalOpen} />
      
      <EvaluationDetailSheet
        evaluation={selectedEvaluation}
        open={!!selectedEvaluation}
        onOpenChange={(open) => !open && setSelectedEvaluation(null)}
      />

      <ObjectionDetailModal
        objection={selectedObjection}
        open={!!selectedObjection}
        onOpenChange={(open) => !open && setSelectedObjection(null)}
      />
    </div>
  );
}