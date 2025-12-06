import { useState } from 'react';
import { Calendar, ChevronDown, RotateCcw, User, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays, startOfMonth, startOfWeek, endOfWeek, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DashboardFilters as Filters } from '@/hooks/useDashboardAdvanced';

interface DashboardFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  agents: Array<{ id: string; full_name: string | null }>;
  departments: Array<{ id: string; name: string }>;
}

const presetRanges = [
  { label: 'Hoje', getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Ontem', getValue: () => ({ from: subDays(new Date(), 1), to: subDays(new Date(), 1) }) },
  { label: 'Esta Semana', getValue: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: 'Este Mês', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'Últimos 7 dias', getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: 'Últimos 30 dias', getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
];

export function DashboardFilters({ filters, onFiltersChange, agents, departments }: DashboardFiltersProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handlePresetClick = (getValue: () => { from: Date; to: Date }) => {
    const range = getValue();
    onFiltersChange({ ...filters, dateFrom: range.from, dateTo: range.to });
    setCalendarOpen(false);
  };

  const handleReset = () => {
    onFiltersChange({
      dateFrom: startOfMonth(new Date()),
      dateTo: new Date(),
      agentId: undefined,
      departmentId: undefined,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Date Range Picker */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="h-10 px-4 rounded-xl border-border/50 bg-card hover:bg-muted transition-all"
          >
            <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className="text-sm">
              {format(filters.dateFrom, 'dd/MM/yyyy', { locale: ptBR })} - {format(filters.dateTo, 'dd/MM/yyyy', { locale: ptBR })}
            </span>
            <ChevronDown className="h-4 w-4 ml-2 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="border-r border-border p-3 space-y-1">
              {presetRanges.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => handlePresetClick(preset.getValue)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <CalendarComponent
              mode="range"
              selected={{ from: filters.dateFrom, to: filters.dateTo }}
              onSelect={(range) => {
                if (range?.from && range?.to) {
                  onFiltersChange({ ...filters, dateFrom: range.from, dateTo: range.to });
                } else if (range?.from) {
                  onFiltersChange({ ...filters, dateFrom: range.from, dateTo: range.from });
                }
              }}
              numberOfMonths={2}
              initialFocus
            />
          </div>
        </PopoverContent>
      </Popover>

      {/* Agent Filter */}
      <Select 
        value={filters.agentId || 'all'} 
        onValueChange={(value) => onFiltersChange({ ...filters, agentId: value === 'all' ? undefined : value })}
      >
        <SelectTrigger className="h-10 w-[180px] rounded-xl border-border/50 bg-card">
          <User className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Todos vendedores" />
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

      {/* Department Filter */}
      <Select 
        value={filters.departmentId || 'all'} 
        onValueChange={(value) => onFiltersChange({ ...filters, departmentId: value === 'all' ? undefined : value })}
      >
        <SelectTrigger className="h-10 w-[180px] rounded-xl border-border/50 bg-card">
          <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="Todos departamentos" />
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

      {/* Reset Button */}
      <Button 
        variant="ghost" 
        className="h-10 text-muted-foreground hover:text-primary"
        onClick={handleReset}
      >
        <RotateCcw className="h-4 w-4 mr-2" />
        Restaurar
      </Button>
    </div>
  );
}
