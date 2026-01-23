import { useState, useMemo } from 'react';
import { subDays } from 'date-fns';
import { Calendar, Filter, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  useTemplateStats, 
  useDepartments,
  useAgents,
} from '@/hooks/useTemplateStats';
import { TemplateStatsCards } from './stats/TemplateStatsCards';
import { TemplatesByUserChart } from './stats/TemplatesByUserChart';
import { TemplatesByDepartmentChart } from './stats/TemplatesByDepartmentChart';
import { TemplatesTimelineChart } from './stats/TemplatesTimelineChart';
import { TemplatesCostTable } from './stats/TemplatesCostTable';

type DateRangeOption = '7d' | '30d' | '60d' | '90d';

const DATE_RANGE_OPTIONS: Record<DateRangeOption, { label: string; days: number }> = {
  '7d': { label: 'Últimos 7 dias', days: 7 },
  '30d': { label: 'Últimos 30 dias', days: 30 },
  '60d': { label: 'Últimos 60 dias', days: 60 },
  '90d': { label: 'Últimos 90 dias', days: 90 },
};

export function TemplateStatsTab() {
  const [dateRange, setDateRange] = useState<DateRangeOption>('30d');
  const [departmentId, setDepartmentId] = useState<string>('all');
  const [userId, setUserId] = useState<string>('all');

  const { data: departments = [] } = useDepartments();
  const { data: agents = [] } = useAgents();

  const filters = useMemo(() => ({
    startDate: subDays(new Date(), DATE_RANGE_OPTIONS[dateRange].days),
    endDate: new Date(),
    departmentId: departmentId !== 'all' ? departmentId : undefined,
    userId: userId !== 'all' ? userId : undefined,
  }), [dateRange, departmentId, userId]);

  const { 
    userStats, 
    departmentStats, 
    timeline, 
    summary, 
    isLoading,
    refetch,
  } = useTemplateStats(filters);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Estatísticas de Templates</h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe os envios de templates e custos estimados por usuário e departamento
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeOption)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DATE_RANGE_OPTIONS).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos departamentos</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Select value={userId} onValueChange={setUserId}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Usuário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos usuários</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>{agent.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <TemplateStatsCards summary={summary} isLoading={isLoading} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TemplatesByUserChart data={userStats} isLoading={isLoading} />
        <TemplatesByDepartmentChart data={departmentStats} isLoading={isLoading} />
      </div>

      {/* Timeline */}
      <TemplatesTimelineChart data={timeline} isLoading={isLoading} />

      {/* Cost Table */}
      <TemplatesCostTable data={userStats} isLoading={isLoading} />
    </div>
  );
}
