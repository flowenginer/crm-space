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
  useLeadAlerts,
  type DashboardFilters as JourneyFilters
} from '@/hooks/useLeadJourneyDashboard';
import { useAgentsForFilter, useDepartmentsForFilter, useInteractionTimeline } from '@/hooks/useDashboardAdvanced';

// Components
import { JourneyKPICards } from '@/components/dashboard/JourneyKPICards';
import { OriginBreakdownChart } from '@/components/dashboard/OriginBreakdownChart';
import { StatusFunnelChart } from '@/components/dashboard/StatusFunnelChart';
import { StatusDurationChart } from '@/components/dashboard/StatusDurationChart';
import { AgentPerformanceTableAdvanced } from '@/components/dashboard/AgentPerformanceTableAdvanced';
import { LeadAlertsPanel } from '@/components/dashboard/LeadAlertsPanel';
import { AdvancedFilters } from '@/components/dashboard/AdvancedFilters';
import { InteractionChart } from '@/components/dashboard/InteractionChart';

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
  const { data: statusFunnel = [], isLoading: loadingFunnel } = useStatusFunnel(filters);
  const { data: leadAlerts = [], isLoading: loadingAlerts } = useLeadAlerts(filters);
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

      {/* KPI Cards */}
      <div className="animate-fade-in">
        <JourneyKPICards metrics={journeyMetrics} isLoading={loadingMetrics} />
      </div>

      {/* Charts Row 1: Origin Breakdown + Status Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
        <OriginBreakdownChart 
          data={originData} 
          isLoading={loadingOrigin}
          selectedOrigin={selectedOrigin}
          onOriginClick={setSelectedOrigin}
        />
        <StatusFunnelChart data={statusFunnel} isLoading={loadingFunnel} />
      </div>

      {/* Charts Row 2: Interaction Timeline */}
      <div className="animate-fade-in">
        <InteractionChart 
          data={interactionData} 
          isLoading={loadingInteraction}
          agentName={selectedAgentName}
        />
      </div>

      {/* Charts Row 3: Status Duration */}
      <div className="animate-fade-in">
        <StatusDurationChart data={statusFunnel} isLoading={loadingFunnel} />
      </div>

      {/* Bottom Section: Agent Performance + Lead Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 animate-slide-up">
          <AgentPerformanceTableAdvanced data={agentPerformance} isLoading={loadingAgents} />
        </div>
        
        <div className="xl:col-span-1 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <LeadAlertsPanel data={leadAlerts} isLoading={loadingAlerts} />
        </div>
      </div>
    </div>
  );
}
