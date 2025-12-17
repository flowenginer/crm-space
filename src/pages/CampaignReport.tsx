import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Facebook,
  TrendingUp,
  Users,
  Target,
  Calendar as CalendarIcon,
  ChevronDown,
  Download,
  FileText,
  Loader2,
  UserPlus,
  ArrowLeft,
  BarChart3,
  DollarSign,
  Wallet,
  PiggyBank,
  Table2,
  PieChart,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { useNavigate } from 'react-router-dom';
import { useDailyLeads } from '@/hooks/useCampaignMetrics';
import { useMetaLeadsCrossData } from '@/hooks/useMetaLeadsCrossData';
import { useMetaCampaignROI } from '@/hooks/useMetaCampaignROI';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { useSegments } from '@/hooks/useSegments';
import { CrossDataTable } from '@/components/campaigns/CrossDataTable';
import { ROITable } from '@/components/campaigns/ROITable';
import { DashboardGrid, DashboardCardConfig } from '@/components/dashboard/DashboardGrid';
import * as XLSX from 'xlsx';

const datePresets = [
  { label: 'Hoje', getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Últimos 7 dias', getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: 'Últimos 30 dias', getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: 'Este mês', getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: 'Mês passado', getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
];

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  gradient: string;
  isLoading?: boolean;
}

