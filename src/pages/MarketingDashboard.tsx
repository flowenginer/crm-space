import { useState } from 'react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Megaphone,
  Calendar as CalendarIcon,
  ChevronDown,
  Download,
  ArrowLeft,
  Layers,
  Zap,
  PieChart,
  LineChart,
  Users,
  Send,
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
import * as XLSX from 'xlsx';

// Hooks
import {
  useMarketingCampaignsList,
  useMarketingDashboardKPIs,
  useMarketingStepMetrics,
  useMarketingActionMetrics,
  useMarketingStatusDistribution,
  useMarketingResponseTimeline,
  useMarketingCampaignContacts,
  useMarketingDispatchStats,
} from '@/hooks/useMarketingDashboard';

// Components
import { CampaignSelector } from '@/components/marketing-dashboard/CampaignSelector';
import { MarketingKPICards } from '@/components/marketing-dashboard/MarketingKPICards';
import { CampaignStepFunnel } from '@/components/marketing-dashboard/CampaignStepFunnel';
import { ActionsExecutedTable } from '@/components/marketing-dashboard/ActionsExecutedTable';
import { ConversionsByStatus } from '@/components/marketing-dashboard/ConversionsByStatus';
import { ResponseTimeline } from '@/components/marketing-dashboard/ResponseTimeline';
import { CampaignContactsList } from '@/components/marketing-dashboard/CampaignContactsList';
import { DispatchesTable } from '@/components/marketing-dashboard/DispatchesTable';

