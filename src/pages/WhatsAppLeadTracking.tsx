import { useState, useMemo } from 'react';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users, Target, MessageCircle, Calendar as CalendarIcon,
  ChevronUp, ChevronDown, LinkIcon, Megaphone,
  CheckCircle2, AlertCircle, BarChart3, List,
  Search, SlidersHorizontal, TrendingUp, X,
  Trophy, Medal, ShoppingBag
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { useMetaAccounts } from '@/hooks/useMetaAds';
import { useWhatsAppLeadTracking, type TrackedLead, type CreativeBreakdown } from '@/hooks/useWhatsAppLeadTracking';
import { DashboardGrid, DashboardCardConfig } from '@/components/dashboard/DashboardGrid';
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
  ];
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

// Pipeline status colors (gradient from cold to warm)
const STATUS_PALETTE = [
  '#94a3b8', '#3b82f6', '#8b5cf6', '#a855f7', '#f59e0b',
  '#f97316', '#10b981', '#14b8a6', '#22c55e', '#06b6d4',
  '#ec4899', '#ef4444',
];

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function formatDate(dateStr: string) {
  return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
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
        <Icon className={cn("h-4 w-4", color || "text-muted-foreground")} />
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
// Source Badge
// =====================================================

function SourceBadge({ type }: { type: 'ctwa' | 'redirect' | 'linktree' | 'whatsapp' | 'manual' | 'mixed' }) {
  if (type === 'ctwa') {
    return (
      <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 text-xs">
        <MessageCircle className="h-3 w-3 mr-1" />
        CTWA
      </Badge>
    );
  }
  if (type === 'redirect') {
    return (
      <Badge variant="default" className="bg-amber-600 hover:bg-amber-700 text-xs">
        <LinkIcon className="h-3 w-3 mr-1" />
        Redirect
      </Badge>
    );
  }
  if (type === 'linktree') {
    return (
      <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-xs">
        <LinkIcon className="h-3 w-3 mr-1" />
        Linktree
      </Badge>
    );
  }
  if (type === 'whatsapp') {
    return (
      <Badge variant="default" className="bg-purple-600 hover:bg-purple-700 text-xs">
        <MessageCircle className="h-3 w-3 mr-1" />
        WhatsApp
      </Badge>
    );
  }
  if (type === 'manual') {
    return (
      <Badge variant="default" className="bg-pink-600 hover:bg-pink-700 text-xs">
        <Users className="h-3 w-3 mr-1" />
        Manual
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      Misto
    </Badge>
  );
}

// =====================================================
// Main Component
// =====================================================

export default function WhatsAppLeadTracking() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ctwa' | 'redirect'>('all');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);

  // Data Cross filters
  const [dcStatus, setDcStatus] = useState('all');
  const [dcCreative, setDcCreative] = useState('all');
  const [dcAdset, setDcAdset] = useState('all');
  const [dcCampaign, setDcCampaign] = useState('all');
  const [dcSegment, setDcSegment] = useState('all');

  const presetRanges = getPresetRanges();

  const dateFrom = dateRange?.from ? format(startOfDay(dateRange.from), 'yyyy-MM-dd') : format(subDays(new Date(), 30), 'yyyy-MM-dd');
  const dateTo = dateRange?.to ? format(startOfDay(dateRange.to), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

  const { data: accounts } = useMetaAccounts();

  const { data, isLoading } = useWhatsAppLeadTracking({
    dateFrom,
    dateTo,
    sourceType: sourceFilter,
    metaAccountId: selectedAccountId,
  });

  const leads = data?.leads || [];
  const summary = data?.summary || { totalLeads: 0, ctwaLeads: 0, redirectLeads: 0, linktreeLeads: 0, whatsappLeads: 0, manualLeads: 0, matchedCreatives: 0, unmatchedCreatives: 0 };
  const creativeBreakdown = data?.creativeBreakdown || [];

  // Filter leads by search
  const filteredLeads = useMemo(() => {
    if (!searchQuery) return leads;
    const q = searchQuery.toLowerCase();
    return leads.filter(l =>
      l.full_name?.toLowerCase().includes(q) ||
      l.phone?.includes(q) ||
      l.creative_name?.toLowerCase().includes(q) ||
      l.campaign_name?.toLowerCase().includes(q) ||
      l.adset_name?.toLowerCase().includes(q)
    );
  }, [leads, searchQuery]);

  // Sort leads
  const sortedLeads = useMemo(() => {
    if (!sortConfig) return filteredLeads;
    return [...filteredLeads].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortConfig.key) {
        case 'full_name': aVal = a.full_name || ''; bVal = b.full_name || ''; break;
        case 'created_at': aVal = a.created_at; bVal = b.created_at; break;
        case 'creative_name': aVal = a.creative_name || ''; bVal = b.creative_name || ''; break;
        case 'campaign_name': aVal = a.campaign_name || ''; bVal = b.campaign_name || ''; break;
        case 'adset_name': aVal = a.adset_name || ''; bVal = b.adset_name || ''; break;
        case 'source_type': aVal = a.source_type; bVal = b.source_type; break;
        default: return 0;
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredLeads, sortConfig]);

  // Creative breakdown for chart (top 10)
  const chartData = useMemo(() => {
    return creativeBreakdown.slice(0, 10).map(c => ({
      name: c.creative_name.length > 30 ? c.creative_name.substring(0, 30) + '...' : c.creative_name,
      leads: c.lead_count,
      fullName: c.creative_name,
    }));
  }, [creativeBreakdown]);

  // Pie chart data for source distribution
  const pieData = useMemo(() => {
    const result = [];
    if (summary.ctwaLeads > 0) {
      result.push({ name: 'CTWA Ads', value: summary.ctwaLeads, color: '#3b82f6' });
    }
    if (summary.redirectLeads > 0) {
      result.push({ name: 'Redirect', value: summary.redirectLeads, color: '#f59e0b' });
    }
    if (summary.linktreeLeads > 0) {
      result.push({ name: 'Linktree', value: summary.linktreeLeads, color: '#22c55e' });
    }
    if (summary.whatsappLeads > 0) {
      result.push({ name: 'WhatsApp', value: summary.whatsappLeads, color: '#8b5cf6' });
    }
    if (summary.manualLeads > 0) {
      result.push({ name: 'Manual', value: summary.manualLeads, color: '#ec4899' });
    }
    return result;
  }, [summary]);

  // Match status pie
  const matchPieData = useMemo(() => {
    const result = [];
    if (summary.matchedCreatives > 0) {
      result.push({ name: 'Com criativo', value: summary.matchedCreatives, color: '#10b981' });
    }
    if (summary.unmatchedCreatives > 0) {
      result.push({ name: 'Sem criativo', value: summary.unmatchedCreatives, color: '#ef4444' });
    }
    return result;
  }, [summary]);

  // Status breakdown by creative (stacked bar chart data)
  const statusByCreativeData = useMemo(() => {
    // Collect all unique statuses
    const allStatuses = new Set<string>();
    leads.forEach(l => {
      allStatuses.add(l.lead_status || '(Sem status)');
    });

    // Check if any lead has conversion
    const hasAnyConversion = leads.some(l => l.has_conversion);

    // Sort statuses: numeric prefix first, then alphabetically
    const sortedStatuses = Array.from(allStatuses).sort((a, b) => {
      const numA = parseInt(a.match(/^(\d+)/)?.[1] || '999');
      const numB = parseInt(b.match(/^(\d+)/)?.[1] || '999');
      if (a === 'new' || a === '(Sem status)') return -1;
      if (b === 'new' || b === '(Sem status)') return 1;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });

    // Add "Conversão" as the last status if any lead has conversion
    if (hasAnyConversion) {
      sortedStatuses.push('Conversão');
    }

    // Group leads by creative, count per status
    const creativeMap = new Map<string, Record<string, number>>();
    leads.forEach(l => {
      const creative = l.creative_name || '(Sem criativo)';
      const status = l.lead_status || '(Sem status)';
      if (!creativeMap.has(creative)) creativeMap.set(creative, {});
      const counts = creativeMap.get(creative)!;
      counts[status] = (counts[status] || 0) + 1;
      // Also count conversions independently
      if (l.has_conversion) {
        counts['Conversão'] = (counts['Conversão'] || 0) + 1;
      }
    });

    // Top 10 creatives by total leads
    const creativeTotals = Array.from(creativeMap.entries())
      .map(([name, counts]) => ({
        name,
        total: Object.values(counts).reduce((a, b) => a + b, 0) - (counts['Conversão'] || 0),
        counts
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const barData = creativeTotals.map(({ name, counts }) => ({
      creative: name.length > 25 ? name.substring(0, 25) + '...' : name,
      fullName: name,
      ...counts,
    }));

    return { barData, statuses: sortedStatuses };
  }, [leads]);

  // Top 5 criativos por conversão
  const top5ConversionCreatives = useMemo(() => {
    const creativeMap = new Map<string, { count: number; total: number }>();
    leads.forEach(l => {
      if (!l.has_conversion || !l.creative_name) return;
      const existing = creativeMap.get(l.creative_name);
      if (existing) {
        existing.count += 1;
        existing.total += l.conversion_total;
      } else {
        creativeMap.set(l.creative_name, { count: 1, total: l.conversion_total });
      }
    });
    return Array.from(creativeMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [leads]);

  // Data Cross: filter options
  const dcFilterOptions = useMemo(() => {
    const statuses = new Set<string>();
    const creatives = new Set<string>();
    const adsets = new Set<string>();
    const campaigns = new Set<string>();
    const segments = new Set<string>();

    leads.forEach(l => {
      if (l.lead_status) statuses.add(l.lead_status);
      if (l.creative_name) creatives.add(l.creative_name);
      if (l.adset_name) adsets.add(l.adset_name);
      if (l.campaign_name) campaigns.add(l.campaign_name);
      if (l.segment_name) segments.add(l.segment_name);
    });

    const sortStatuses = (arr: string[]) => arr.sort((a, b) => {
      if (a === 'new') return -1;
      if (b === 'new') return 1;
      const numA = parseInt(a.match(/^(\d+)/)?.[1] || '999');
      const numB = parseInt(b.match(/^(\d+)/)?.[1] || '999');
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });

    return {
      statuses: sortStatuses(Array.from(statuses)),
      creatives: Array.from(creatives).sort(),
      adsets: Array.from(adsets).sort(),
      campaigns: Array.from(campaigns).sort(),
      segments: Array.from(segments).sort(),
    };
  }, [leads]);

  // Data Cross: filtered leads
  const dcFilteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (dcStatus !== 'all' && (l.lead_status || '') !== dcStatus) return false;
      if (dcCreative !== 'all' && (l.creative_name || '') !== dcCreative) return false;
      if (dcAdset !== 'all' && (l.adset_name || '') !== dcAdset) return false;
      if (dcCampaign !== 'all' && (l.campaign_name || '') !== dcCampaign) return false;
      if (dcSegment !== 'all' && (l.segment_name || '') !== dcSegment) return false;
      return true;
    });
  }, [leads, dcStatus, dcCreative, dcAdset, dcCampaign, dcSegment]);

  // Data Cross: cross-reference table (creative × status)
  const dcCrossData = useMemo(() => {
    const allStatuses = new Set<string>();
    const creativeMap = new Map<string, Record<string, number>>();

    dcFilteredLeads.forEach(l => {
      const creative = l.creative_name || '(Sem criativo)';
      const status = l.lead_status || '(Sem status)';
      allStatuses.add(status);

      if (!creativeMap.has(creative)) creativeMap.set(creative, {});
      const counts = creativeMap.get(creative)!;
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

    const rows = Array.from(creativeMap.entries()).map(([creative, counts]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const newCount = counts['new'] || 0;
      const convRate = total > 0 ? ((total - newCount) / total) * 100 : 0;
      return { creative, total, convRate, counts };
    }).sort((a, b) => b.total - a.total);

    // Summary
    const totalFiltered = dcFilteredLeads.length;
    const totalNew = dcFilteredLeads.filter(l => (l.lead_status || '') === 'new').length;
    const overallConvRate = totalFiltered > 0 ? ((totalFiltered - totalNew) / totalFiltered) * 100 : 0;
    const uniqueSegments = new Set(dcFilteredLeads.map(l => l.segment_name).filter(Boolean)).size;

    return { rows, statuses: sortedStatuses, totalFiltered, overallConvRate, totalNew, uniqueSegments };
  }, [dcFilteredLeads]);

  const dcHasFilters = dcStatus !== 'all' || dcCreative !== 'all' || dcAdset !== 'all' || dcCampaign !== 'all' || dcSegment !== 'all';

  const dcClearFilters = () => {
    setDcStatus('all');
    setDcCreative('all');
    setDcAdset('all');
    setDcCampaign('all');
    setDcSegment('all');
  };

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
        className={cn("cursor-pointer hover:bg-muted/50 select-none", className)}
        onClick={handleSort}
      >
        <div className="flex items-center gap-1">
          {children}
          <div className="flex flex-col">
            <ChevronUp className={cn(
              "h-3 w-3 -mb-1",
              isActive && direction === 'asc' ? 'text-primary' : 'text-muted-foreground/40'
            )} />
            <ChevronDown className={cn(
              "h-3 w-3",
              isActive && direction === 'desc' ? 'text-primary' : 'text-muted-foreground/40'
            )} />
          </div>
        </div>
      </TableHead>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-blue-600" />
            WhatsApp Lead Tracking
          </h1>
          <p className="text-muted-foreground">
            Rastreamento de leads por campanha com cruzamento de criativos Meta Ads
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Meta Account Filter */}
          <Select
            value={selectedAccountId || 'all'}
            onValueChange={(v) => setSelectedAccountId(v === 'all' ? null : v)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Conta Meta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accounts?.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.account_name || account.account_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Source Filter */}
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as any)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas origens</SelectItem>
              <SelectItem value="ctwa">CTWA Ads</SelectItem>
              <SelectItem value="redirect">Redirect</SelectItem>
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
                      {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                    </>
                  ) : (
                    format(dateRange.from, "dd/MM/yyyy")
                  )
                ) : (
                  "Selecione o periodo"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="flex">
                <div className="border-r p-2 space-y-1">
                  {presetRanges.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-left"
                      onClick={() => setDateRange(preset.range)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2"><Skeleton className="h-4 w-20" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-24" /></CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Total de Leads"
              value={formatNumber(summary.totalLeads)}
              icon={Users}
              description="No periodo selecionado"
            />
            <StatCard
              title="Leads CTWA"
              value={formatNumber(summary.ctwaLeads)}
              icon={MessageCircle}
              description="Click-to-WhatsApp Ads"
              color="text-blue-600"
            />
            <StatCard
              title="Leads Redirect"
              value={formatNumber(summary.redirectLeads)}
              icon={LinkIcon}
              description="Campanhas de redirect"
              color="text-amber-600"
            />
            <StatCard
              title="Leads Linktree"
              value={formatNumber(summary.linktreeLeads)}
              icon={LinkIcon}
              description="Via Linktree"
              color="text-green-600"
            />
            <StatCard
              title="Leads WhatsApp"
              value={formatNumber(summary.whatsappLeads)}
              icon={MessageCircle}
              description="Organicos WhatsApp"
              color="text-purple-600"
            />
            <StatCard
              title="Leads Manual"
              value={formatNumber(summary.manualLeads)}
              icon={Users}
              description="Cadastro manual"
              color="text-pink-600"
            />
            <StatCard
              title="Com Criativo"
              value={formatNumber(summary.matchedCreatives)}
              icon={CheckCircle2}
              description="Criativo identificado"
              color="text-green-600"
            />
            <StatCard
              title="Sem Criativo"
              value={formatNumber(summary.unmatchedCreatives)}
              icon={AlertCircle}
              description="Criativo nao vinculado"
              color="text-red-500"
            />
          </>
        )}
      </div>

      {/* Tabs: Charts / Creative Breakdown / Leads List */}
      <Tabs defaultValue="creatives" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="creatives" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Criativos
          </TabsTrigger>
          <TabsTrigger value="charts" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Graficos
          </TabsTrigger>
          <TabsTrigger value="leads" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Leads
          </TabsTrigger>
          <TabsTrigger value="datacross" className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Data Cross
          </TabsTrigger>
        </TabsList>

        {/* Tab: Creative Breakdown */}
        <TabsContent value="creatives" className="mt-6 space-y-6">
          <DashboardGrid
            storageKey="whatsapp-lead-tracking-creatives"
            cards={[
              {
                id: 'creative-chart',
                component: (
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle>Top 10 Criativos por Leads</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <Skeleton className="h-[300px] w-full" />
                      ) : chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" className="text-xs" />
                            <YAxis dataKey="name" type="category" className="text-xs" width={180} tick={{ fontSize: 11 }} />
                            <Tooltip
                              formatter={(value: number, _name: string, props: any) => [
                                `${value} leads`,
                                props.payload.fullName
                              ]}
                            />
                            <Bar dataKey="leads" radius={[0, 4, 4, 0]}>
                              {chartData.map((_entry, index) => (
                                <Cell key={index} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          Nenhum dado disponivel
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ),
              },
              {
                id: 'source-distribution',
                component: (
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle>Distribuicao por Origem</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <Skeleton className="h-[300px] w-full" />
                      ) : pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, value }) => `${name}: ${value}`}
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={index} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => [`${value} leads`]} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          Nenhum dado disponivel
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ),
              },
              {
                id: 'creative-table',
                fullWidth: true,
                component: (
                  <Card>
                    <CardHeader>
                      <CardTitle>Breakdown por Criativo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <div className="space-y-3">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 w-full" />
                          ))}
                        </div>
                      ) : creativeBreakdown.length > 0 ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Criativo</TableHead>
                                <TableHead>Conjunto de Anuncio</TableHead>
                                <TableHead>Campanha</TableHead>
                                <TableHead>Origem</TableHead>
                                <TableHead className="text-right">Leads</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {creativeBreakdown.map((item, idx) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium max-w-[250px]">
                                    <span className="truncate block" title={item.creative_name}>
                                      {item.creative_name}
                                    </span>
                                  </TableCell>
                                  <TableCell className="max-w-[200px]">
                                    <span className="truncate block text-muted-foreground" title={item.adset_name || '-'}>
                                      {item.adset_name || '-'}
                                    </span>
                                  </TableCell>
                                  <TableCell className="max-w-[200px]">
                                    <span className="truncate block text-muted-foreground" title={item.campaign_name || '-'}>
                                      {item.campaign_name || '-'}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <SourceBadge type={item.source_type} />
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {formatNumber(item.lead_count)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          Nenhum criativo encontrado no periodo selecionado.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ),
              },
            ] as DashboardCardConfig[]}
          />
        </TabsContent>

        {/* Tab: Charts */}
        <TabsContent value="charts" className="mt-6 space-y-6">
          <DashboardGrid
            storageKey="whatsapp-lead-tracking-charts"
            cards={[
              {
                id: 'status-by-creative',
                fullWidth: true,
                component: (
                  <Card>
                    <CardHeader>
                      <CardTitle>Jornada do Lead por Criativo</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <Skeleton className="h-[400px] w-full" />
                      ) : statusByCreativeData.barData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={Math.max(300, statusByCreativeData.barData.length * 45)}>
                          <BarChart
                            data={statusByCreativeData.barData}
                            layout="vertical"
                            margin={{ left: 20, right: 20 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" className="text-xs" />
                            <YAxis
                              dataKey="creative"
                              type="category"
                              className="text-xs"
                              width={200}
                              tick={{ fontSize: 11 }}
                            />
                            <Tooltip
                              formatter={(value: number, name: string) => [`${value} leads`, name]}
                              labelFormatter={(_label: string, payload: any[]) => payload?.[0]?.payload?.fullName || _label}
                            />
                            <Legend />
                            {statusByCreativeData.statuses.map((status, idx) => (
                              <Bar
                                key={status}
                                dataKey={status}
                                stackId="status"
                                fill={status === 'Conversão' ? '#22c55e' : STATUS_PALETTE[idx % STATUS_PALETTE.length]}
                                name={status}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          Nenhum dado disponivel
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ),
              },
              {
                id: 'match-status',
                component: (
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle>Status de Vinculacao</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <Skeleton className="h-[300px] w-full" />
                      ) : matchPieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={matchPieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                            >
                              {matchPieData.map((entry, index) => (
                                <Cell key={index} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => [`${value} leads`]} />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          Nenhum dado disponivel
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ),
              },
              {
                id: 'top5-conversions',
                component: (
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-amber-500" />
                        Top 5 Criativos por Conversão
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <Skeleton className="h-[300px] w-full" />
                      ) : top5ConversionCreatives.length > 0 ? (
                        <div className="space-y-3">
                          {top5ConversionCreatives.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 py-2 px-3 rounded-md bg-muted/50">
                              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                                style={{
                                  backgroundColor: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'transparent',
                                  color: idx < 3 ? 'white' : 'inherit',
                                }}>
                                {idx < 3 ? (
                                  <Trophy className="h-4 w-4" />
                                ) : (
                                  <span>{idx + 1}º</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" title={item.name}>{item.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.count} {item.count === 1 ? 'conversão' : 'conversões'} · {formatCurrency(item.total)}
                                </p>
                              </div>
                              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                <ShoppingBag className="h-3 w-3 mr-1" />
                                {formatCurrency(item.total)}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                          Nenhuma conversão registrada no período
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ),
              },
              {
                id: 'unmatched-leads-detail',
                component: (
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle>Leads sem Criativo Vinculado</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <Skeleton className="h-[300px] w-full" />
                      ) : (() => {
                        const unmatched = leads.filter(l => !l.creative_matched && l.source_type === 'ctwa');
                        // Group unmatched by available referral info
                        const groupMap = new Map<string, number>();
                        unmatched.forEach(l => {
                          const ref = l.referral_data;
                          const label = ref?.headline || ref?.body || ref?.sourceUrl || '(Sem dados)';
                          const truncated = typeof label === 'string' && label.length > 40 ? label.substring(0, 40) + '...' : label;
                          groupMap.set(truncated, (groupMap.get(truncated) || 0) + 1);
                        });
                        const unmatchedGroups = Array.from(groupMap.entries())
                          .map(([name, count]) => ({ name, count }))
                          .sort((a, b) => b.count - a.count)
                          .slice(0, 10);

                        return unmatchedGroups.length > 0 ? (
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {unmatchedGroups.map((group, idx) => (
                              <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                                <span className="text-sm truncate max-w-[70%]" title={group.name}>
                                  {group.name}
                                </span>
                                <Badge variant="secondary">{group.count} leads</Badge>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                            {summary.totalLeads > 0
                              ? 'Todos os leads CTWA possuem criativo vinculado'
                              : 'Nenhum dado disponivel'}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                ),
              },
            ] as DashboardCardConfig[]}
          />
        </TabsContent>

        {/* Tab: Leads List */}
        <TabsContent value="leads" className="mt-6 space-y-4">
          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone, criativo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Leads ({formatNumber(filteredLeads.length)})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : sortedLeads.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableHeader sortKey="full_name">Nome</SortableHeader>
                        <TableHead>Telefone</TableHead>
                        <SortableHeader sortKey="source_type">Origem</SortableHeader>
                        <SortableHeader sortKey="creative_name">Criativo</SortableHeader>
                        <SortableHeader sortKey="adset_name">Conjunto</SortableHeader>
                        <SortableHeader sortKey="campaign_name">Campanha</SortableHeader>
                        <TableHead>Status</TableHead>
                        <SortableHeader sortKey="created_at">Data</SortableHeader>
                        <TableHead>Match</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedLeads.slice(0, 100).map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium max-w-[150px] truncate">
                            {lead.full_name}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {lead.phone}
                          </TableCell>
                          <TableCell>
                            <SourceBadge type={lead.source_type} />
                          </TableCell>
                          <TableCell className="max-w-[180px]">
                            <span className="truncate block text-sm" title={lead.creative_name || '-'}>
                              {lead.creative_name || <span className="text-muted-foreground">-</span>}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[150px]">
                            <span className="truncate block text-sm text-muted-foreground" title={lead.adset_name || '-'}>
                              {lead.adset_name || '-'}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[150px]">
                            <span className="truncate block text-sm text-muted-foreground" title={lead.campaign_name || '-'}>
                              {lead.campaign_name || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {lead.lead_status ? (
                              <Badge variant="outline" className="text-xs">
                                {lead.lead_status}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(lead.created_at)}
                          </TableCell>
                          <TableCell>
                            {lead.creative_matched ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-400" />
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {sortedLeads.length > 100 && (
                    <p className="text-center text-sm text-muted-foreground mt-4">
                      Exibindo 100 de {formatNumber(sortedLeads.length)} leads. Use os filtros para refinar.
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum lead encontrado no periodo selecionado.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Data Cross */}
        <TabsContent value="datacross" className="mt-6 space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5" />
                  Filtros Cruzados
                </span>
                {dcHasFilters && (
                  <Button variant="ghost" size="sm" onClick={dcClearFilters} className="text-muted-foreground">
                    <X className="h-4 w-4 mr-1" />
                    Limpar filtros
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Status do Lead</label>
                  <Select value={dcStatus} onValueChange={setDcStatus}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {dcFilterOptions.statuses.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Criativo</label>
                  <Select value={dcCreative} onValueChange={setDcCreative}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {dcFilterOptions.creatives.map(c => (
                        <SelectItem key={c} value={c}>
                          {c.length > 35 ? c.substring(0, 35) + '...' : c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Conjunto de Anuncio</label>
                  <Select value={dcAdset} onValueChange={setDcAdset}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {dcFilterOptions.adsets.map(a => (
                        <SelectItem key={a} value={a}>
                          {a.length > 35 ? a.substring(0, 35) + '...' : a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Campanha</label>
                  <Select value={dcCampaign} onValueChange={setDcCampaign}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {dcFilterOptions.campaigns.map(c => (
                        <SelectItem key={c} value={c}>
                          {c.length > 35 ? c.substring(0, 35) + '...' : c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Segmento</label>
                  <Select value={dcSegment} onValueChange={setDcSegment}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {dcFilterOptions.segments.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary metrics */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Filtrado</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(dcCrossData.totalFiltered)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  de {formatNumber(leads.length)} leads
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Avanco</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dcCrossData.overallConvRate.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Leads que avancaram de &quot;new&quot;
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ainda em &quot;New&quot;</CardTitle>
                <AlertCircle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(dcCrossData.totalNew)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Aguardando primeiro contato
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Segmentos</CardTitle>
                <Target className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(dcCrossData.uniqueSegments)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Segmentos nos leads filtrados
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cross-reference table */}
          <Card>
            <CardHeader>
              <CardTitle>Criativo x Status do Lead</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : dcCrossData.rows.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Criativo</TableHead>
                        <TableHead className="text-center font-semibold">Total</TableHead>
                        {dcCrossData.statuses.map(status => (
                          <TableHead key={status} className="text-center min-w-[80px]">
                            <span className="text-xs">{status}</span>
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-semibold min-w-[100px]">
                          <span className="flex items-center justify-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Avanco
                          </span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dcCrossData.rows.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="sticky left-0 bg-background z-10 font-medium max-w-[250px]">
                            <span className="truncate block" title={row.creative}>
                              {row.creative}
                            </span>
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {row.total}
                          </TableCell>
                          {dcCrossData.statuses.map(status => {
                            const count = row.counts[status] || 0;
                            return (
                              <TableCell key={status} className="text-center">
                                {count > 0 ? (
                                  <span className="inline-flex items-center justify-center min-w-[28px] h-7 rounded-md bg-muted px-2 text-sm font-medium">
                                    {count}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40">-</span>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center">
                            <Badge
                              variant={row.convRate >= 50 ? 'default' : row.convRate >= 25 ? 'secondary' : 'outline'}
                              className={cn(
                                'text-xs',
                                row.convRate >= 50 && 'bg-green-600 hover:bg-green-700',
                                row.convRate >= 25 && row.convRate < 50 && 'bg-amber-600 hover:bg-amber-700 text-white',
                              )}
                            >
                              {row.convRate.toFixed(0)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals row */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell className="sticky left-0 bg-muted/50 z-10">TOTAL</TableCell>
                        <TableCell className="text-center font-bold">
                          {dcCrossData.totalFiltered}
                        </TableCell>
                        {dcCrossData.statuses.map(status => {
                          const total = dcCrossData.rows.reduce((sum, r) => sum + (r.counts[status] || 0), 0);
                          return (
                            <TableCell key={status} className="text-center font-bold">
                              {total > 0 ? total : '-'}
                            </TableCell>
                          );
                        })}
                        <TableCell className="text-center">
                          <Badge variant="default" className="bg-blue-600 text-xs">
                            {dcCrossData.overallConvRate.toFixed(0)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum lead encontrado com os filtros selecionados.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
