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
  Trophy,
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
import {
  useCampaignMetrics,
  useDailyLeads,
} from '@/hooks/useCampaignMetrics';
import {
  useMetaLeadsFunnel,
  useAdsBreakdown,
  useChampionCreative,
  useTopCreatives,
} from '@/hooks/useMetaAdsAnalytics';
import { useLeadStatuses } from '@/hooks/useLeadStatuses';
import { MetaFunnelChart } from '@/components/campaigns/MetaFunnelChart';
import { CreativeCard } from '@/components/campaigns/CreativeCard';
import { AdsBreakdownTable } from '@/components/campaigns/AdsBreakdownTable';
import { StatusLeadsModal } from '@/components/campaigns/StatusLeadsModal';

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
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Data hooks
  const { data: metrics, isLoading: loadingMetrics } = useCampaignMetrics();
  const { data: dailyLeads = [], isLoading: loadingDaily } = useDailyLeads({
    from: dateRange?.from || subDays(new Date(), 29),
    to: dateRange?.to || new Date(),
  });
  const { data: statuses = [] } = useLeadStatuses();
  
  const activeDateRange = dateRange?.from && dateRange?.to 
    ? { from: dateRange.from, to: dateRange.to }
    : undefined;

  const { data: funnelData = [], isLoading: loadingFunnel } = useMetaLeadsFunnel(activeDateRange);
  const { data: adsBreakdown = [], isLoading: loadingAds } = useAdsBreakdown(activeDateRange);
  const { data: champion, isLoading: loadingChampion } = useChampionCreative(activeDateRange);
  const { data: topCreatives = [], isLoading: loadingTopCreatives } = useTopCreatives(activeDateRange, 6);

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return 'Selecionar período';
    if (!range.to) return format(range.from, 'dd/MM/yyyy', { locale: ptBR });
    return `${format(range.from, 'dd/MM/yyyy', { locale: ptBR })} - ${format(range.to, 'dd/MM/yyyy', { locale: ptBR })}`;
  };

  const handlePresetClick = (preset: typeof datePresets[0]) => {
    setDateRange(preset.getValue());
    setIsDatePickerOpen(false);
  };

  const handleStatusClick = (statusName: string) => {
    setSelectedStatus(statusName);
    setIsStatusModalOpen(true);
  };

  const selectedStatusConfig = statuses.find(s => s.name === selectedStatus);

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
              Análise completa de leads por campanha, anúncio e etapa do funil
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2.5 btn-gradient text-white rounded-xl font-medium hover:shadow-lg transition-all">
                <Download size={18} />
                Exportar
                <ChevronDown size={16} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="flex items-center gap-2">
                <FileText size={16} />
                Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuItem className="flex items-center gap-2">
                <FileText size={16} />
                Exportar Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total de Leads"
          value={metrics?.totalLeads.toLocaleString('pt-BR') || '0'}
          subtitle="Todos os tempos"
          icon={Users}
          gradient="from-blue-500 to-blue-600"
          isLoading={loadingMetrics}
        />
        <StatCard
          title="Leads este mês"
          value={metrics?.leadsThisMonth.toLocaleString('pt-BR') || '0'}
          subtitle="Mês atual"
          icon={UserPlus}
          gradient="from-purple-500 to-pink-500"
          isLoading={loadingMetrics}
        />
        <StatCard
          title="Leads hoje"
          value={metrics?.leadsToday.toLocaleString('pt-BR') || '0'}
          subtitle="Últimas 24h"
          icon={TrendingUp}
          gradient="from-green-500 to-emerald-500"
          isLoading={loadingMetrics}
        />
        <StatCard
          title="Conversões"
          value={metrics?.conversions.toLocaleString('pt-BR') || '0'}
          subtitle={`${metrics?.conversionRate.toFixed(1) || 0}% taxa de conversão`}
          icon={Target}
          gradient="from-orange-500 to-red-500"
          isLoading={loadingMetrics}
        />
      </div>

      {/* Main Content: Funnel + Champion Creative */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Chart */}
        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Funil de Conversão</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Clique em uma etapa para ver os leads e de qual anúncio vieram
          </p>
          <MetaFunnelChart 
            data={funnelData} 
            isLoading={loadingFunnel}
            onStatusClick={handleStatusClick}
            selectedStatus={selectedStatus}
          />
        </div>

        {/* Champion Creative */}
        <div>
          {loadingChampion ? (
            <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : champion ? (
            <CreativeCard
              sourceId={champion.sourceId}
              sourceUrl={champion.sourceUrl}
              thumbnailUrl={champion.thumbnailUrl}
              imageUrl={champion.imageUrl}
              headline={champion.headline}
              mediaType={champion.mediaType}
              campaignName={champion.campaignName}
              adName={champion.adName}
              total={champion.total}
              conversions={champion.conversions}
              conversionRate={champion.conversionRate}
              isChampion
            />
          ) : (
            <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum criativo com conversões ainda</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Daily Leads Chart */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <h3 className="text-lg font-semibold text-foreground mb-6">Leads por dia</h3>
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

      {/* Top Creatives Grid */}
      {topCreatives.length > 0 && (
        <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
          <h3 className="text-lg font-semibold text-foreground mb-6">Top Criativos por Conversão</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {topCreatives.map((creative) => (
              <CreativeCard
                key={creative.sourceId}
                sourceId={creative.sourceId}
                sourceUrl={creative.sourceUrl}
                thumbnailUrl={creative.thumbnailUrl}
                imageUrl={creative.imageUrl}
                headline={creative.headline}
                mediaType={creative.mediaType}
                campaignName={creative.campaignName}
                adName={creative.adName}
                total={creative.total}
                conversions={creative.conversions}
                conversionRate={creative.conversionRate}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {/* Ads Breakdown Table */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <h3 className="text-lg font-semibold text-foreground mb-6">Detalhamento por Anúncio</h3>
        <AdsBreakdownTable 
          data={adsBreakdown} 
          statuses={statuses}
          isLoading={loadingAds}
        />
      </div>

      {/* Status Leads Modal */}
      <StatusLeadsModal
        open={isStatusModalOpen}
        onOpenChange={setIsStatusModalOpen}
        statusName={selectedStatus}
        statusColor={selectedStatusConfig?.color || undefined}
        dateRange={activeDateRange}
      />
    </div>
  );
}
