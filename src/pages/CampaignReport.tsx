import { useState, useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Facebook,
  Users,
  FileText,
  Palette,
  CheckCircle,
  DollarSign,
  Download,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { CampaignFilterBar, CampaignFilterState } from '@/components/campaigns/CampaignFilterBar';
import { CampaignTimelineChart } from '@/components/campaigns/CampaignTimelineChart';
import { LeadsListModal, LeadInfo } from '@/components/campaigns/LeadsListModal';
import { CrossDataTable } from '@/components/campaigns/CrossDataTable';
import { useCampaignReportData } from '@/hooks/useCampaignReportData';
import { useMetaLeadsCrossData, CrossDataRow } from '@/hooks/useMetaLeadsCrossData';
import * as XLSX from 'xlsx';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  gradient: string;
  isLoading?: boolean;
  onClick?: () => void;
}

function StatCard({ title, value, subtitle, icon: Icon, gradient, isLoading, onClick }: StatCardProps) {
  return (
    <div
      className={`bg-card rounded-2xl border border-border/50 p-6 shadow-elevated hover:shadow-elevated-lg transition-all duration-300 group ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
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
    const segment = row.segmentName || 'Sem Segmento';
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

  // Estado dos filtros
  const [filters, setFilters] = useState<CampaignFilterState>({
    dateRange: { from: subDays(new Date(), 29), to: new Date() },
    campaign: null,
    creative: null,
    segment: null,
    status: null,
  });

  // Estado para visualização da tabela
  const [crossDataView, setCrossDataView] = useState<'anuncio' | 'campanha' | 'segmento'>('anuncio');

  // Estado do modal de leads
  const [leadsModal, setLeadsModal] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    filterStatus?: string;
  }>({
    isOpen: false,
    title: '',
  });

  // Buscar dados
  const { data: reportData, isLoading: loadingReport } = useCampaignReportData(filters);

  // Buscar dados de cruzamento (mantém compatibilidade com tabela existente)
  const activeDateRange = filters.dateRange?.from && filters.dateRange?.to
    ? { from: filters.dateRange.from, to: filters.dateRange.to }
    : undefined;
  const { data: crossData, isLoading: loadingCrossData } = useMetaLeadsCrossData(activeDateRange);

  // Dados processados para a tabela
  const crossDataDisplay = useMemo(() => {
    if (!crossData?.rows) return [];
    if (crossDataView === 'campanha') return groupByCampaign(crossData.rows);
    if (crossDataView === 'segmento') return groupBySegment(crossData.rows);
    return crossData.rows;
  }, [crossData?.rows, crossDataView]);

  // Formatar moeda
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Filtrar leads para o modal baseado no status selecionado
  const modalLeads = useMemo(() => {
    if (!reportData?.leads) return [];
    if (!leadsModal.filterStatus) return reportData.leads;

    return reportData.leads.filter(lead => {
      const statusLower = lead.status.toLowerCase();
      switch (leadsModal.filterStatus) {
        case 'novo':
          return !statusLower.includes('catálogo') &&
                 !statusLower.includes('catalogo') &&
                 !statusLower.includes('layout') &&
                 !statusLower.includes('fechado') &&
                 !statusLower.includes('ganho') &&
                 !statusLower.includes('convertido');
        case 'catalogo':
          return statusLower.includes('catálogo') || statusLower.includes('catalogo');
        case 'layout':
          return statusLower.includes('layout');
        case 'fechado':
          return statusLower.includes('fechado') ||
                 statusLower.includes('ganho') ||
                 statusLower.includes('convertido');
        default:
          return true;
      }
    });
  }, [reportData?.leads, leadsModal.filterStatus]);

  // Abrir modal de leads
  const openLeadsModal = (title: string, filterStatus?: string) => {
    setLeadsModal({
      isOpen: true,
      title,
      subtitle: `${filters.dateRange?.from ? format(filters.dateRange.from, 'dd/MM/yyyy', { locale: ptBR }) : ''} - ${filters.dateRange?.to ? format(filters.dateRange.to, 'dd/MM/yyyy', { locale: ptBR }) : ''}`,
      filterStatus,
    });
  };

  // Navegar para página do lead
  const handleLeadClick = (leadId: string) => {
    window.open(`/crm?contact=${leadId}`, '_blank');
  };

  // Exportar Excel
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Resumo por status
    if (reportData?.summary) {
      const summarySheet = [
        { 'Métrica': 'Total de Leads', 'Valor': reportData.summary.total },
        { 'Métrica': 'Novos', 'Valor': reportData.summary.novo },
        { 'Métrica': 'Catálogo', 'Valor': reportData.summary.catalogo },
        { 'Métrica': 'Layout', 'Valor': reportData.summary.layout },
        { 'Métrica': 'Pedido Fechado', 'Valor': reportData.summary.fechado },
        { 'Métrica': 'Receita Total', 'Valor': reportData.summary.revenue },
      ];
      const ws1 = XLSX.utils.json_to_sheet(summarySheet);
      XLSX.utils.book_append_sheet(wb, ws1, 'Resumo');
    }

    // Sheet 2: Timeline
    if (reportData?.timeline) {
      const ws2 = XLSX.utils.json_to_sheet(reportData.timeline.map(t => ({
        'Data': t.date,
        'Total Leads': t.leads,
        'Catálogo': t.catalogo,
        'Layout': t.layout,
        'Fechado': t.fechado,
      })));
      XLSX.utils.book_append_sheet(wb, ws2, 'Timeline');
    }

    // Sheet 3: Cruzamento
    if (crossDataDisplay.length > 0) {
      const label = crossDataView === 'campanha' ? 'Campanha' : crossDataView === 'segmento' ? 'Segmento' : 'Anúncio';
      const adSheet = crossDataDisplay.map(row => ({
        [label]: row.adName,
        'Leads': row.totalLeads,
        'Catálogo': row.catalogoCount,
        'Layout': row.layoutCount,
        'Pedido Fechado': row.pedidoFechadoCount,
        'Valor Negociado': row.revenue,
      }));
      const ws3 = XLSX.utils.json_to_sheet(adSheet);
      XLSX.utils.book_append_sheet(wb, ws3, `Por ${label}`);
    }

    // Sheet 4: Lista de Leads
    if (reportData?.leads && reportData.leads.length > 0) {
      const leadsSheet = reportData.leads.map(lead => ({
        'Nome': lead.fullName,
        'Telefone': lead.phone,
        'Status': lead.status,
        'Segmento': lead.segment || '-',
        'Valor Negociado': lead.negotiatedValue,
        'Data': format(new Date(lead.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR }),
      }));
      const ws4 = XLSX.utils.json_to_sheet(leadsSheet);
      XLSX.utils.book_append_sheet(wb, ws4, 'Leads');
    }

    const fileName = `relatorio-campanhas-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const summary = reportData?.summary || { total: 0, novo: 0, catalogo: 0, layout: 0, fechado: 0, revenue: 0 };
  const isLoading = loadingReport || loadingCrossData;

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
              Análise de performance de leads por campanha, criativo e status
            </p>
          </div>
        </div>

        <Button
          onClick={handleExportExcel}
          className="btn-gradient text-white rounded-xl font-medium"
        >
          <Download size={18} className="mr-2" />
          Exportar Excel
        </Button>
      </div>

      {/* Filter Bar */}
      <CampaignFilterBar
        filters={filters}
        onFiltersChange={setFilters}
        campaigns={reportData?.campaigns || []}
        creatives={reportData?.creatives || []}
        segments={reportData?.segments || []}
        statuses={reportData?.statuses || []}
        isLoading={isLoading}
      />

      {/* Summary Cards - Funil por Status */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard
          title="Total de Leads"
          value={summary.total.toLocaleString('pt-BR')}
          icon={Users}
          gradient="from-blue-500 to-blue-600"
          isLoading={isLoading}
          onClick={() => openLeadsModal('Todos os Leads')}
        />
        <StatCard
          title="Novos"
          value={summary.novo.toLocaleString('pt-BR')}
          subtitle={summary.total > 0 ? `${((summary.novo / summary.total) * 100).toFixed(1)}%` : '0%'}
          icon={Users}
          gradient="from-slate-500 to-slate-600"
          isLoading={isLoading}
          onClick={() => openLeadsModal('Leads Novos', 'novo')}
        />
        <StatCard
          title="Catálogo"
          value={summary.catalogo.toLocaleString('pt-BR')}
          subtitle={summary.total > 0 ? `${((summary.catalogo / summary.total) * 100).toFixed(1)}%` : '0%'}
          icon={FileText}
          gradient="from-amber-500 to-orange-500"
          isLoading={isLoading}
          onClick={() => openLeadsModal('Leads em Catálogo', 'catalogo')}
        />
        <StatCard
          title="Layout"
          value={summary.layout.toLocaleString('pt-BR')}
          subtitle={summary.total > 0 ? `${((summary.layout / summary.total) * 100).toFixed(1)}%` : '0%'}
          icon={Palette}
          gradient="from-violet-500 to-purple-500"
          isLoading={isLoading}
          onClick={() => openLeadsModal('Leads em Layout', 'layout')}
        />
        <StatCard
          title="Pedido Fechado"
          value={summary.fechado.toLocaleString('pt-BR')}
          subtitle={formatCurrency(summary.revenue)}
          icon={CheckCircle}
          gradient="from-emerald-500 to-green-500"
          isLoading={isLoading}
          onClick={() => openLeadsModal('Pedidos Fechados', 'fechado')}
        />
      </div>

      {/* Timeline Chart */}
      <CampaignTimelineChart
        data={reportData?.timeline || []}
        isLoading={isLoading}
      />

      {/* Cross Data Table */}
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="text-lg font-semibold text-foreground">Cruzamento de Dados</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Agrupar por:</span>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${crossDataView === 'anuncio' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                onClick={() => setCrossDataView('anuncio')}
              >
                Anúncio
              </button>
              <button
                className={`px-3 py-1.5 text-sm font-medium transition-colors border-x border-border ${crossDataView === 'campanha' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                onClick={() => setCrossDataView('campanha')}
              >
                Campanha
              </button>
              <button
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${crossDataView === 'segmento' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                onClick={() => setCrossDataView('segmento')}
              >
                Segmento
              </button>
            </div>
          </div>
        </div>
        <CrossDataTable
          data={crossDataDisplay}
          isLoading={loadingCrossData}
          viewMode={crossDataView}
        />
      </div>

      {/* Leads List Modal */}
      <LeadsListModal
        isOpen={leadsModal.isOpen}
        onClose={() => setLeadsModal({ ...leadsModal, isOpen: false })}
        title={leadsModal.title}
        subtitle={leadsModal.subtitle}
        leads={modalLeads}
        isLoading={isLoading}
        onLeadClick={handleLeadClick}
      />
    </div>
  );
}
