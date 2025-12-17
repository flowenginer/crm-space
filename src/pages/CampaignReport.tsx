import { useState, useMemo } from 'react';
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
  Loader2,
  ArrowLeft,
  DollarSign,
  FileSpreadsheet,
  GitBranch,
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
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { useNavigate } from 'react-router-dom';
import { useMetaLeadsCrossData, CrossDataRow } from '@/hooks/useMetaLeadsCrossData';
import { useMetaCampaignROI } from '@/hooks/useMetaCampaignROI';
import { useMetaSegmentROI } from '@/hooks/useMetaSegmentROI';
import { useMetaSegmentJourney } from '@/hooks/useMetaSegmentJourney';
import { CrossDataTable } from '@/components/campaigns/CrossDataTable';
import { ROITable } from '@/components/campaigns/ROITable';
import { SegmentJourneyChart } from '@/components/campaigns/SegmentJourneyChart';
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

// Função para extrair segmento do nome da campanha
function extractSegmentFromCampaignName(campaignName: string): string {
  if (!campaignName) return 'Sem Segmento';
  const parts = campaignName.split('|').map(p => p.trim());
  return parts.length >= 2 ? parts[1] : 'Sem Segmento';
}

// Função para agrupar CrossData por campanha
function groupByCampaign(rows: CrossDataRow[]): CrossDataRow[] {
  const grouped = new Map<string, CrossDataRow>();
  
  rows.forEach(row => {
    const key = row.campaignName || 'Sem Campanha';
    if (!grouped.has(key)) {
      grouped.set(key, { 
        ...row, 
        adName: key,
        sourceId: key,
      });
    } else {
      const existing = grouped.get(key)!;
      existing.totalLeads += row.totalLeads;
      existing.catalogoCount += row.catalogoCount;
      existing.layoutCount += row.layoutCount;
      existing.pedidoFechadoCount += row.pedidoFechadoCount;
      existing.revenue += row.revenue;
    }
  });
  
  return Array.from(grouped.values()).sort((a, b) => b.totalLeads - a.totalLeads);
}

// Função para agrupar CrossData por segmento
function groupBySegment(rows: CrossDataRow[]): CrossDataRow[] {
  const grouped = new Map<string, CrossDataRow>();
  
  rows.forEach(row => {
    const segment = extractSegmentFromCampaignName(row.campaignName || '');
    if (!grouped.has(segment)) {
      grouped.set(segment, { 
        ...row, 
        adName: segment,
        sourceId: segment,
      });
    } else {
      const existing = grouped.get(segment)!;
      existing.totalLeads += row.totalLeads;
      existing.catalogoCount += row.catalogoCount;
      existing.layoutCount += row.layoutCount;
      existing.pedidoFechadoCount += row.pedidoFechadoCount;
      existing.revenue += row.revenue;
    }
  });
  
  return Array.from(grouped.values()).sort((a, b) => b.totalLeads - a.totalLeads);
}

