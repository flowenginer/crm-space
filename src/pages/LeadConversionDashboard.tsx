import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Users, CheckCircle2, TrendingUp, DollarSign,
  Calendar as CalendarIcon, ChevronUp, ChevronDown,
  Search, BarChart3, X
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import {
  useLeadConversionDashboard,
  type ConversionLead,
} from '@/hooks/useLeadConversionDashboard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, Cell, PieChart, Pie, Legend
} from 'recharts';

// =====================================================
// Helpers
// =====================================================

const getPresetRanges = () => {
  const today = new Date();
  return [
    { label: 'Hoje', range: { from: startOfDay(today), to: endOfDay(today) } },
    { label: 'Ontem', range: { from: startOfDay(subDays(today, 1)), to: endOfDay(subDays(today, 1)) } },
    { label: 'Esta Semana', range: { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfDay(today) } },
    { label: 'Este Mes', range: { from: startOfMonth(today), to: endOfMonth(today) } },
    { label: 'Ultimos 7 dias', range: { from: startOfDay(subDays(today, 6)), to: endOfDay(today) } },
    { label: 'Ultimos 30 dias', range: { from: startOfDay(subDays(today, 29)), to: endOfDay(today) } },
    { label: 'Ultimos 90 dias', range: { from: startOfDay(subDays(today, 89)), to: endOfDay(today) } },
  ];
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateStr: string) {
  return format(new Date(dateStr), 'dd/MM/yyyy', { locale: ptBR });
}

// =====================================================
// Stat Card
// =====================================================

