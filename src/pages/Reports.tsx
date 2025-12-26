import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calendar as CalendarIcon,
  ChevronDown,
  Download,
  FileText,
  Clock,
  MessageSquare,
  DollarSign,
  Smile,
  Users,
  CheckCircle,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Target,
  ShoppingBag,
  Trophy,
  ShoppingCart,
  Package,
  Headphones,
  Truck,
  Receipt,
  GitCompare,
  Facebook,
  ExternalLink,
  ArrowLeftRight,
  Phone,
  Lock,
  Wallet,
  Info,
} from 'lucide-react';
import { TransferHistoryPanel } from '@/components/reports/TransferHistoryPanel';
import { CallHistoryPanel } from '@/components/reports/CallHistoryPanel';
import { SLAConfigCard } from '@/components/reports/SLAConfigCard';
import { SatisfactionPanel } from '@/components/reports/SatisfactionPanel';
import { VolumeHeatmap } from '@/components/reports/VolumeHeatmap';
import { SalesFunnelChart } from '@/components/reports/SalesFunnelChart';
import { SalesOriginChart } from '@/components/reports/SalesOriginChart';
import { SalesFiltersPanel } from '@/components/reports/SalesFiltersPanel';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DashboardGrid, DashboardCardConfig } from '@/components/dashboard/DashboardGrid';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ComposedChart,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DateRange } from 'react-day-picker';
import {
  useReportSLA,
  useReportAttendance,
  useReportSales,
  useReportPerformance,
  useReportCloseReasons,
} from '@/hooks/useReports';
import {
  exportSLAReport,
  exportAttendanceReport,
  exportSalesReport,
  exportPerformanceReport,
} from '@/hooks/useReportExport';
import { useReportsTabs } from '@/hooks/useReportsTabs';

const COLORS = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#6B7280'];

// Tab metadata with icons and permissions (keyed by tab value)
// Note: 'financial' removed - disabled in database
const TAB_METADATA: Record<string, { icon: typeof Clock; permission: string }> = {
  'sla': { icon: Clock, permission: 'view_sla' },
  'attendance': { icon: MessageSquare, permission: 'view_attendance' },
  'sales': { icon: DollarSign, permission: 'view_sales' },
  'satisfaction': { icon: Smile, permission: 'view_satisfaction' },
  'performance': { icon: Users, permission: 'view_performance' },
  'transfers': { icon: ArrowLeftRight, permission: 'view_transfers' },
  'calls': { icon: Phone, permission: 'view_calls' },
};