export default function CampaignReport() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  // Estados para controlar visualização
  const [crossDataView, setCrossDataView] = useState<'anuncio' | 'campanha' | 'segmento'>('anuncio');
  const [roiView, setRoiView] = useState<'campanha' | 'segmento'>('campanha');

  const activeDateRange = dateRange?.from && dateRange?.to 
    ? { from: dateRange.from, to: dateRange.to }
    : undefined;

  const { data: crossData, isLoading: loadingCrossData } = useMetaLeadsCrossData(activeDateRange);
  const { data: roiData, isLoading: loadingROI } = useMetaCampaignROI(activeDateRange);
  const { data: segmentROIData, isLoading: loadingSegmentROI } = useMetaSegmentROI(activeDateRange);
  const { data: journeyData, isLoading: loadingJourney } = useMetaSegmentJourney(activeDateRange);

  const summary = crossData?.summary;

  // Dados processados baseado na view selecionada
  const crossDataDisplay = useMemo(() => {
    if (!crossData?.rows) return [];
    if (crossDataView === 'campanha') return groupByCampaign(crossData.rows);
    if (crossDataView === 'segmento') return groupBySegment(crossData.rows);
    return crossData.rows;
  }, [crossData?.rows, crossDataView]);

  const roiDataDisplay = useMemo(() => {
    if (roiView === 'segmento') {
      return segmentROIData || [];
    }
    return roiData?.campaigns || [];
  }, [roiView, roiData?.campaigns, segmentROIData]);

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
    const wb = XLSX.utils.book_new();

    // Sheet 1: Cruzamento (por anúncio ou campanha)
    if (crossDataDisplay.length > 0) {
      const label = crossDataView === 'campanha' ? 'Campanha' : 'Anúncio';
      const adSheet = crossDataDisplay.map(row => ({
        [label]: row.adName,
        'Leads': row.totalLeads,
        'Catálogo': row.catalogoCount,
        'Layout': row.layoutCount,
        'Pedido Fechado': row.pedidoFechadoCount,
        'Valor Negociado': row.revenue
      }));
      const ws1 = XLSX.utils.json_to_sheet(adSheet);
      XLSX.utils.book_append_sheet(wb, ws1, `Por ${label}`);
    }

    // Sheet 2: ROI (por campanha ou segmento)
    if (roiDataDisplay.length > 0) {
      const label = roiView === 'segmento' ? 'Segmento' : 'Campanha';
      const roiSheet = roiDataDisplay.map((row: any) => ({
        [label]: row.campaignName || row.segmentName,
        'Gastos': row.spend,
        'Leads': row.leads,
        'CPL': row.cpl,
        'Conversões': row.conversions,
        'CAC': row.cac,
        'Receita': row.revenue,
        'ROI (%)': row.roi,
        'ROAS': row.roas
      }));
      const ws2 = XLSX.utils.json_to_sheet(roiSheet);
      XLSX.utils.book_append_sheet(wb, ws2, `ROI por ${label}`);
    }

    const fileName = `relatorio-campanhas-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
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
              <h1 className="text-3xl font-bold text-foreground">Relatório de Campanhas</h1>
            </div>
            <p className="text-muted-foreground">
              Cruzamento de dados Meta Ads por Anúncio, Campanha e Segmento
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
          >
            <Download size={18} className="mr-2" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total de Leads"
          value={summary?.totalLeads.toLocaleString('pt-BR') || '0'}
          icon={Users}
          gradient="from-blue-500 to-blue-600"
          isLoading={loadingCrossData}
        />
        <StatCard
          title="Conversões"
          value={summary?.pedidoFechadoCount.toLocaleString('pt-BR') || '0'}
          subtitle={summary?.totalLeads ? `${((summary.pedidoFechadoCount / summary.totalLeads) * 100).toFixed(1)}% taxa` : '0%'}
          icon={Target}
          gradient="from-green-500 to-emerald-500"
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
          title="Taxa de Conversão"
          value={summary?.totalLeads 
            ? `${((summary.pedidoFechadoCount / summary.totalLeads) * 100).toFixed(1)}%`
            : '0%'
          }
          icon={TrendingUp}
          gradient="from-purple-500 to-pink-500"
          isLoading={loadingCrossData}
        />
      </div>

      {/* Cruzamento por Anúncio/Campanha */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <div className="flex items-center gap-2 mb-6">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold text-foreground">Cruzamento por</span>
          <Select value={crossDataView} onValueChange={(v: 'anuncio' | 'campanha' | 'segmento') => setCrossDataView(v)}>
            <SelectTrigger className="w-[140px] h-9 border-primary/30 bg-primary/5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="anuncio">Anúncio</SelectItem>
              <SelectItem value="campanha">Campanha</SelectItem>
              <SelectItem value="segmento">Segmento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CrossDataTable 
          data={crossDataDisplay}
          isLoading={loadingCrossData}
          viewMode={crossDataView}
        />
      </div>

      {/* ROI por Campanha/Segmento */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <div className="flex items-center gap-2 mb-6">
          <DollarSign className="h-5 w-5 text-primary" />
          <span className="text-lg font-semibold text-foreground">ROI por</span>
          <Select value={roiView} onValueChange={(v: 'campanha' | 'segmento') => setRoiView(v)}>
            <SelectTrigger className="w-[140px] h-9 border-primary/30 bg-primary/5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="campanha">Campanha</SelectItem>
              <SelectItem value="segmento">Segmento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ROITable 
          data={roiDataDisplay}
          isLoading={roiView === 'segmento' ? loadingSegmentROI : loadingROI}
          viewMode={roiView}
        />
      </div>

      {/* Jornada por Segmento */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <div className="flex items-center gap-2 mb-6">
          <GitBranch className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Jornada por Segmento</h3>
          <span className="text-sm text-muted-foreground ml-2">
            (Campanha → Segmento Marcado → Status)
          </span>
        </div>
        <SegmentJourneyChart 
          data={journeyData || []}
          isLoading={loadingJourney}
        />
      </div>
    </div>
  );
}
