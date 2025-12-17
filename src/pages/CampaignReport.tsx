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
  Loader2,
  ArrowLeft,
  DollarSign,
  FileSpreadsheet,
  Tag,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { useNavigate } from 'react-router-dom';
import { useMetaLeadsCrossData } from '@/hooks/useMetaLeadsCrossData';
import { useMetaCampaignROI } from '@/hooks/useMetaCampaignROI';
import { useMetaLeadsBySegment } from '@/hooks/useMetaLeadsBySegment';
import { CrossDataTable } from '@/components/campaigns/CrossDataTable';
import { ROITable } from '@/components/campaigns/ROITable';
import { SegmentTable } from '@/components/campaigns/SegmentTable';
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

export default function CampaignReport() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const activeDateRange = dateRange?.from && dateRange?.to 
    ? { from: dateRange.from, to: dateRange.to }
    : undefined;

  const { data: crossData, isLoading: loadingCrossData } = useMetaLeadsCrossData(activeDateRange);
  const { data: roiData, isLoading: loadingROI } = useMetaCampaignROI(activeDateRange);
  const { data: segmentData, isLoading: loadingSegment } = useMetaLeadsBySegment(activeDateRange);

  const summary = crossData?.summary;

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

    // Sheet 1: Cruzamento por Anúncio
    if (crossData?.rows) {
      const adSheet = crossData.rows.map(row => ({
        'Anúncio': row.adName,
        'Leads': row.totalLeads,
        'Catálogo': row.catalogoCount,
        'Layout': row.layoutCount,
        'Pedido Fechado': row.pedidoFechadoCount,
        'Valor Negociado': row.revenue
      }));
      const ws1 = XLSX.utils.json_to_sheet(adSheet);
      XLSX.utils.book_append_sheet(wb, ws1, 'Por Anúncio');
    }

    // Sheet 2: ROI por Campanha
    if (roiData?.campaigns) {
      const roiSheet = roiData.campaigns.map(row => ({
        'Campanha': row.campaignName,
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
      XLSX.utils.book_append_sheet(wb, ws2, 'ROI por Campanha');
    }

    // Sheet 3: Por Segmento
    if (segmentData) {
      const segSheet = segmentData.map(row => ({
        'Segmento': row.segmentName,
        'Leads': row.totalLeads,
        'Catálogo': row.catalogoCount,
        'Layout': row.layoutCount,
        'Pedido Fechado': row.pedidoFechadoCount,
        'Valor Negociado': row.revenue
      }));
      const ws3 = XLSX.utils.json_to_sheet(segSheet);
      XLSX.utils.book_append_sheet(wb, ws3, 'Por Segmento');
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

      {/* Cruzamento por Anúncio */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <div className="flex items-center gap-2 mb-6">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Cruzamento por Anúncio</h3>
        </div>
        <CrossDataTable 
          data={crossData?.rows || []}
          isLoading={loadingCrossData}
        />
      </div>

      {/* ROI por Campanha */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <div className="flex items-center gap-2 mb-6">
          <DollarSign className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">ROI por Campanha</h3>
        </div>
        <ROITable 
          data={roiData?.campaigns || []}
          isLoading={loadingROI}
        />
      </div>

      {/* Cruzamento por Segmento */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <div className="flex items-center gap-2 mb-6">
          <Tag className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Cruzamento por Segmento</h3>
        </div>
        <SegmentTable 
          data={segmentData || []}
          isLoading={loadingSegment}
        />
      </div>
    </div>
  );
}
