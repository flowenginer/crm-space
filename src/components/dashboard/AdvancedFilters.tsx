import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Filter, X, ChevronDown, History, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMenuItems } from '@/hooks/useMenuConfig';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type DashboardFilters } from '@/hooks/useLeadJourneyDashboard';

interface AdvancedFiltersProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  agents: { id: string; full_name: string }[];
  departments: { id: string; name: string }[];
}

const presetRanges = [
  { label: 'Hoje', getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Ontem', getValue: () => ({ from: subDays(new Date(), 1), to: subDays(new Date(), 1) }) },
  { label: 'Últimos 7 dias', getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: 'Últimos 30 dias', getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'Esta semana', getValue: () => ({ from: startOfWeek(new Date(), { locale: ptBR }), to: endOfWeek(new Date(), { locale: ptBR }) }) },
  { label: 'Este mês', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
];

export function AdvancedFilters({
  filters,
  onFiltersChange,
  agents,
  departments,
}: AdvancedFiltersProps) {
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isFixingHistorical, setIsFixingHistorical] = useState(false);
  
  // Check if origin patterns menu is enabled
  const { data: menuItems } = useMenuItems();
  const isOriginPatternsEnabled = menuItems?.find(
    item => item.href === '/settings?tab=origin-patterns'
  )?.is_active ?? false;
  
  const { dateFrom, dateTo, agentId, departmentId } = filters;

  const handleFixHistorical = async () => {
    setIsFixingHistorical(true);
    try {
      const { error } = await supabase.rpc('fix_historical_origin_detection');
      if (error) throw error;
      toast.success('Histórico corrigido com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao corrigir histórico: ' + error.message);
    } finally {
      setIsFixingHistorical(false);
    }
  };

  const activeFiltersCount = [agentId, departmentId].filter(Boolean).length;

  const handlePresetClick = (preset: typeof presetRanges[0]) => {
    const { from, to } = preset.getValue();
    onFiltersChange({ ...filters, dateFrom: from, dateTo: to });
    setIsDateOpen(false);
  };

  const clearFilters = () => {
    onFiltersChange({ ...filters, agentId: undefined, departmentId: undefined });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card rounded-xl border border-border">
      {/* Date Range Picker */}
      <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal min-w-[240px]",
              !dateFrom && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateFrom && dateTo ? (
              <>
                {format(dateFrom, "dd/MM/yy", { locale: ptBR })} - {format(dateTo, "dd/MM/yy", { locale: ptBR })}
              </>
            ) : (
              <span>Selecionar período</span>
            )}
            <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* Presets */}
            <div className="border-r p-2 space-y-1">
              {presetRanges.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => handlePresetClick(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {/* Calendar */}
            <div className="p-3">
              <div className="flex gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">De</p>
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => date && onFiltersChange({ ...filters, dateFrom: date })}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Até</p>
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => date && onFiltersChange({ ...filters, dateTo: date })}
                    locale={ptBR}
                    disabled={(date) => date < dateFrom}
                    className="pointer-events-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Department Filter */}
      <Select
        value={departmentId || 'all'}
        onValueChange={(value) => onFiltersChange({ ...filters, departmentId: value === 'all' ? undefined : value, agentId: undefined })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Departamento" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos departamentos</SelectItem>
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Agent Filter */}
      <Select
        value={agentId || 'all'}
        onValueChange={(value) => onFiltersChange({ ...filters, agentId: value === 'all' ? undefined : value })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Vendedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos vendedores</SelectItem>
          {agents.map((agent) => (
            <SelectItem key={agent.id} value={agent.id}>
              {agent.full_name || 'Sem nome'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Active Filters Badge & Clear */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <Filter className="h-3 w-3" />
            {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Limpar
          </Button>
        </div>
      )}

      {/* Fix Historical Button - Far Right (only if menu is enabled) */}
      {isOriginPatternsEnabled && (
        <Button
          variant="outline"
          className="ml-auto"
          onClick={handleFixHistorical}
          disabled={isFixingHistorical}
        >
          {isFixingHistorical ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <History className="h-4 w-4 mr-2" />
          )}
          Corrigir Histórico
        </Button>
      )}
    </div>
  );
}
