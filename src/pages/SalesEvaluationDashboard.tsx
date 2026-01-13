import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, BarChart3 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useEvaluationOverview, useAgentRanking, useObjectionsAnalysis, useScoreEvolution, useFunnelAnalysis } from '@/hooks/useSalesEvaluations';
import { EvaluationKPICards } from '@/components/sales-evaluation/EvaluationKPICards';
import { AgentRankingTable } from '@/components/sales-evaluation/AgentRankingTable';
import { SalesFunnelChart } from '@/components/sales-evaluation/SalesFunnelChart';
import { ObjectionsBarChart } from '@/components/sales-evaluation/ObjectionsBarChart';
import { CommunicationRadar } from '@/components/sales-evaluation/CommunicationRadar';
import { ScoreEvolutionChart } from '@/components/sales-evaluation/ScoreEvolutionChart';

export default function SalesEvaluationDashboard() {
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const { data: overview, isLoading: overviewLoading } = useEvaluationOverview(dateRange.from, dateRange.to);
  const { data: ranking, isLoading: rankingLoading } = useAgentRanking(dateRange.from, dateRange.to);
  const { data: objections, isLoading: objectionsLoading } = useObjectionsAnalysis(dateRange.from, dateRange.to);
  const { data: scoreEvolution, isLoading: evolutionLoading } = useScoreEvolution(null, 6);
  const { data: funnel, isLoading: funnelLoading } = useFunnelAnalysis(dateRange.from, dateRange.to);

  const communicationMetrics = overview ? {
    clareza: overview.avgCommunicationScore,
    cordialidade: overview.avgCommunicationScore,
    proatividade: overview.avgCommunicationScore,
    conhecimentoProduto: overview.avgCommunicationScore,
  } : undefined;

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
        
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <EvaluationKPICards overview={overview} isLoading={overviewLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SalesFunnelChart data={funnel} isLoading={funnelLoading} />
        <ObjectionsBarChart data={objections} isLoading={objectionsLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScoreEvolutionChart data={scoreEvolution} isLoading={evolutionLoading} />
        <CommunicationRadar metrics={communicationMetrics} isLoading={overviewLoading} title="Comunicação (Média Geral)" />
      </div>

      <AgentRankingTable 
        agents={ranking} 
        isLoading={rankingLoading} 
        onSelectAgent={(agentId) => setSelectedAgentId(agentId)}
      />
    </div>
  );
}