const datePresets = [
  { label: 'Hoje', getValue: () => ({ from: new Date(), to: new Date() }) },
  { label: 'Últimos 7 dias', getValue: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: 'Últimos 30 dias', getValue: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: 'Este mês', getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: 'Mês passado', getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Todo o período', getValue: () => ({ from: undefined, to: undefined }) },
];

export default function MarketingDashboard() {
  const navigate = useNavigate();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 29),
    to: new Date(),
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [contactsPage, setContactsPage] = useState(0);

  // Queries
  const { data: campaigns, isLoading: loadingCampaigns } = useMarketingCampaignsList();
  const { data: kpis, isLoading: loadingKPIs } = useMarketingDashboardKPIs(
    selectedCampaignId,
    dateRange?.from,
    dateRange?.to
  );
  const { data: stepMetrics, isLoading: loadingSteps } = useMarketingStepMetrics(
    selectedCampaignId,
    dateRange?.from,
    dateRange?.to
  );
  const { data: actionMetrics, isLoading: loadingActions } = useMarketingActionMetrics(
    selectedCampaignId,
    dateRange?.from,
    dateRange?.to
  );
  const { data: statusDistribution, isLoading: loadingStatus } = useMarketingStatusDistribution(
    selectedCampaignId,
    dateRange?.from,
    dateRange?.to
  );
  const { data: timeline, isLoading: loadingTimeline } = useMarketingResponseTimeline(
    selectedCampaignId,
    dateRange?.from,
    dateRange?.to
  );
  const { data: contactsData, isLoading: loadingContacts } = useMarketingCampaignContacts(
    selectedCampaignId,
    dateRange?.from,
    dateRange?.to,
    contactsPage
  );
  const { data: dispatches, isLoading: loadingDispatches } = useMarketingDispatchStats(selectedCampaignId);

  const formatDateRange = (range: DateRange | undefined) => {
    if (!range?.from) return 'Todo o período';
    if (!range.to) return format(range.from, 'dd/MM/yyyy', { locale: ptBR });
    return `${format(range.from, 'dd/MM/yyyy', { locale: ptBR })} - ${format(range.to, 'dd/MM/yyyy', { locale: ptBR })}`;
  };

  const handlePresetClick = (preset: typeof datePresets[0]) => {
    const value = preset.getValue();
    setDateRange(value.from ? value : undefined);
    setIsDatePickerOpen(false);
  };

  const handleExportExcel = () => {
    if (!selectedCampaignId) return;

    const wb = XLSX.utils.book_new();
    const selectedCampaign = campaigns?.find(c => c.id === selectedCampaignId);

    // KPIs Sheet
    if (kpis) {
      const kpisSheet = [{
        'Total Contatos': kpis.totalContacts,
        'Taxa de Resposta (%)': kpis.responseRate.toFixed(1),
        'Taxa de Conclusão (%)': kpis.completionRate.toFixed(1),
        'Conversões': kpis.conversions,
        'Taxa de Conversão (%)': kpis.conversionRate.toFixed(1),
        'Ativos': kpis.activeContacts,
        'Cancelados': kpis.cancelledContacts,
      }];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpisSheet), 'Resumo');
    }

    // Steps Sheet
    if (stepMetrics && stepMetrics.length > 0) {
      const stepsSheet = stepMetrics.map(s => ({
        'Step': s.stepNumber + 1,
        'Mensagem': s.stepMessage,
        'Enviadas': s.sent,
        'Entregues': s.delivered,
        'Lidas': s.read,
        'Responderam': s.responded,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stepsSheet), 'Steps');
    }

    // Status Distribution Sheet
    if (statusDistribution && statusDistribution.length > 0) {
      const statusSheet = statusDistribution.map(s => ({
        'Status': s.status,
        'Quantidade': s.count,
        'Porcentagem (%)': s.percentage.toFixed(1),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(statusSheet), 'Status');
    }

    // Contacts Sheet
    if (contactsData?.contacts && contactsData.contacts.length > 0) {
      const contactsSheet = contactsData.contacts.map(c => ({
        'Nome': c.contactName,
        'Telefone': c.contactPhone,
        'Step Atual': c.currentStep + 1,
        'Status': c.status,
        'Entrou em': c.createdAt,
        'Respondeu em': c.respondedAt || '-',
        'Status Lead': c.leadStatus || '-',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(contactsSheet), 'Contatos');
    }

    const campaignName = selectedCampaign?.title?.replace(/[^a-zA-Z0-9]/g, '-') || 'campanha';
    const fileName = `dashboard-${campaignName}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/bulk-dispatch')}
            className="rounded-xl"
          >
            <ArrowLeft size={20} />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Megaphone className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard de Campanhas</h1>
            </div>
            <p className="text-muted-foreground">
              Acompanhe o desempenho completo das suas campanhas de marketing
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Campaign Selector */}
          <CampaignSelector
            campaigns={campaigns}
            selectedId={selectedCampaignId}
            onSelect={setSelectedCampaignId}
            isLoading={loadingCampaigns}
          />

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
            disabled={!selectedCampaignId}
            className="btn-gradient text-white rounded-xl font-medium"
          >
            <Download size={18} className="mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* No Campaign Selected */}
      {!selectedCampaignId && (
        <div className="bg-card rounded-2xl border border-border/50 p-12 text-center shadow-elevated">
          <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Selecione uma campanha
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Escolha uma campanha de marketing no seletor acima para visualizar suas métricas e desempenho
          </p>
        </div>
      )}

      {/* Dashboard Content */}
      {selectedCampaignId && (
        <>
          {/* KPI Cards */}
          <MarketingKPICards kpis={kpis} isLoading={loadingKPIs} />

          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Step Funnel */}
            <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
              <div className="flex items-center gap-2 mb-6">
                <Layers className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Funil por Step</h3>
              </div>
              <CampaignStepFunnel steps={stepMetrics} isLoading={loadingSteps} />
            </div>

            {/* Status Distribution */}
            <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
              <div className="flex items-center gap-2 mb-6">
                <PieChart className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Distribuição por Status</h3>
              </div>
              <ConversionsByStatus data={statusDistribution} isLoading={loadingStatus} />
            </div>
          </div>

          {/* Response Timeline */}
          <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
            <div className="flex items-center gap-2 mb-6">
              <LineChart className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Timeline de Respostas</h3>
            </div>
            <ResponseTimeline data={timeline} isLoading={loadingTimeline} />
          </div>

          {/* Actions Executed */}
          <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
            <div className="flex items-center gap-2 mb-6">
              <Zap className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Ações Executadas</h3>
            </div>
            <ActionsExecutedTable actions={actionMetrics} isLoading={loadingActions} />
          </div>

          {/* Dispatches */}
          <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
            <div className="flex items-center gap-2 mb-6">
              <Send className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Histórico de Disparos</h3>
            </div>
            <DispatchesTable dispatches={dispatches} isLoading={loadingDispatches} />
          </div>

          {/* Contacts List */}
          <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
            <div className="flex items-center gap-2 mb-6">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Contatos da Campanha</h3>
              {contactsData?.total && (
                <span className="text-sm text-muted-foreground">
                  ({contactsData.total.toLocaleString('pt-BR')} total)
                </span>
              )}
            </div>
            <CampaignContactsList
              contacts={contactsData?.contacts}
              total={contactsData?.total || 0}
              page={contactsPage}
              pageSize={20}
              onPageChange={setContactsPage}
              isLoading={loadingContacts}
            />
          </div>
        </>
      )}
    </div>
  );
}
