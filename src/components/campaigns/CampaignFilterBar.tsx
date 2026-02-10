import { useState, useMemo } from 'react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Filter,
  X,
} from 'lucide-react';
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
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

const datePresets = [
  { label: 'Hoje', getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Últimos 7 dias', getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: 'Últimos 30 dias', getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: 'Este mês', getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: 'Mês passado', getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
];

export interface CampaignFilterState {
  dateRange: DateRange | undefined;
  campaign: string | null;
  creative: string | null;
  segment: string | null;
  status: string | null;
}

interface CampaignFilterBarProps {
  filters: CampaignFilterState;
  onFiltersChange: (filters: CampaignFilterState) => void;
  campaigns: { id: string; name: string }[];
  creatives: { id: string; name: string }[];
  segments: { id: string; name: string }[];
  statuses: { id: string; name: string; color: string }[];
  isLoading?: boolean;
}

export function CampaignFilterBar({
  filters,
  onFiltersChange,
  campaigns,
  creatives,
  segments,
  statuses,
  isLoading,
}: CampaignFilterBarProps) {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return 'Período';
    if (!range.to) return format(range.from, 'dd/MM', { locale: ptBR });
    return `${format(range.from, 'dd/MM', { locale: ptBR })} - ${format(range.to, 'dd/MM', { locale: ptBR })}`;
  };

  const handlePresetClick = (preset: typeof datePresets[0]) => {
    onFiltersChange({ ...filters, dateRange: preset.getValue() });
    setIsDatePickerOpen(false);
  };

  const handleDateChange = (range: DateRange | undefined) => {
    onFiltersChange({ ...filters, dateRange: range });
  };

  const handleCampaignChange = (value: string) => {
    onFiltersChange({
      ...filters,
      campaign: value === 'all' ? null : value,
      creative: null // Reset creative when campaign changes
    });
  };

  const handleCreativeChange = (value: string) => {
    onFiltersChange({ ...filters, creative: value === 'all' ? null : value });
  };

  const handleSegmentChange = (value: string) => {
    onFiltersChange({ ...filters, segment: value === 'all' ? null : value });
  };

  const handleStatusChange = (value: string) => {
    onFiltersChange({ ...filters, status: value === 'all' ? null : value });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      dateRange: { from: subDays(new Date(), 29), to: new Date() },
      campaign: null,
      creative: null,
      segment: null,
      status: null,
    });
  };

  // Filter creatives based on selected campaign
  const filteredCreatives = useMemo(() => {
    if (!filters.campaign) return creatives;
    // In real implementation, you'd filter based on campaign
    return creatives;
  }, [creatives, filters.campaign]);

  const activeFiltersCount = [
    filters.campaign,
    filters.creative,
    filters.segment,
    filters.status,
  ].filter(Boolean).length;

  return (
    <div className="bg-card rounded-xl border border-border/50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Filter Icon */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Filter size={18} />
          <span className="text-sm font-medium">Filtros</span>
        </div>

        {/* Date Range Picker */}
        <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 px-3 rounded-lg border-border/50 bg-background",
                filters.dateRange && "border-primary/50 bg-primary/5"
              )}
            >
              <CalendarIcon size={14} className="mr-2 text-muted-foreground" />
              <span className="text-sm">{formatDateRange(filters.dateRange)}</span>
              <ChevronDown size={14} className="ml-2 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="flex">
              <div className="border-r border-border p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Atalhos</p>
                {datePresets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetClick(preset)}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-muted transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="p-3">
                <Calendar
                  mode="range"
                  selected={filters.dateRange}
                  onSelect={handleDateChange}
                  numberOfMonths={2}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Campaign Filter */}
        <Select
          value={filters.campaign || 'all'}
          onValueChange={handleCampaignChange}
          disabled={isLoading}
        >
          <SelectTrigger
            className={cn(
              "w-[180px] h-9 rounded-lg border-border/50 bg-background",
              filters.campaign && "border-primary/50 bg-primary/5"
            )}
          >
            <SelectValue placeholder="Campanha" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Campanhas</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name.length > 25 ? c.name.substring(0, 25) + '...' : c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Creative Filter */}
        <Select
          value={filters.creative || 'all'}
          onValueChange={handleCreativeChange}
          disabled={isLoading}
        >
          <SelectTrigger
            className={cn(
              "w-[180px] h-9 rounded-lg border-border/50 bg-background",
              filters.creative && "border-primary/50 bg-primary/5"
            )}
          >
            <SelectValue placeholder="Criativo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Criativos</SelectItem>
            {filteredCreatives.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name.length > 25 ? c.name.substring(0, 25) + '...' : c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Segment Filter */}
        <Select
          value={filters.segment || 'all'}
          onValueChange={handleSegmentChange}
          disabled={isLoading}
        >
          <SelectTrigger
            className={cn(
              "w-[160px] h-9 rounded-lg border-border/50 bg-background",
              filters.segment && "border-primary/50 bg-primary/5"
            )}
          >
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Segmentos</SelectItem>
            {segments.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={filters.status || 'all'}
          onValueChange={handleStatusChange}
          disabled={isLoading}
        >
          <SelectTrigger
            className={cn(
              "w-[160px] h-9 rounded-lg border-border/50 bg-background",
              filters.status && "border-primary/50 bg-primary/5"
            )}
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-9 px-3 text-muted-foreground hover:text-foreground"
          >
            <X size={14} className="mr-1" />
            Limpar ({activeFiltersCount})
          </Button>
        )}

        {/* Active Filters Badge */}
        {activeFiltersCount > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {activeFiltersCount} filtro{activeFiltersCount > 1 ? 's' : ''} ativo{activeFiltersCount > 1 ? 's' : ''}
          </Badge>
        )}
      </div>
    </div>
  );
}
