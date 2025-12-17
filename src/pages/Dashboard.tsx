import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { startOfMonth } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useLeadsByOrigin,
  useLeadJourneyMetrics,
  useAgentDistributionAdvanced,
  useStatusFunnel,
  type DashboardFilters as JourneyFilters
} from '@/hooks/useLeadJourneyDashboard';
import { useAgentsForFilter, useDepartmentsForFilter, useInteractionTimeline } from '@/hooks/useDashboardAdvanced';

// Components
import { JourneyKPICards } from '@/components/dashboard/JourneyKPICards';
import { OriginBreakdownChart } from '@/components/dashboard/OriginBreakdownChart';
import { StatusFunnelRealtime } from '@/components/dashboard/StatusFunnelRealtime';
import { StatusDurationChart } from '@/components/dashboard/StatusDurationChart';
import { AgentPerformanceTableAdvanced } from '@/components/dashboard/AgentPerformanceTableAdvanced';

import { AdvancedFilters } from '@/components/dashboard/AdvancedFilters';
import { InteractionChart } from '@/components/dashboard/InteractionChart';
import { DashboardGrid, DashboardCardConfig } from '@/components/dashboard/DashboardGrid';

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { isAdmin, isFullyLoaded } = usePermissions();
  
  // Redireciona não-admins para /conversations
  useEffect(() => {
    if (isFullyLoaded && !isAdmin) {
      navigate('/conversations', { replace: true });
    }
  }, [isFullyLoaded, isAdmin, navigate]);
  
  // Filters state
  const [filters, setFilters] = useState<JourneyFilters>({
    dateFrom: startOfMonth(new Date()),
    dateTo: new Date(),
    agentId: undefined,
    departmentId: undefined,
    channelId: undefined,
  });
  
  // Selected origin for filtering
  const [selectedOrigin, setSelectedOrigin] = useState<string | null>(null);

  // Data queries
  const { data: originData = [], isLoading: loadingOrigin } = useLeadsByOrigin(filters);
  const { data: journeyMetrics, isLoading: loadingMetrics } = useLeadJourneyMetrics(filters, selectedOrigin || undefined);
  const { data: agentPerformance = [], isLoading: loadingAgents } = useAgentDistributionAdvanced(filters);
  const { data: statusFunnelData = [], isLoading: loadingFunnel } = useStatusFunnel(filters);
  
  const { data: interactionData = [], isLoading: loadingInteraction } = useInteractionTimeline(filters);
  
  // Filter options
  const { data: agents = [] } = useAgentsForFilter(filters.departmentId);
  const { data: departments = [] } = useDepartmentsForFilter();

  // Get selected agent name for chart title
  const selectedAgentName = useMemo(() => {
    if (!filters.agentId) return undefined;
    const agent = agents.find(a => a.id === filters.agentId);
    return agent?.full_name?.split(' ')[0]; // First name only
  }, [filters.agentId, agents]);

  // Dashboard cards configuration
  const dashboardCards: DashboardCardConfig[] = useMemo(() => [
    {
      id: 'kpi-cards',
      fullWidth: true,
      component: <JourneyKPICards metrics={journeyMetrics} isLoading={loadingMetrics} />,
    },
    {
      id: 'origin-breakdown',
      component: (
        <OriginBreakdownChart 
          data={originData} 
          isLoading={loadingOrigin}
          selectedOrigin={selectedOrigin}
          onOriginClick={setSelectedOrigin}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
        />
      ),
    },
    {
      id: 'status-funnel',
      component: (
        <StatusFunnelRealtime 
          data={statusFunnelData} 
          isLoading={loadingFunnel} 
        />
      ),
    },
    {
      id: 'interaction-chart',
      fullWidth: true,
      component: (
        <InteractionChart 
          data={interactionData} 
          isLoading={loadingInteraction}
          agentName={selectedAgentName}
        />
      ),
    },
    {
      id: 'status-duration',
      fullWidth: true,
      component: <StatusDurationChart data={statusFunnelData} isLoading={loadingFunnel} />,
    },
    {
      id: 'agent-performance',
      fullWidth: true,
      component: <AgentPerformanceTableAdvanced data={agentPerformance} isLoading={loadingAgents} />,
    },
  ], [
    journeyMetrics, loadingMetrics,
    originData, loadingOrigin, selectedOrigin, filters.dateFrom, filters.dateTo,
    statusFunnelData, loadingFunnel,
    interactionData, loadingInteraction, selectedAgentName,
    agentPerformance, loadingAgents
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold text-foreground mb-1">
          Dashboard{profile?.full_name ? ` - ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-muted-foreground text-sm">
          Acompanhe a jornada dos leads e performance do time em tempo real
        </p>
      </div>

      {/* Filters */}
      <div className="animate-fade-in">
        <AdvancedFilters
          filters={filters}
          onFiltersChange={setFilters}
          agents={agents}
          departments={departments}
        />
      </div>

      {/* Draggable Dashboard Grid */}
      <DashboardGrid cards={dashboardCards} />
    </div>
  );
}