function StatCard({ title, value, subtitle, icon: Icon, gradient, isLoading }: StatCardProps) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated hover:shadow-elevated-lg transition-all duration-300 group">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="space-y-1">
            {isLoading ? (
              <div className="h-9 flex items-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <h3 className="text-3xl font-bold text-foreground tracking-tight">{value}</h3>
                {subtitle && (
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                )}
              </>
            )}
          </div>
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 shadow-lg">
        <p className="font-semibold text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function CampaignReport() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Data hooks
  const { data: dailyLeads = [], isLoading: loadingDaily } = useDailyLeads({
    from: dateRange?.from || subDays(new Date(), 29),
    to: dateRange?.to || new Date(),
  });
  const { data: statuses = [] } = useLeadStatuses();
  const { data: segments = [] } = useSegments();
  
  const activeDateRange = dateRange?.from && dateRange?.to 
    ? { from: dateRange.from, to: dateRange.to }
    : undefined;

  const { data: crossData, isLoading: loadingCrossData } = useMetaLeadsCrossData(activeDateRange);
  const { data: roiData, isLoading: loadingROI } = useMetaCampaignROI(activeDateRange);

  const summary = crossData?.summary;
  const roiSummary = roiData?.summary;

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return 'Selecionar período';
    if (!range.to) return format(range.from, 'dd/MM/yyyy', { locale: ptBR });
    return `${format(range.from, 'dd/MM/yyyy', { locale: ptBR })} - ${format(range.to, 'dd/MM/yyyy', { locale: ptBR })}`;
  };

  const handlePresetClick = (preset: typeof datePresets[0]) => {
    setDateRange(preset.getValue());
    setIsDatePickerOpen(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleExportExcel = () => {
    if (!crossData?.rows) return;

    // Preparar dados para export
    const exportData = crossData.rows.map(row => ({
      'Campanha': row.campaignName || '',
      'Anúncio': row.adName || '',
      'Total Leads': row.totalLeads,
      'Leads Hoje': row.leadsToday,
      'Leads Este Mês': row.leadsThisMonth,
      'Com Vendedor': row.withAgent,
      'Sem Vendedor': row.withoutAgent,
      'Responderam': row.responded,
      'Não Responderam': row.notResponded,
      'Conversões': row.conversions,
      'Receita': row.revenue,
      'Taxa Conversão (%)': row.conversionRate.toFixed(2),
      ...Object.fromEntries(
        Object.entries(row.bySegment).map(([seg, count]) => [`Seg: ${seg}`, count])
      ),
      ...Object.fromEntries(
        Object.entries(row.byStatus).map(([status, count]) => [`Status: ${status}`, count])
      ),
    }));

    const wb = XLSX.utils.book_new();
    
    // Aba de cruzamento
    const ws1 = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Cruzamento por Anúncio');

    // Aba de ROI
    if (roiData?.campaigns) {
      const roiExport = roiData.campaigns.map(c => ({
        'Campanha': c.campaignName,
        'Gastos (R$)': c.spend.toFixed(2),
        'Leads': c.leads,
        'CPL (R$)': c.cpl.toFixed(2),
        'Conversões': c.conversions,
        'CAC (R$)': c.cac.toFixed(2),
        'Receita (R$)': c.revenue.toFixed(2),
        'ROI (%)': c.roi.toFixed(2),
        'ROAS': c.roas.toFixed(2),
      }));
      const ws2 = XLSX.utils.json_to_sheet(roiExport);
      XLSX.utils.book_append_sheet(wb, ws2, 'ROI por Campanha');
    }

    const fileName = `relatorio-meta-ads-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/reports')}
            className="rounded-xl"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600/10 rounded-lg">
                <Facebook className="h-6 w-6 text-blue-600" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">Meta Ads - Cruzamento de Dados</h1>
            </div>
            <p className="text-muted-foreground">
              Análise completa de leads por anúncio: segmento, status, atribuição, resposta e conversões
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Picker */}
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal px-4 py-2.5 h-auto rounded-xl border-border",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon size={18} className="mr-2 text-muted-foreground" />
                <span className="text-sm">{formatDateRange(dateRange)}</span>
                <ChevronDown size={16} className="ml-2 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
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
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={ptBR}
                    className="pointer-events-auto"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Export Button */}
          <Button
            onClick={handleExportExcel}
            className="btn-gradient text-white rounded-xl font-medium"
            disabled={!crossData?.rows?.length}
          >
            <Download size={18} className="mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Dashboard Grid */}
      <DashboardGrid
        storageKey="campaign-report-v2-card-order"
        cards={[
          // Métricas principais
          {
            id: 'metric-cards',
            fullWidth: true,
            component: (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <StatCard
                  title="Total de Leads"
                  value={summary?.totalLeads.toLocaleString('pt-BR') || '0'}
                  subtitle="No período"
                  icon={Users}
                  gradient="from-blue-500 to-blue-600"
                  isLoading={loadingCrossData}
                />
                <StatCard
                  title="Leads Este Mês"
                  value={summary?.totalLeadsThisMonth.toLocaleString('pt-BR') || '0'}
                  subtitle="Mês atual"
                  icon={UserPlus}
                  gradient="from-purple-500 to-pink-500"
                  isLoading={loadingCrossData}
                />
                <StatCard
                  title="Leads Hoje"
                  value={summary?.totalLeadsToday.toLocaleString('pt-BR') || '0'}
                  subtitle="Últimas 24h"
                  icon={TrendingUp}
                  gradient="from-green-500 to-emerald-500"
                  isLoading={loadingCrossData}
                />
                <StatCard
                  title="Conversões"
                  value={summary?.totalConversions.toLocaleString('pt-BR') || '0'}
                  subtitle={`${(summary?.overallConversionRate || 0).toFixed(1)}% taxa`}
                  icon={Target}
                  gradient="from-orange-500 to-red-500"
                  isLoading={loadingCrossData}
                />
                <StatCard
                  title="Receita Total"
                  value={formatCurrency(summary?.totalRevenue || 0)}
                  subtitle="Pedidos fechados"
                  icon={DollarSign}
                  gradient="from-emerald-500 to-teal-500"
                  isLoading={loadingCrossData}
                />
                <StatCard
                  title="Gastos Meta"
                  value={formatCurrency(roiSummary?.totalSpend || 0)}
                  subtitle={`CPL: ${formatCurrency(roiSummary?.averageCPL || 0)}`}
                  icon={Wallet}
                  gradient="from-red-500 to-pink-500"
                  isLoading={loadingROI}
                />
              </div>
            ),
          },
          // ROI Summary Cards
          {
            id: 'roi-summary',
            fullWidth: true,
            component: (
              <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
                <div className="flex items-center gap-2 mb-4">
                  <PiggyBank className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Resumo Financeiro</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center p-4 bg-muted/30 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-1">ROI Geral</p>
                    <p className={`text-2xl font-bold ${(roiSummary?.overallROI || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {loadingROI ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : `${(roiSummary?.overallROI || 0).toFixed(1)}%`}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-1">ROAS</p>
                    <p className={`text-2xl font-bold ${(roiSummary?.overallROAS || 0) >= 1 ? 'text-green-600' : 'text-orange-600'}`}>
                      {loadingROI ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : `${(roiSummary?.overallROAS || 0).toFixed(2)}x`}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-1">CAC Médio</p>
                    <p className="text-2xl font-bold text-foreground">
                      {loadingROI ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : formatCurrency(roiSummary?.averageCAC || 0)}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted/30 rounded-xl">
                    <p className="text-sm text-muted-foreground mb-1">Responderam</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {loadingCrossData ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : `${summary?.totalResponded || 0}`}
                      <span className="text-sm text-muted-foreground ml-1">
                        ({summary?.totalLeads ? ((summary.totalResponded / summary.totalLeads) * 100).toFixed(0) : 0}%)
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            ),
          },
          // Cross Data Table
          {
            id: 'cross-data-table',
            fullWidth: true,
            component: (
              <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
                <div className="flex items-center gap-2 mb-6">
                  <Table2 className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Cruzamento por Anúncio</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Visão completa: leads, segmento, status, atribuição a vendedor, resposta do cliente e conversões por anúncio
                </p>
                <CrossDataTable 
                  data={crossData?.rows || []}
                  statuses={statuses}
                  segments={segments}
                  isLoading={loadingCrossData}
                />
              </div>
            ),
          },
          // ROI Table
          {
            id: 'roi-table',
            fullWidth: true,
            component: (
              <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
                <div className="flex items-center gap-2 mb-6">
                  <PieChart className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">ROI por Campanha</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Gastos vs Receita: CPL, CAC, ROI e ROAS por campanha
                </p>
                <ROITable 
                  data={roiData?.campaigns || []}
                  isLoading={loadingROI}
                />
              </div>
            ),
          },
          // Daily Leads Chart
          {
            id: 'daily-leads-chart',
            fullWidth: true,
            component: (
              <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
                <div className="flex items-center gap-2 mb-6">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">Leads por Dia</h3>
                </div>
                <div className="h-[250px]">
                  {loadingDaily ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : dailyLeads.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Facebook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhum lead de Meta Ads no período</p>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyLeads} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1877F2" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#1877F2" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="date"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="leads"
                          stroke="#1877F2"
                          strokeWidth={3}
                          fill="url(#colorLeads)"
                          name="Leads"
                          dot={{ fill: '#1877F2', strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            ),
          },
        ] as DashboardCardConfig[]}
      />
    </div>
  );
}