// Date presets
const datePresets = [
  { label: 'Hoje', getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Últimos 7 dias', getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: 'Últimos 30 dias', getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: 'Este mês', getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: 'Mês passado', getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
];

export default function Reports() {
  const navigate = useNavigate();
  const { hasPermission, isAdmin, isLoading: permissionsLoading, profile } = usePermissions();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const canViewAllReports = isAdmin || hasPermission('reports', 'view_all');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [salesFilters, setSalesFilters] = useState<{ sellerId?: string; origin?: string }>({});
  
  // Load persisted date range from localStorage
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const saved = localStorage.getItem('reports-date-range');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { from: new Date(parsed.from), to: new Date(parsed.to) };
      } catch { /* ignore */ }
    }
    return { from: subDays(new Date(), 6), to: new Date() };
  });
  
  const [compareDateRange, setCompareDateRange] = useState<DateRange | undefined>(undefined);
  const [showComparison, setShowComparison] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  // Persist date range to localStorage
  useEffect(() => {
    if (dateRange?.from && dateRange?.to) {
      localStorage.setItem('reports-date-range', JSON.stringify({
        from: dateRange.from.toISOString(),
        to: dateRange.to.toISOString(),
      }));
    }
  }, [dateRange]);
  const [isComparePickerOpen, setIsComparePickerOpen] = useState(false);

  // Real data hooks
  const { data: slaData, isLoading: slaLoading } = useReportSLA(dateRange as { from: Date; to: Date } | undefined);
  const { data: attendanceData, isLoading: attendanceLoading } = useReportAttendance(dateRange as { from: Date; to: Date } | undefined);
  const { data: salesData, isLoading: salesLoading } = useReportSales(
    dateRange as { from: Date; to: Date } | undefined,
    profile?.id,
    canViewAllReports,
    salesFilters
  );
  const { data: performanceData, isLoading: performanceLoading } = useReportPerformance(
    dateRange as { from: Date; to: Date } | undefined,
    selectedAgentId || undefined
  );
  const { data: closeReasonsData, isLoading: closeReasonsLoading } = useReportCloseReasons(dateRange as { from: Date; to: Date } | undefined);

  // Fetch menu tabs from database
  const { data: menuTabs = [], isLoading: loadingMenuTabs } = useReportsTabs();

  // Build available tabs from database menu items + permissions
  const availableTabs = useMemo(() => {
    if (loadingMenuTabs) return [];
    
    return menuTabs
      .map(item => {
        const tabValue = item.href?.replace('/reports?tab=', '') || '';
        const metadata = TAB_METADATA[tabValue];
        
        if (!metadata) return null;
        
        // Check permissions
        if (!isAdmin && !hasPermission('reports', metadata.permission)) {
          return null;
        }
        
        return {
          value: tabValue,
          label: item.title,
          icon: metadata.icon,
          permission: `reports.${metadata.permission}`,
        };
      })
      .filter((tab): tab is NonNullable<typeof tab> => tab !== null);
  }, [loadingMenuTabs, menuTabs, isAdmin, hasPermission]);

  const canExport = isAdmin || hasPermission('reports', 'export');
  
  // Define a aba ativa baseada na URL ou primeira disponível
  const defaultTab = useMemo(() => {
    if (tabFromUrl && availableTabs.some(tab => tab.value === tabFromUrl)) {
      return tabFromUrl;
    }
    return availableTabs.length > 0 ? availableTabs[0].value : 'sla';
  }, [tabFromUrl, availableTabs]);

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return 'Selecionar período';
    if (!range.to) return format(range.from, 'dd/MM/yyyy', { locale: ptBR });
    return `${format(range.from, 'dd/MM/yyyy', { locale: ptBR })} - ${format(range.to, 'dd/MM/yyyy', { locale: ptBR })}`;
  };

  const handlePresetClick = (preset: typeof datePresets[0]) => {
    setDateRange(preset.getValue());
    setIsDatePickerOpen(false);
  };

  const toggleComparison = () => {
    setShowComparison(!showComparison);
    if (!showComparison) {
      if (dateRange?.from && dateRange?.to) {
        const daysDiff = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        setCompareDateRange({
          from: subDays(dateRange.from, daysDiff + 1),
          to: subDays(dateRange.from, 1),
        });
      }
    } else {
      setCompareDateRange(undefined);
    }
  };

  // SLA pie data for chart
  const slaPieData = slaData ? [
    { name: 'Bom', value: slaData.metrics.total_bom, fill: '#10B981' },
    { name: 'Regular', value: slaData.metrics.total_regular, fill: '#F59E0B' },
    { name: 'Crítico', value: slaData.metrics.total_critico, fill: '#EF4444' },
  ] : [];

  const totalSla = (slaData?.metrics.total_bom || 0) + (slaData?.metrics.total_regular || 0) + (slaData?.metrics.total_critico || 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Relatórios</h1>
          <p className="text-muted-foreground">
            Análise completa do desempenho da sua equipe
          </p>
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

          {/* Compare Period Button */}
          <Button
            variant={showComparison ? "default" : "outline"}
            onClick={toggleComparison}
            className={cn(
              "px-4 py-2.5 h-auto rounded-xl",
              showComparison && "bg-primary text-primary-foreground"
            )}
          >
            <GitCompare size={18} className="mr-2" />
            <span className="text-sm font-medium">Comparar</span>
          </Button>

          {showComparison && (
            <Popover open={isComparePickerOpen} onOpenChange={setIsComparePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="justify-start text-left font-normal px-4 py-2.5 h-auto rounded-xl border-dashed border-primary/50"
                >
                  <CalendarIcon size={18} className="mr-2 text-primary" />
                  <span className="text-sm text-primary">{formatDateRange(compareDateRange)}</span>
                  <ChevronDown size={16} className="ml-2 text-primary" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="end">
                <Calendar
                  mode="range"
                  selected={compareDateRange}
                  onSelect={setCompareDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}

          {/* Export Button */}
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-4 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all">
                  <Download size={18} />
                  Exportar
                  <ChevronDown size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  className="flex items-center gap-2"
                  onClick={() => {
                    const dr = dateRange as { from: Date; to: Date } | undefined;
                    if (slaData) exportSLAReport('pdf', dr, slaData);
                    else if (attendanceData) exportAttendanceReport('pdf', dr, attendanceData);
                    else if (salesData) exportSalesReport('pdf', dr, salesData);
                    else if (performanceData) exportPerformanceReport('pdf', dr, performanceData);
                  }}
                >
                  <FileText size={16} />
                  Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2"
                  onClick={() => {
                    const dr = dateRange as { from: Date; to: Date } | undefined;
                    if (slaData) exportSLAReport('excel', dr, slaData);
                    else if (attendanceData) exportAttendanceReport('excel', dr, attendanceData);
                    else if (salesData) exportSalesReport('excel', dr, salesData);
                    else if (performanceData) exportPerformanceReport('excel', dr, performanceData);
                  }}
                >
                  <FileText size={16} />
                  Exportar Excel
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="flex items-center gap-2"
                  onClick={() => {
                    const dr = dateRange as { from: Date; to: Date } | undefined;
                    if (slaData) exportSLAReport('csv', dr, slaData);
                    else if (attendanceData) exportAttendanceReport('csv', dr, attendanceData);
                    else if (salesData) exportSalesReport('csv', dr, salesData);
                    else if (performanceData) exportPerformanceReport('csv', dr, performanceData);
                  }}
                >
                  <FileText size={16} />
                  Exportar CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>


      {/* Tabs */}
      {availableTabs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 bg-muted rounded-full mb-4">
            <Lock size={32} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">Sem permissão</h3>
          <p className="text-muted-foreground max-w-md">
            Você não tem permissão para visualizar nenhum relatório.
          </p>
        </div>
      ) : (
        <Tabs key={defaultTab} defaultValue={defaultTab} className="w-full">
          <TabsList className="bg-card border border-border rounded-xl p-1 shadow-sm w-full flex mb-6">
            {availableTabs.map((tab) => {
              const IconComponent = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex-1 flex items-center justify-center gap-2 py-3 data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-white rounded-lg"
                >
                  <IconComponent size={18} />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* TAB 1: SLA Report */}
          <TabsContent value="sla">
            {/* SLA Configuration Panel */}
            <div className="mb-6">
              <SLAConfigCard />
            </div>
            
            <DashboardGrid
              storageKey="reports-sla-card-order"
              cards={[
                {
                  id: 'sla-metrics',
                  fullWidth: true,
                  component: slaLoading ? (
                    <div className="grid grid-cols-4 gap-6">
                      {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} className="h-32 rounded-2xl" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-6 gap-4">
                      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-muted-foreground font-medium">SLA Bom</span>
                          <div className="p-1.5 bg-status-success/10 rounded-lg">
                            <CheckCircle size={16} className="text-status-success" />
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-status-success">
                          {slaData?.metrics.total_bom.toLocaleString() || 0}
                        </div>
                      </div>

                      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-muted-foreground font-medium">SLA Regular</span>
                          <div className="p-1.5 bg-status-warning/10 rounded-lg">
                            <AlertTriangle size={16} className="text-status-warning" />
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-status-warning">
                          {slaData?.metrics.total_regular.toLocaleString() || 0}
                        </div>
                      </div>

                      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-muted-foreground font-medium">SLA Crítico</span>
                          <div className="p-1.5 bg-status-error/10 rounded-lg">
                            <XCircle size={16} className="text-status-error" />
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-status-error">
                          {slaData?.metrics.total_critico.toLocaleString() || 0}
                        </div>
                      </div>

                      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-muted-foreground font-medium">TMA Geral</span>
                          <div className="p-1.5 bg-primary/10 rounded-lg">
                            <Clock size={16} className="text-primary" />
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                          {slaData?.metrics.avg_tma_minutes || 0}<span className="text-sm font-normal text-muted-foreground ml-1">min</span>
                        </div>
                      </div>

                      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-muted-foreground font-medium">FCR</span>
                          <div className="p-1.5 bg-status-info/10 rounded-lg">
                            <Target size={16} className="text-status-info" />
                          </div>
                        </div>
                        <div className="text-2xl font-bold text-status-info">
                          {slaData?.metrics.fcr_percent || 0}%
                        </div>
                        <div className="text-xs text-muted-foreground">1º Contato</div>
                      </div>

                      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-muted-foreground font-medium">Tendência</span>
                          <div className={`p-1.5 rounded-lg ${slaData?.metrics.trend_direction === 'up' ? 'bg-status-success/10' : slaData?.metrics.trend_direction === 'down' ? 'bg-status-error/10' : 'bg-muted'}`}>
                            <TrendingUp size={16} className={slaData?.metrics.trend_direction === 'up' ? 'text-status-success' : slaData?.metrics.trend_direction === 'down' ? 'text-status-error rotate-180' : 'text-muted-foreground'} />
                          </div>
                        </div>
                        <div className={`text-2xl font-bold ${slaData?.metrics.trend_direction === 'up' ? 'text-status-success' : slaData?.metrics.trend_direction === 'down' ? 'text-status-error' : 'text-foreground'}`}>
                          {slaData?.metrics.trend_direction === 'up' ? '+' : slaData?.metrics.trend_direction === 'down' ? '-' : ''}{slaData?.metrics.trend_percent || 0}%
                        </div>
                        <div className="text-xs text-muted-foreground">vs período anterior</div>
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'tma-department',
                  component: (
                    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm h-full">
                      <h3 className="text-lg font-semibold text-foreground mb-6">TMA por Departamento</h3>
                      {slaLoading ? (
                        <div className="space-y-4">
                          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12" />)}
                        </div>
                      ) : (slaData?.departments?.length || 0) > 0 ? (
                        <div className="space-y-4">
                          {slaData?.departments.map((dept, idx) => (
                            <div key={dept.name}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-foreground">{dept.name}</span>
                                <span className="text-sm font-bold text-foreground">{dept.value} min</span>
                              </div>
                              <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${dept.percentage}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                          <Info size={32} className="mb-2" />
                          <p className="text-sm">Sem dados no período</p>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'sla-distribution',
                  component: (
                    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm h-full">
                      <h3 className="text-lg font-semibold text-foreground mb-6">Distribuição de SLA</h3>
                      {slaLoading ? (
                        <Skeleton className="h-64" />
                      ) : totalSla > 0 ? (
                        <>
                          <div className="flex items-center justify-center">
                            <ResponsiveContainer width={250} height={250}>
                              <PieChart>
                                <Pie
                                  data={slaPieData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={100}
                                  paddingAngle={2}
                                  dataKey="value"
                                >
                                  {slaPieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex justify-center gap-6 mt-4">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-status-success rounded-full"></div>
                              <span className="text-sm text-muted-foreground">
                                Bom ({totalSla > 0 ? ((slaData?.metrics.total_bom || 0) / totalSla * 100).toFixed(1) : 0}%)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-status-warning rounded-full"></div>
                              <span className="text-sm text-muted-foreground">
                                Regular ({totalSla > 0 ? ((slaData?.metrics.total_regular || 0) / totalSla * 100).toFixed(1) : 0}%)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-status-error rounded-full"></div>
                              <span className="text-sm text-muted-foreground">
                                Crítico ({totalSla > 0 ? ((slaData?.metrics.total_critico || 0) / totalSla * 100).toFixed(1) : 0}%)
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                          <Info size={32} className="mb-2" />
                          <p className="text-sm">Sem dados no período</p>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'sla-timeline',
                  fullWidth: true,
                  component: (
                    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-foreground mb-6">Evolução do SLA</h3>
                      {slaLoading ? (
                        <Skeleton className="h-72" />
                      ) : (slaData?.timeline?.length || 0) > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <AreaChart data={slaData?.timeline}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <Tooltip />
                            <Legend />
                            <Area type="monotone" dataKey="critico" stackId="1" stroke="#EF4444" fill="#FEE2E2" name="Crítico" />
                            <Area type="monotone" dataKey="regular" stackId="1" stroke="#F59E0B" fill="#FEF3C7" name="Regular" />
                            <Area type="monotone" dataKey="bom" stackId="1" stroke="#10B981" fill="#D1FAE5" name="Bom" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-72 text-muted-foreground">
                          <Info size={32} className="mb-2" />
                          <p className="text-sm">Sem dados no período</p>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'sla-table',
                  fullWidth: true,
                  component: (
                    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-border">
                        <h3 className="text-lg font-semibold text-foreground">Detalhamento por Atendente</h3>
                      </div>
                      {slaLoading ? (
                        <div className="p-6 space-y-4">
                          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
                        </div>
                      ) : (slaData?.agents?.length || 0) > 0 ? (
                        <table className="w-full">
                          <thead>
                            <tr className="bg-muted/50 border-b border-border">
                              <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Atendente</th>
                              <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</th>
                              <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bom</th>
                              <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Regular</th>
                              <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Crítico</th>
                              <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">% SLA Bom</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {slaData?.agents.map((agent) => (
                              <tr key={agent.agent_id} className="hover:bg-muted/30">
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8">
                                      <AvatarImage src={agent.avatar_url || undefined} />
                                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm">
                                        {agent.agent_name.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium text-foreground">{agent.agent_name}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-center text-foreground font-medium">{agent.total}</td>
                                <td className="px-6 py-4 text-center text-status-success font-medium">{agent.bom}</td>
                                <td className="px-6 py-4 text-center text-status-warning font-medium">{agent.regular}</td>
                                <td className="px-6 py-4 text-center text-status-error font-medium">{agent.critico}</td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                    agent.sla_good_percent >= 70 ? 'bg-status-success/10 text-status-success' :
                                    agent.sla_good_percent >= 50 ? 'bg-status-warning/10 text-status-warning' :
                                    'bg-status-error/10 text-status-error'
                                  }`}>
                                    {agent.sla_good_percent}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <Info size={32} className="mb-2" />
                          <p className="text-sm">Sem dados no período</p>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'sla-by-channel',
                  fullWidth: true,
                  component: (
                    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-border">
                        <h3 className="text-lg font-semibold text-foreground">SLA por Canal</h3>
                      </div>
                      {slaLoading ? (
                        <div className="p-6 space-y-4">
                          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                        </div>
                      ) : (slaData?.channels?.length || 0) > 0 ? (
                        <table className="w-full">
                          <thead>
                            <tr className="bg-muted/50 border-b border-border">
                              <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Canal</th>
                              <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Total</th>
                              <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Bom</th>
                              <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Regular</th>
                              <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Crítico</th>
                              <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">% SLA Bom</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {slaData?.channels.map((ch) => (
                              <tr key={ch.channel_id} className="hover:bg-muted/30">
                                <td className="px-6 py-4 font-medium text-foreground">{ch.channel_name}</td>
                                <td className="px-6 py-4 text-center text-foreground font-medium">{ch.total}</td>
                                <td className="px-6 py-4 text-center text-status-success font-medium">{ch.bom}</td>
                                <td className="px-6 py-4 text-center text-status-warning font-medium">{ch.regular}</td>
                                <td className="px-6 py-4 text-center text-status-error font-medium">{ch.critico}</td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                                    ch.sla_good_percent >= 70 ? 'bg-status-success/10 text-status-success' :
                                    ch.sla_good_percent >= 50 ? 'bg-status-warning/10 text-status-warning' :
                                    'bg-status-error/10 text-status-error'
                                  }`}>
                                    {ch.sla_good_percent}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <Info size={32} className="mb-2" />
                          <p className="text-sm">Sem dados no período</p>
                        </div>
                      )}
                    </div>
                  ),
                },
              ] as DashboardCardConfig[]}
            />
          </TabsContent>

          {/* TAB 2: Attendance Report */}
          <TabsContent value="attendance">
            <DashboardGrid
              storageKey="reports-attendance-card-order"
              cards={[
                {
                  id: 'attendance-metrics',
                  fullWidth: true,
                  component: attendanceLoading ? (
                    <div className="grid grid-cols-4 gap-6">
                      {[1, 2, 3, 4].map(i => (
                        <Skeleton key={i} className="h-32 rounded-2xl" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-6 gap-4">
                      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-muted-foreground font-medium">Total</span>
                          <MessageSquare size={16} className="text-primary" />
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                          {attendanceData?.metrics.total.toLocaleString() || 0}
                        </div>
                      </div>
                      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-muted-foreground font-medium">Abertos</span>
                          <MessageSquare size={16} className="text-status-info" />
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                          {attendanceData?.metrics.open.toLocaleString() || 0}
                        </div>
                      </div>
                      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-muted-foreground font-medium">Pendentes</span>
                          <Clock size={16} className="text-status-warning" />
                        </div>
                        <div className="text-2xl font-bold text-status-warning">
                          {attendanceData?.metrics.pending.toLocaleString() || 0}
                        </div>
                      </div>
                      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-muted-foreground font-medium">Finalizados</span>
                          <CheckCircle size={16} className="text-status-success" />
                        </div>
                        <div className="text-2xl font-bold text-status-success">
                          {attendanceData?.metrics.closed.toLocaleString() || 0}
                        </div>
                      </div>
                      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-muted-foreground font-medium">Taxa Reabertura</span>
                          <GitCompare size={16} className="text-status-error" />
                        </div>
                        <div className="text-2xl font-bold text-status-error">
                          {attendanceData?.metrics.reopenRate || 0}%
                        </div>
                      </div>
                      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs text-muted-foreground font-medium">Tempo Resolução</span>
                          <Clock size={16} className="text-primary" />
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                          {attendanceData?.metrics.avgResolutionMinutes ? `${Math.floor(attendanceData.metrics.avgResolutionMinutes / 60)}h${attendanceData.metrics.avgResolutionMinutes % 60}m` : '0h'}
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  id: 'channel-chart',
                  component: (
                    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm h-full">
                      <h3 className="text-lg font-semibold text-foreground mb-6">Atendimentos por Canal</h3>
                      {attendanceLoading ? (
                        <Skeleton className="h-64" />
                      ) : (attendanceData?.byChannel?.length || 0) > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={attendanceData?.byChannel} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis type="category" dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                            <Tooltip />
                            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                          <Info size={32} className="mb-2" />
                          <p className="text-sm">Sem dados no período</p>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'hourly-chart',
                  component: (
                    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm h-full">
                      <h3 className="text-lg font-semibold text-foreground mb-6">Atendimentos por Hora</h3>
                      {attendanceLoading ? (
                        <Skeleton className="h-64" />
                      ) : (attendanceData?.byHour?.length || 0) > 0 ? (
                        <ResponsiveContainer width="100%" height={250}>
                          <AreaChart data={attendanceData?.byHour}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                            <Tooltip />
                            <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.2)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                          <Info size={32} className="mb-2" />
                          <p className="text-sm">Sem dados no período</p>
                        </div>
                      )}
                    </div>
                  ),
                },
                {
                  id: 'volume-heatmap',
                  fullWidth: true,
                  component: (
                    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                      <h3 className="text-lg font-semibold text-foreground mb-6">Heatmap de Volume</h3>
                      {attendanceLoading ? (
                        <Skeleton className="h-64" />
                      ) : (attendanceData?.heatmapData?.length || 0) > 0 ? (
                        <VolumeHeatmap data={attendanceData?.heatmapData || []} />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                          <Info size={32} className="mb-2" />
                          <p className="text-sm">Sem dados no período</p>
                        </div>
                      )}
                    </div>
                  ),
                },
              ] as DashboardCardConfig[]}
            />
          </TabsContent>

          {/* TAB 3: Sales Report */}
          <TabsContent value="sales" className="space-y-6">
            {/* Filters Panel */}
            <SalesFiltersPanel
              filters={salesFilters}
              onFiltersChange={setSalesFilters}
              availableSellers={salesData?.availableSellers || []}
              availableOrigins={salesData?.availableOrigins || []}
            />

            {/* Sales Metric Cards */}
            {salesLoading ? (
              <div className="grid grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-32 rounded-2xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                <div className="bg-gradient-to-br from-primary to-accent rounded-2xl p-5 shadow-lg text-white col-span-2">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/80 text-sm font-medium">Faturamento</span>
                    <DollarSign size={18} className="text-white/80" />
                  </div>
                  <div className="text-2xl font-bold">
                    R$ {((salesData?.totalRevenue || 0) / 1000).toFixed(1)}K
                  </div>
                  {salesData?.revenueGrowthDirection !== 'neutral' && (
                    <div className={`text-xs mt-1 flex items-center gap-1 ${salesData?.revenueGrowthDirection === 'up' ? 'text-green-200' : 'text-red-200'}`}>
                      <TrendingUp size={12} className={salesData?.revenueGrowthDirection === 'down' ? 'rotate-180' : ''} />
                      {salesData?.revenueGrowth}% vs período anterior
                    </div>
                  )}
                </div>

                <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground font-medium">Conversões</span>
                    <Target size={16} className="text-status-success" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {salesData?.totalConversions || 0}
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground font-medium">Ticket Médio</span>
                    <Receipt size={16} className="text-status-info" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    R$ {(salesData?.avgTicket || 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground font-medium">Taxa Conversão</span>
                    <TrendingUp size={16} className="text-status-success" />
                  </div>
                  <div className="text-2xl font-bold text-status-success">
                    {salesData?.conversionRate || 0}%
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground font-medium">Ciclo Médio</span>
                    <Clock size={16} className="text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {salesData?.avgCycleDays || 0}<span className="text-sm font-normal text-muted-foreground ml-1">dias</span>
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground font-medium">Maior Venda</span>
                    <Trophy size={16} className="text-yellow-500" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    R$ {(salesData?.highestSale || 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-muted-foreground font-medium">Total Leads</span>
                    <Users size={16} className="text-primary" />
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {salesData?.totalLeads || 0}
                  </div>
                </div>
              </div>
            )}

            {/* Sales Timeline & Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales Timeline */}
              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground mb-6">Evolução de Vendas</h3>
                {salesLoading ? (
                  <Skeleton className="h-64" />
                ) : (salesData?.timeline?.length || 0) > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={salesData?.timeline}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="vendas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Vendas (R$)" />
                      <Line yAxisId="right" type="monotone" dataKey="quantidade" stroke="#10B981" strokeWidth={2} name="Quantidade" />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Info size={32} className="mb-2" />
                    <p className="text-sm">Sem dados no período</p>
                  </div>
                )}
              </div>

              {/* Sales by Origin */}
              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground mb-6">Vendas por Origem</h3>
                {salesLoading ? (
                  <Skeleton className="h-64" />
                ) : (salesData?.byOrigin?.length || 0) > 0 ? (
                  <SalesOriginChart data={salesData?.byOrigin || []} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <Info size={32} className="mb-2" />
                    <p className="text-sm">Sem dados no período</p>
                  </div>
                )}
              </div>
            </div>

            {/* Sales Funnel */}
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-foreground mb-6">Funil de Vendas</h3>
              {salesLoading ? (
                <Skeleton className="h-64" />
              ) : (salesData?.funnel?.length || 0) > 0 ? (
                <SalesFunnelChart data={salesData?.funnel || []} />
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Info size={32} className="mb-2" />
                  <p className="text-sm">Sem dados no período</p>
                </div>
              )}
            </div>

            {/* Top Sellers Table with Trophies */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Ranking de Vendedores</h3>
              </div>
              {salesLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : (salesData?.sellers?.length || 0) > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">#</th>
                      <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Vendedor</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Pedidos</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Faturamento</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Ticket Médio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {salesData?.sellers.map((seller) => (
                      <tr key={seller.agent_id} className="hover:bg-muted/30">
                        <td className="px-6 py-4">
                          {seller.rank === 1 ? (
                            <div className="flex items-center justify-center w-10 h-10">
                              <Trophy size={28} className="text-yellow-500 fill-yellow-500" />
                            </div>
                          ) : seller.rank === 2 ? (
                            <div className="flex items-center justify-center w-10 h-10">
                              <Trophy size={24} className="text-gray-400 fill-gray-400" />
                            </div>
                          ) : seller.rank === 3 ? (
                            <div className="flex items-center justify-center w-10 h-10">
                              <Trophy size={22} className="text-orange-600 fill-orange-600" />
                            </div>
                          ) : (
                            <span className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-muted text-muted-foreground">
                              {seller.rank}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={seller.avatar_url || undefined} />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                                {seller.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground">{seller.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-foreground">{seller.orders_count}</td>
                        <td className="px-6 py-4 text-center font-medium text-status-success">
                          R$ {seller.revenue.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center text-foreground">
                          R$ {seller.avg_ticket.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Info size={32} className="mb-2" />
                  <p className="text-sm">Sem dados no período</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 5: Satisfaction Report - NPS/CSAT Dashboard */}
          <TabsContent value="satisfaction" className="space-y-6">
            <SatisfactionPanel dateRange={dateRange as { from: Date; to: Date } | undefined} />
          </TabsContent>

          {/* TAB 6: Individual Performance */}
          <TabsContent value="performance" className="space-y-6">
            {/* Agent Selector */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm text-muted-foreground font-medium">Selecionar atendente:</span>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedAgentId(null)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    !selectedAgentId
                      ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg'
                      : 'bg-card border border-border text-foreground hover:bg-muted'
                  }`}
                >
                  Todos
                </button>
                {performanceData?.agents.slice(0, 10).map((agent) => (
                  <button
                    key={agent.agent_id}
                    onClick={() => setSelectedAgentId(agent.agent_id)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                      agent.agent_id === selectedAgentId
                        ? 'bg-gradient-to-r from-primary to-accent text-white shadow-lg'
                        : 'bg-card border border-border text-foreground hover:bg-muted'
                    }`}
                  >
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={agent.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">{agent.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {agent.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Stats Cards */}
            {performanceLoading ? (
              <div className="grid grid-cols-6 gap-4">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-28 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-4">
                {/* Score Unificado - Destacado */}
                <div className="bg-gradient-to-br from-primary to-accent rounded-xl p-4 shadow-lg text-white">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/80 text-xs font-medium">Score Geral</span>
                    <Trophy size={18} className="text-white/80" />
                  </div>
                  <div className="text-2xl font-bold">
                    {selectedAgentId ? performanceData?.selectedAgent?.unified_score || 0 : performanceData?.average.score || 0}
                  </div>
                  <div className="text-xs text-white/70">de 100 pontos</div>
                </div>

                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center mb-2">
                    <MessageSquare size={16} className="text-primary" />
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {selectedAgentId ? performanceData?.selectedAgent?.total_conversations || 0 : performanceData?.average.conversations || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Atendimentos</div>
                </div>

                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <div className="w-8 h-8 bg-status-success/10 rounded-lg flex items-center justify-center mb-2">
                    <ShoppingBag size={16} className="text-status-success" />
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {selectedAgentId ? performanceData?.selectedAgent?.total_sales || 0 : performanceData?.average.sales || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Vendas</div>
                </div>

                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <div className="w-8 h-8 bg-status-info/10 rounded-lg flex items-center justify-center mb-2">
                    <DollarSign size={16} className="text-status-info" />
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    R$ {((selectedAgentId ? performanceData?.selectedAgent?.revenue || 0 : performanceData?.average.revenue || 0) / 1000).toFixed(1)}K
                  </div>
                  <div className="text-xs text-muted-foreground">Faturamento</div>
                </div>

                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center mb-2">
                    <CheckCircle size={16} className="text-emerald-600" />
                  </div>
                  <div className="text-xl font-bold text-foreground">
                    {selectedAgentId ? performanceData?.selectedAgent?.sla_good_percent || 0 : performanceData?.average.sla || 0}%
                  </div>
                  <div className="text-xs text-muted-foreground">SLA Bom</div>
                </div>

                <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center mb-2">
                    <TrendingUp size={16} className="text-amber-600" />
                  </div>
                  <div className={`text-xl font-bold ${
                    (selectedAgentId ? performanceData?.selectedAgent?.unified_score || 0 : performanceData?.average.score || 0) >= 70 ? 'text-status-success' :
                    (selectedAgentId ? performanceData?.selectedAgent?.unified_score || 0 : performanceData?.average.score || 0) >= 40 ? 'text-status-warning' : 'text-status-error'
                  }`}>
                    {(selectedAgentId ? performanceData?.selectedAgent?.unified_score || 0 : performanceData?.average.score || 0) >= 70 ? 'Excelente' :
                     (selectedAgentId ? performanceData?.selectedAgent?.unified_score || 0 : performanceData?.average.score || 0) >= 40 ? 'Regular' : 'Crítico'}
                  </div>
                  <div className="text-xs text-muted-foreground">Classificação</div>
                </div>
              </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-2 gap-6">
              {/* Radar Chart */}
              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground mb-6">Comparativo de Performance</h3>
                {performanceLoading ? (
                  <Skeleton className="h-72" />
                ) : performanceData?.selectedAgent ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={[
                      { metric: 'Atendimentos', valor: Math.min(100, (performanceData.selectedAgent.total_conversations / Math.max(performanceData.average.conversations, 1)) * 70), media: 70 },
                      { metric: 'Vendas', valor: Math.min(100, (performanceData.selectedAgent.total_sales / Math.max(performanceData.average.sales, 1)) * 70), media: 70 },
                      { metric: 'SLA', valor: performanceData.selectedAgent.sla_good_percent, media: performanceData.average.sla },
                      { metric: 'Faturamento', valor: Math.min(100, (performanceData.selectedAgent.revenue / Math.max(performanceData.average.revenue, 1)) * 70), media: 70 },
                    ]}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                      <Radar name={performanceData.selectedAgent.name} dataKey="valor" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={2} />
                      <Radar name="Média" dataKey="media" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground))" fillOpacity={0.1} strokeWidth={2} strokeDasharray="5 5" />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-72 text-muted-foreground">
                    <Info size={32} className="mb-2" />
                    <p className="text-sm">Selecione um atendente para ver o comparativo</p>
                  </div>
                )}
              </div>

              {/* Weekly Performance */}
              <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-foreground mb-6">Evolução Semanal</h3>
                {performanceLoading ? (
                  <Skeleton className="h-72" />
                ) : (performanceData?.weeklyData?.length || 0) > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={performanceData?.weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="atendimentos" stroke="hsl(var(--primary))" strokeWidth={2} name="Atendimentos" />
                      <Line yAxisId="right" type="monotone" dataKey="sla" stroke="#10B981" strokeWidth={2} name="SLA %" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-72 text-muted-foreground">
                    <Info size={32} className="mb-2" />
                    <p className="text-sm">Sem dados no período</p>
                  </div>
                )}
              </div>
            </div>

            {/* Performance Table */}
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border">
                <h3 className="text-lg font-semibold text-foreground">Ranking Geral de Performance</h3>
              </div>
              {performanceLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : (performanceData?.agents?.length || 0) > 0 ? (
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Atendente</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Score</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Atendimentos</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Vendas</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">Faturamento</th>
                      <th className="text-center px-6 py-4 text-xs font-semibold text-muted-foreground uppercase">SLA Bom</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {performanceData?.agents.map((agent, index) => (
                      <tr 
                        key={agent.agent_id} 
                        className={`hover:bg-muted/30 cursor-pointer ${selectedAgentId === agent.agent_id ? 'bg-primary/5' : ''}`}
                        onClick={() => setSelectedAgentId(agent.agent_id)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {index < 3 && (
                              <Trophy size={18} className={index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : 'text-orange-600'} />
                            )}
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={agent.avatar_url || undefined} />
                              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-sm">
                                {agent.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium text-foreground">{agent.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${
                            agent.unified_score >= 70 ? 'bg-status-success/10 text-status-success' :
                            agent.unified_score >= 40 ? 'bg-status-warning/10 text-status-warning' :
                            'bg-status-error/10 text-status-error'
                          }`}>
                            {agent.unified_score}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-foreground">{agent.total_conversations}</td>
                        <td className="px-6 py-4 text-center font-medium text-foreground">{agent.total_sales}</td>
                        <td className="px-6 py-4 text-center font-medium text-status-success">
                          R$ {agent.revenue.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            agent.sla_good_percent >= 70 ? 'bg-status-success/10 text-status-success' :
                            agent.sla_good_percent >= 50 ? 'bg-status-warning/10 text-status-warning' :
                            'bg-status-error/10 text-status-error'
                          }`}>
                            {agent.sla_good_percent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Info size={32} className="mb-2" />
                  <p className="text-sm">Sem dados no período</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 7: Transfers */}
          <TabsContent value="transfers">
            <TransferHistoryPanel />
          </TabsContent>

          {/* TAB 8: Calls */}
          <TabsContent value="calls">
            <CallHistoryPanel />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
