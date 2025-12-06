import { useState } from 'react';
import { 
  UserPlus, 
  MessageSquare, 
  Clock, 
  TrendingUp, 
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { startOfMonth } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useRecentActivity } from '@/hooks/useDashboard';
import {
  useDashboardKPIs,
  useLeadsByStatus,
  useAgentPerformance,
  useCriticalConversations,
  useTimelineData,
  useConversionFunnel,
  useAgentsForFilter,
  useDepartmentsForFilter,
  type DashboardFilters as Filters
} from '@/hooks/useDashboardAdvanced';

// Components
import { KPICard } from '@/components/dashboard/KPICard';
import { ConversionFunnel } from '@/components/dashboard/ConversionFunnel';
import { LeadStatusChart } from '@/components/dashboard/LeadStatusChart';
import { TimelineChart } from '@/components/dashboard/TimelineChart';
import { AgentPerformanceTable } from '@/components/dashboard/AgentPerformanceTable';
import { CriticalConversations } from '@/components/dashboard/CriticalConversations';
import { DashboardFilters } from '@/components/dashboard/DashboardFilters';
import { RecentActivity } from '@/components/dashboard/RecentActivity';

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `R$ ${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `R$ ${(value / 1000).toFixed(1)}k`;
  }
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export default function Dashboard() {
  const { profile } = useAuth();
  
  // Filters state
  const [filters, setFilters] = useState<Filters>({
    dateFrom: startOfMonth(new Date()),
    dateTo: new Date(),
    agentId: undefined,
    departmentId: undefined,
  });

  // Data queries
  const { data: kpis, isLoading: loadingKPIs } = useDashboardKPIs(filters);
  const { data: leadsByStatus = [], isLoading: loadingStatus } = useLeadsByStatus(filters);
  const { data: agentPerformance = [], isLoading: loadingAgents } = useAgentPerformance(filters);
  const { data: criticalConversations = [], isLoading: loadingCritical } = useCriticalConversations(filters);
  const { data: timelineData = [], isLoading: loadingTimeline } = useTimelineData(filters);
  const { data: funnelData = [], isLoading: loadingFunnel } = useConversionFunnel(filters);
  const { data: recentActivity = [], isLoading: loadingActivity } = useRecentActivity();
  
  // Filter options
  const { data: agents = [] } = useAgentsForFilter(filters.departmentId);
  const { data: departments = [] } = useDepartmentsForFilter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold text-foreground mb-1">
          Dashboard{profile?.full_name ? ` - ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-muted-foreground text-sm">
          Acompanhe suas métricas de atendimento e vendas em tempo real
        </p>
      </div>

      {/* Filters */}
      <div className="animate-fade-in">
        <DashboardFilters
          filters={filters}
          onFiltersChange={setFilters}
          agents={agents}
          departments={departments}
        />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="animate-slide-up">
          <KPICard
            title="Novos Leads"
            value={kpis?.newLeads.toLocaleString('pt-BR') || '0'}
            icon={UserPlus}
            color="purple"
            isLoading={loadingKPIs}
          />
        </div>
        
        <div className="animate-slide-up" style={{ animationDelay: '50ms' }}>
          <KPICard
            title="Em Atendimento"
            value={kpis?.inService.toLocaleString('pt-BR') || '0'}
            icon={MessageSquare}
            color="blue"
            isLoading={loadingKPIs}
          />
        </div>
        
        <div className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <KPICard
            title="Aguardando Resposta"
            value={kpis?.awaitingResponse.toLocaleString('pt-BR') || '0'}
            icon={AlertCircle}
            color="orange"
            isLoading={loadingKPIs}
          />
        </div>
        
        <div className="animate-slide-up" style={{ animationDelay: '150ms' }}>
          <KPICard
            title="Tempo Médio"
            value={kpis ? formatTime(kpis.avgResponseTime) : '-'}
            subtitle="de resposta"
            icon={Clock}
            color="cyan"
            isLoading={loadingKPIs}
          />
        </div>
        
        <div className="animate-slide-up" style={{ animationDelay: '200ms' }}>
          <KPICard
            title="Taxa Conversão"
            value={kpis ? `${kpis.conversionRate.toFixed(1)}%` : '0%'}
            subtitle="pedidos fechados"
            icon={TrendingUp}
            color="green"
            isLoading={loadingKPIs}
          />
        </div>
        
        <div className="animate-slide-up" style={{ animationDelay: '250ms' }}>
          <KPICard
            title="Valor Convertido"
            value={kpis ? formatCurrency(kpis.convertedValue) : 'R$ 0'}
            icon={DollarSign}
            color="pink"
            isLoading={loadingKPIs}
          />
        </div>
      </div>

      {/* Charts Row 1: Funnel + Lead Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
        <ConversionFunnel data={funnelData} isLoading={loadingFunnel} />
        <LeadStatusChart data={leadsByStatus} isLoading={loadingStatus} />
      </div>

      {/* Charts Row 2: Timeline */}
      <div className="animate-fade-in">
        <TimelineChart data={timelineData} isLoading={loadingTimeline} />
      </div>

      {/* Bottom Section: Agent Ranking + Critical + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 animate-slide-up">
          <AgentPerformanceTable data={agentPerformance} isLoading={loadingAgents} />
        </div>
        
        <div className="lg:col-span-1 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <CriticalConversations data={criticalConversations} isLoading={loadingCritical} />
        </div>
        
        <div className="lg:col-span-1 animate-slide-up" style={{ animationDelay: '200ms' }}>
          <RecentActivity data={recentActivity} isLoading={loadingActivity} />
        </div>
      </div>
    </div>
  );
}