function StatCard({ title, value, icon: Icon, description, color }: {
  title: string;
  value: string;
  icon: React.ElementType;
  description?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn('h-4 w-4', color || 'text-muted-foreground')} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

// =====================================================
// Main Component
// =====================================================

export default function LeadConversionDashboard() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 50;

  const presetRanges = getPresetRanges();

  const dateFrom = dateRange?.from ? format(startOfDay(dateRange.from), 'yyyy-MM-dd') : format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const dateTo = dateRange?.to ? format(startOfDay(dateRange.to), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

  const { data, isLoading } = useLeadConversionDashboard({
    dateFrom,
    dateTo,
    origin: originFilter !== 'all' ? originFilter : null,
    campaignName: campaignFilter !== 'all' ? campaignFilter : null,
  });

  const leads = data?.leads || [];
  const summary = data?.summary || { totalLeads: 0, convertedLeads: 0, conversionRate: 0, totalValue: 0, convertedByCustomField: 0, convertedByStatus: 0 };
  const originBreakdown = data?.originBreakdown || [];
  const creativeBreakdown = data?.creativeBreakdown || [];
  const statusBreakdown = data?.statusBreakdown || [];

  // Filter options
  const originOptions = useMemo(() => {
    const origins = new Set<string>();
    leads.forEach(l => origins.add(l.origin || 'other'));
    return Array.from(origins).sort();
  }, [leads]);

  const campaignOptions = useMemo(() => {
    const campaigns = new Set<string>();
    leads.forEach(l => { if (l.campaign_name) campaigns.add(l.campaign_name); });
    return Array.from(campaigns).sort();
  }, [leads]);

  // Search filter
  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;
    const q = searchQuery.toLowerCase();
    return leads.filter(l =>
      l.full_name?.toLowerCase().includes(q) ||
      l.phone?.includes(q) ||
      l.creative_name?.toLowerCase().includes(q) ||
      l.campaign_name?.toLowerCase().includes(q) ||
      l.lead_status?.toLowerCase().includes(q)
    );
  }, [leads, searchQuery]);

  // Sort
  const sortedLeads = useMemo(() => {
    if (!sortConfig) return filteredLeads;
    return [...filteredLeads].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortConfig.key) {
        case 'full_name': aVal = a.full_name || ''; bVal = b.full_name || ''; break;
        case 'created_at': aVal = a.created_at; bVal = b.created_at; break;
        case 'lead_status': aVal = a.lead_status || ''; bVal = b.lead_status || ''; break;
        case 'origin': aVal = a.origin || ''; bVal = b.origin || ''; break;
        case 'creative_name': aVal = a.creative_name || ''; bVal = b.creative_name || ''; break;
        case 'is_converted': aVal = a.is_converted ? 1 : 0; bVal = b.is_converted ? 1 : 0; break;
        case 'negotiated_value': aVal = a.negotiated_value || 0; bVal = b.negotiated_value || 0; break;
        default: return 0;
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredLeads, sortConfig]);

  // Pagination
  const paginatedLeads = useMemo(() => {
    const start = currentPage * PAGE_SIZE;
    return sortedLeads.slice(start, start + PAGE_SIZE);
  }, [sortedLeads, currentPage]);

  const totalPages = Math.ceil(sortedLeads.length / PAGE_SIZE);

  // Chart data: Origin
  const originChartData = useMemo(() => {
    return originBreakdown.map(o => ({
      name: o.label,
      total: o.total,
      convertidos: o.converted,
      naoConvertidos: o.total - o.converted,
      taxa: o.conversionRate.toFixed(1),
    }));
  }, [originBreakdown]);

  // Chart data: Pie conversion source
  const conversionPieData = useMemo(() => {
    const result = [];
    if (summary.convertedByCustomField > 0) {
      result.push({ name: 'Campo personalizado', value: summary.convertedByCustomField, color: '#10b981' });
    }
    if (summary.convertedByStatus > 0) {
      result.push({ name: 'Status (07-13)', value: summary.convertedByStatus, color: '#3b82f6' });
    }
    const notConverted = summary.totalLeads - summary.convertedLeads;
    if (notConverted > 0) {
      result.push({ name: 'Nao convertidos', value: notConverted, color: '#94a3b8' });
    }
    return result;
  }, [summary]);

  // Chart data: Creative top 15
  const creativeChartData = useMemo(() => {
    return creativeBreakdown.slice(0, 15).map(c => ({
      name: c.creative_name.length > 25 ? c.creative_name.substring(0, 25) + '...' : c.creative_name,
      fullName: c.creative_name,
      total: c.total,
      convertidos: c.converted,
      naoConvertidos: c.total - c.converted,
      taxa: c.conversionRate.toFixed(1),
    }));
  }, [creativeBreakdown]);

  // Cross table: Creative x Status
  const crossTableData = useMemo(() => {
    const allStatuses = new Set<string>();
    const creativeStatusMap = new Map<string, Record<string, number>>();

    leads.forEach(l => {
      if (!l.creative_name) return;
      const status = l.lead_status || '(Sem status)';
      allStatuses.add(status);

      if (!creativeStatusMap.has(l.creative_name)) {
        creativeStatusMap.set(l.creative_name, {});
      }
      const counts = creativeStatusMap.get(l.creative_name)!;
      counts[status] = (counts[status] || 0) + 1;
    });

    const sortedStatuses = Array.from(allStatuses).sort((a, b) => {
      if (a === 'new' || a === '(Sem status)') return -1;
      if (b === 'new' || b === '(Sem status)') return 1;
      const numA = parseInt(a.match(/^(\d+)/)?.[1] || '999');
      const numB = parseInt(b.match(/^(\d+)/)?.[1] || '999');
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });

    const rows = Array.from(creativeStatusMap.entries())
      .map(([creative, counts]) => {
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        const convertedCount = Object.entries(counts)
          .filter(([status]) => {
            const match = status.match(/^(\d+)/);
            const prefix = match ? match[1].padStart(2, '0') : null;
            return prefix ? ['07', '08', '09', '10', '11', '12', '13'].includes(prefix) : false;
          })
          .reduce((sum, [, count]) => sum + count, 0);
        const convRate = total > 0 ? (convertedCount / total) * 100 : 0;
        return { creative, total, convertedCount, convRate, counts };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);

    return { rows, statuses: sortedStatuses };
  }, [leads]);

  // Sortable header
  const SortableHeader = ({ children, sortKey, className }: {
    children: React.ReactNode;
    sortKey: string;
    className?: string;
  }) => {
    const isActive = sortConfig?.key === sortKey;
    const direction = isActive ? sortConfig.direction : null;

    const handleSort = () => {
      if (!isActive) {
        setSortConfig({ key: sortKey, direction: 'desc' });
      } else if (direction === 'desc') {
        setSortConfig({ key: sortKey, direction: 'asc' });
      } else {
        setSortConfig(null);
      }
    };

    return (
      <TableHead
        className={cn('cursor-pointer hover:bg-muted/50 select-none', className)}
        onClick={handleSort}
      >
        <div className="flex items-center gap-1">
          {children}
          <div className="flex flex-col">
            <ChevronUp className={cn('h-3 w-3 -mb-1', isActive && direction === 'asc' ? 'text-primary' : 'text-muted-foreground/40')} />
            <ChevronDown className={cn('h-3 w-3', isActive && direction === 'desc' ? 'text-primary' : 'text-muted-foreground/40')} />
          </div>
        </div>
      </TableHead>
    );
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            Dashboard de Conversao
          </h1>
          <p className="text-muted-foreground">
            Analise completa de leads: origem, trafego, criativos e conversoes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Origin Filter */}
          <Select value={originFilter} onValueChange={(v) => { setOriginFilter(v); setCurrentPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              {originOptions.map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Campaign Filter */}
          <Select value={campaignFilter} onValueChange={(v) => { setCampaignFilter(v); setCurrentPage(0); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Campanha" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas campanhas</SelectItem>
              {campaignOptions.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Date Range */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start text-left font-normal min-w-[200px]">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'dd/MM/yy', { locale: ptBR })} - {format(dateRange.to, 'dd/MM/yy', { locale: ptBR })}
                    </>
                  ) : format(dateRange.from, 'dd/MM/yy', { locale: ptBR })
                ) : 'Selecionar periodo'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex gap-2 p-3 border-b flex-wrap">
                {presetRanges.map(preset => (
                  <Button
                    key={preset.label}
                    variant="ghost"
                    size="sm"
                    onClick={() => setDateRange(preset.range)}
                    className="text-xs"
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
              <Calendar
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Leads"
          value={formatNumber(summary.totalLeads)}
          icon={Users}
          color="text-blue-600"
        />
        <StatCard
          title="Leads Convertidos"
          value={formatNumber(summary.convertedLeads)}
          icon={CheckCircle2}
          description={`${summary.convertedByCustomField} por campo + ${summary.convertedByStatus} por status`}
          color="text-green-600"
        />
        <StatCard
          title="Taxa de Conversao"
          value={`${summary.conversionRate.toFixed(1)}%`}
          icon={TrendingUp}
          description={`${formatNumber(summary.convertedLeads)} de ${formatNumber(summary.totalLeads)} leads`}
          color="text-purple-600"
        />
        <StatCard
          title="Valor Total"
          value={formatCurrency(summary.totalValue)}
          icon={DollarSign}
          description="Valor negociado dos convertidos"
          color="text-amber-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Origin Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads por Origem</CardTitle>
          </CardHeader>
          <CardContent>
            {originChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={originChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatNumber(value), name === 'convertidos' ? 'Convertidos' : 'Nao convertidos']}
                    labelFormatter={(label) => {
                      const item = originChartData.find(d => d.name === label);
                      return `${label} (Taxa: ${item?.taxa}%)`;
                    }}
                  />
                  <Bar dataKey="convertidos" stackId="a" fill="#10b981" name="Convertidos" />
                  <Bar dataKey="naoConvertidos" stackId="a" fill="#94a3b8" name="Nao convertidos" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados para o periodo selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Conversion Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuicao de Conversao</CardTitle>
          </CardHeader>
          <CardContent>
            {conversionPieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={conversionPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {conversionPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatNumber(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Sem dados para o periodo selecionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Creative Chart */}
      {creativeChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 15 Criativos por Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={creativeChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={200} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatNumber(value), name === 'convertidos' ? 'Convertidos' : 'Nao convertidos']}
                  labelFormatter={(label) => {
                    const item = creativeChartData.find(d => d.name === label);
                    return `${item?.fullName || label} (Taxa: ${item?.taxa}%)`;
                  }}
                />
                <Bar dataKey="convertidos" stackId="a" fill="#10b981" name="Convertidos" />
                <Bar dataKey="naoConvertidos" stackId="a" fill="#94a3b8" name="Nao convertidos" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Status Breakdown */}
      {statusBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuicao por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={statusBreakdown}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" tick={{ fontSize: 11, angle: -30 }} height={80} textAnchor="end" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatNumber(value)} />
                <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]}>
                  {statusBreakdown.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.is_conversion_status ? '#10b981' : COLORS[index % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Cross Table: Creative x Status */}
      {crossTableData.rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cruzamento: Criativo x Status</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px] sticky left-0 bg-background">Criativo</TableHead>
                  <TableHead className="text-center font-bold">Total</TableHead>
                  <TableHead className="text-center font-bold">Conv. %</TableHead>
                  {crossTableData.statuses.map(status => (
                    <TableHead key={status} className="text-center text-xs min-w-[80px]">
                      {status}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {crossTableData.rows.map(row => (
                  <TableRow key={row.creative}>
                    <TableCell className="font-medium text-sm sticky left-0 bg-background max-w-[250px] truncate" title={row.creative}>
                      {row.creative}
                    </TableCell>
                    <TableCell className="text-center font-bold">{row.total}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={row.convRate > 0 ? 'default' : 'secondary'} className={cn('text-xs', row.convRate > 0 && 'bg-green-600')}>
                        {row.convRate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    {crossTableData.statuses.map(status => (
                      <TableCell key={status} className="text-center text-sm">
                        {row.counts[status] || '-'}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="text-base">
              Todos os Leads ({formatNumber(sortedLeads.length)})
            </CardTitle>
            <div className="relative w-full sm:w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone, criativo..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
                className="pl-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader sortKey="full_name">Nome</SortableHeader>
                <TableHead>Telefone</TableHead>
                <SortableHeader sortKey="lead_status">Status</SortableHeader>
                <SortableHeader sortKey="origin">Origem</SortableHeader>
                <SortableHeader sortKey="creative_name">Criativo</SortableHeader>
                <TableHead>Campanha</TableHead>
                <SortableHeader sortKey="created_at">Data</SortableHeader>
                <SortableHeader sortKey="is_converted" className="text-center">Convertido</SortableHeader>
                <SortableHeader sortKey="negotiated_value" className="text-right">Valor</SortableHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLeads.map(lead => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium max-w-[180px] truncate" title={lead.full_name}>
                    {lead.full_name}
                  </TableCell>
                  <TableCell className="text-sm">{lead.phone}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">
                      {lead.lead_status || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{lead.origin || '-'}</TableCell>
                  <TableCell className="text-sm max-w-[150px] truncate" title={lead.creative_name || ''}>
                    {lead.creative_name || '-'}
                  </TableCell>
                  <TableCell className="text-sm max-w-[150px] truncate" title={lead.campaign_name || ''}>
                    {lead.campaign_name || '-'}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{formatDate(lead.created_at)}</TableCell>
                  <TableCell className="text-center">
                    {lead.is_converted ? (
                      <Badge className="bg-green-600 text-xs">
                        {lead.conversion_source === 'custom_field' ? 'Campo' : 'Status'}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {lead.negotiated_value ? formatCurrency(lead.negotiated_value) : '-'}
                  </TableCell>
                </TableRow>
              ))}
              {paginatedLeads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhum lead encontrado para os filtros selecionados
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, sortedLeads.length)} de {formatNumber(sortedLeads.length)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                >
                  Proximo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
