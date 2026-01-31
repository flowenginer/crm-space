import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  ClipboardList, Search, Printer,
  FileSpreadsheet, Loader2, ChevronLeft, ChevronRight, Eye, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import { ConversationPreviewDialog } from '@/components/conversations/ConversationPreviewDialog';
import { BulkActionsBar } from '@/components/conversations/BulkActionsBar';
import { BulkTransferModal } from '@/components/conversations/BulkTransferModal';
import { BulkCloseModal } from '@/components/conversations/BulkCloseModal';
import { BulkTagModal } from '@/components/conversations/BulkTagModal';
import { BulkLeadStatusModal } from '@/components/conversations/BulkLeadStatusModal';
import { useBulkReopenConversations } from '@/hooks/useBulkConversationActions';

interface Filters {
  startDate: string;
  endDate: string;
  name: string;
  phone: string;
  leadStatus: string[];
  conversationStatus: string[];
  channel: string[];
  agent: string[];
  department: string[];
  tag: string[];
}

const initialFilters: Filters = {
  startDate: format(new Date(), 'yyyy-MM-dd'),
  endDate: format(new Date(), 'yyyy-MM-dd'),
  name: '',
  phone: '',
  leadStatus: [],
  conversationStatus: [],
  channel: [],
  agent: [],
  department: [],
  tag: [],
};

// Static options for conversation status filter
const conversationStatusOptions = [
  { value: 'open', label: 'Ativo' },
  { value: 'pending', label: 'Pendente' },
  { value: 'closed', label: 'Fechado' },
];

export default function ConversationReportPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewConversationId, setPreviewConversationId] = useState<string | null>(null);
  
  // Bulk action modals
  const [bulkTransferModalOpen, setBulkTransferModalOpen] = useState(false);
  const [bulkCloseModalOpen, setBulkCloseModalOpen] = useState(false);
  const [bulkTagModalOpen, setBulkTagModalOpen] = useState(false);
  const [bulkLeadStatusModalOpen, setBulkLeadStatusModalOpen] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  
  const bulkReopen = useBulkReopenConversations();
  
  const pageSize = 50;

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('conversation-report-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversation-report'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversation-report'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch filter options
  const { data: channels = [] } = useQuery({
    queryKey: ['channels-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('whatsapp_channels')
        .select('id, name, phone')
        .eq('is_deleted', false);
      return data || [];
    }
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');
      return data || [];
    }
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('departments')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      return data || [];
    }
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('tags')
        .select('id, name, color')
        .order('name');
      return data || [];
    }
  });

  // Fetch lead statuses dynamically from lead_statuses table
  const { data: leadStatuses = [] } = useQuery({
    queryKey: ['lead-statuses-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_statuses')
        .select('id, name, color')
        .eq('is_active', true)
        .order('order_position');
      return data || [];
    }
  });

  // Fetch report data using RPC function
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['conversation-report', appliedFilters, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_conversations_report', {
        p_start_date: appliedFilters.startDate ? `${appliedFilters.startDate}T00:00:00` : null,
        p_end_date: appliedFilters.endDate ? `${appliedFilters.endDate}T23:59:59` : null,
        p_name: appliedFilters.name || null,
        p_phone: appliedFilters.phone || null,
        p_lead_status: appliedFilters.leadStatus.length > 0 ? appliedFilters.leadStatus : null,
        p_channel_ids: appliedFilters.channel.length > 0 ? appliedFilters.channel : null,
        p_agent_ids: appliedFilters.agent.length > 0 ? appliedFilters.agent : null,
        p_department_ids: appliedFilters.department.length > 0 ? appliedFilters.department : null,
        p_tag_ids: appliedFilters.tag.length > 0 ? appliedFilters.tag : null,
        p_conversation_status: appliedFilters.conversationStatus.length > 0 ? appliedFilters.conversationStatus : null,
        p_page: page,
        p_page_size: pageSize
      });

      if (error) throw error;

      // Get total count from first row
      const total = data?.[0]?.total_count || 0;

      // Process conversations
      const conversations = (data || []).map((row: any) => {
        let firstMessageText = row.first_message_content || '';
        // Check for media types based on content patterns
        if (firstMessageText.startsWith('[Áudio]') || firstMessageText.startsWith('[Imagem]') || 
            firstMessageText.startsWith('[Vídeo]') || firstMessageText.startsWith('[Documento]')) {
          // Keep as is
        }

        return {
          id: row.id,
          contact_id: row.contact_id,
          channel_id: row.channel_id,
          assigned_to: row.assigned_to,
          department_id: row.department_id,
          status: row.status,
          lead_status: row.lead_status,
          created_at: row.created_at,
          closed_at: row.closed_at,
          close_reason: row.close_reason,
          last_message_at: row.last_message_at,
          contact: {
            full_name: row.contact_full_name,
            phone: row.contact_phone,
            lead_status: row.contact_lead_status
          },
          channel: {
            name: row.channel_name
          },
          assigned_user: {
            full_name: row.agent_name
          },
          department: {
            name: row.department_name
          },
          first_message: firstMessageText,
          protocol_number: row.id.slice(-6).toUpperCase(),
          tags: [] // Tags will be fetched separately if needed
        };
      });

      // Fetch tags for conversations
      if (conversations.length > 0) {
        const conversationIds = conversations.map((c: any) => c.id);
        const { data: tagsData } = await supabase
          .from('conversation_tags')
          .select('conversation_id, tag:tags(id, name, color)')
          .in('conversation_id', conversationIds);

        if (tagsData) {
          const tagsByConversation = tagsData.reduce((acc: any, item: any) => {
            if (!acc[item.conversation_id]) {
              acc[item.conversation_id] = [];
            }
            acc[item.conversation_id].push({ tag: item.tag });
            return acc;
          }, {});

          conversations.forEach((conv: any) => {
            conv.tags = tagsByConversation[conv.id] || [];
          });
        }
      }

      return {
        conversations,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / pageSize)
      };
    },
    refetchOnWindowFocus: false,
  });

  const handleSearch = () => {
    setAppliedFilters(filters);
    setPage(1);
    setSelectedRows(new Set());
    setSelectAll(false);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
    toast.success('Dados atualizados!');
  };

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
    setSelectAll(newSelected.size === reportData?.conversations.length);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(reportData?.conversations.map((c: any) => c.id) || []));
    }
    setSelectAll(!selectAll);
  };

  // Get selected conversations data for bulk actions
  const selectedConversationsData = useMemo(() => {
    if (!reportData?.conversations) return [];
    return reportData.conversations.filter((c: any) => selectedRows.has(c.id));
  }, [reportData, selectedRows]);

  // Get unique contact IDs from selected conversations
  const selectedContactIds = useMemo(() => {
    return [...new Set(selectedConversationsData.map((c: any) => c.contact_id))];
  }, [selectedConversationsData]);

  const handleBulkSuccess = () => {
    setSelectedRows(new Set());
    setSelectAll(false);
  };

  const handleBulkReopen = async () => {
    const closedConversations = selectedConversationsData.filter((c: any) => c.status === 'closed');
    if (closedConversations.length === 0) {
      toast.error('Nenhuma conversa fechada selecionada');
      return;
    }

    setIsReopening(true);
    try {
      const result = await bulkReopen.mutateAsync(closedConversations.map((c: any) => c.id));
      
      if (result.success > 0 && result.failed === 0) {
        toast.success(`${result.success} conversa(s) reaberta(s) com sucesso`);
      } else if (result.success > 0 && result.failed > 0) {
        toast.warning(`${result.success} reaberta(s), ${result.failed} falhou(aram)`);
      } else {
        toast.error('Falha ao reabrir conversas');
      }
      
      handleBulkSuccess();
    } catch (error: any) {
      console.error('[ConversationReport] Reopen error:', error);
      toast.error('Erro ao reabrir conversas');
    } finally {
      setIsReopening(false);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = selectedRows.size > 0
      ? reportData?.conversations.filter((c: any) => selectedRows.has(c.id))
      : reportData?.conversations;

    if (!dataToExport?.length) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    const excelData = dataToExport.map((conv: any) => ({
      '#': conv.protocol_number,
      'Nome': conv.contact?.full_name || '',
      'Contato': conv.contact?.phone || '',
      'Canal': conv.channel?.name || '',
      'Agente': conv.assigned_user?.full_name || '',
      'Departamento': conv.department?.name || '',
      'Etiquetas': conv.tags?.map((t: any) => t.tag?.name).join(', ') || '',
      'Data Abertura': format(new Date(conv.created_at), 'dd/MM/yyyy HH:mm'),
      'Data Fechamento': conv.closed_at ? format(new Date(conv.closed_at), 'dd/MM/yyyy HH:mm') : '',
      '1ª Mensagem': conv.first_message || '',
      'Status': conv.status === 'open' ? 'Ativo' : conv.status === 'pending' ? 'Pendente' : 'Fechado'
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Atendimentos');

    const colWidths = Object.keys(excelData[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    worksheet['!cols'] = colWidths;

    const fileName = `atendimentos_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success('Arquivo Excel gerado!');
  };

  const handlePrint = () => {
    window.print();
  };

  const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return '-';
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 12) {
      return digits.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 ($2) $3-$4');
    }
    if (digits.length >= 10) {
      return digits.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  const getStatusBadge = (status: string | null) => {
    const config: Record<string, { label: string; color: string }> = {
      open: { label: 'Ativo', color: 'bg-green-500' },
      pending: { label: 'Pendente', color: 'bg-amber-500' },
      closed: { label: 'Fechado', color: 'bg-muted-foreground' },
    };
    const { label, color } = config[status || 'closed'] || config.closed;
    return (
      <span className={`px-2 py-0.5 rounded text-xs text-white ${color}`}>
        {label}
      </span>
    );
  };

  // Convert options for MultiSelect
  const channelOptions = channels.map(ch => ({ value: ch.id, label: ch.name }));
  const agentOptions = [
    { value: 'no_agent', label: '⚠️ Sem agente' },
    ...agents.map(a => ({ value: a.id, label: a.full_name || '' }))
  ];
  const departmentOptions = [
    { value: 'no_department', label: '⚠️ Sem departamento' },
    ...departments.map(d => ({ value: d.id, label: d.name }))
  ];
  const tagOptions = tags.map(t => ({ value: t.id, label: t.name }));
  const leadStatusOptions = leadStatuses.map(ls => ({ value: ls.name, label: ls.name }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList size={28} className="text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Consultar Atendimentos</h1>
              <p className="text-sm text-muted-foreground">
                Relatório detalhado de todos os atendimentos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Tempo real ativo
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="px-6 py-4 bg-muted/30 border-b border-border">
        <div className="space-y-4">
          {/* Row 1 - Date Range Picker with Quick Buttons + Nome + Contato aligned */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Date Range Picker takes 2 columns */}
            <div className="lg:col-span-2">
              <DateRangePicker
                startDate={filters.startDate}
                endDate={filters.endDate}
                onStartDateChange={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
                onEndDateChange={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
              />
            </div>
            {/* Nome field */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Nome</label>
              <Input
                value={filters.name}
                onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Nome do contato"
                className="h-10"
              />
            </div>
            {/* Contato field */}
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Contato</label>
              <Input
                value={filters.phone}
                onChange={(e) => setFilters(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Telefone"
                className="h-10"
              />
            </div>
          </div>

          {/* Row 2 - Other Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Status do Lead</label>
              <MultiSelect
                options={leadStatusOptions}
                value={filters.leadStatus}
                onChange={(value) => setFilters(prev => ({ ...prev, leadStatus: value }))}
                placeholder="Todos"
                searchable
                searchPlaceholder="Pesquisar status..."
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Status Conversa</label>
              <MultiSelect
                options={conversationStatusOptions}
                value={filters.conversationStatus}
                onChange={(value) => setFilters(prev => ({ ...prev, conversationStatus: value }))}
                placeholder="Todos"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Canal</label>
              <MultiSelect
                options={channelOptions}
                value={filters.channel}
                onChange={(value) => setFilters(prev => ({ ...prev, channel: value }))}
                placeholder="Todos"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Agente</label>
              <MultiSelect
                options={agentOptions}
                value={filters.agent}
                onChange={(value) => setFilters(prev => ({ ...prev, agent: value }))}
                placeholder="Todos"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Departamento</label>
              <MultiSelect
                options={departmentOptions}
                value={filters.department}
                onChange={(value) => setFilters(prev => ({ ...prev, department: value }))}
                placeholder="Todos"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Etiqueta</label>
              <MultiSelect
                options={tagOptions}
                value={filters.tag}
                onChange={(value) => setFilters(prev => ({ ...prev, tag: value }))}
                placeholder="Todas"
                searchable
                searchPlaceholder="Pesquisar etiqueta..."
              />
            </div>

            <div className="flex items-end gap-2">
              <Button onClick={handleSearch} className="flex-1 gap-2">
                <Search size={16} />
                GERAR
              </Button>
              <Button onClick={handlePrint} variant="outline" className="gap-2">
                <Printer size={16} />
              </Button>
              <Button onClick={handleExportExcel} variant="secondary" className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                <FileSpreadsheet size={16} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="px-6 py-4">
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-3 py-3 text-left">
                    <Checkbox checked={selectAll} onCheckedChange={handleSelectAll} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">#</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Nome</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Contato</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Canal</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Agente</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Departamento</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Etiquetas</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Data Abertura</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Data Fechamento</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">1ª Mensagem</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center">
                      <Loader2 size={24} className="animate-spin mx-auto text-primary" />
                      <p className="mt-2 text-sm text-muted-foreground">Carregando atendimentos...</p>
                    </td>
                  </tr>
                ) : reportData?.conversations.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">
                      <ClipboardList size={40} className="mx-auto mb-3 opacity-50" />
                      <p>Nenhum atendimento encontrado</p>
                      <p className="text-sm">Ajuste os filtros e clique em GERAR</p>
                    </td>
                  </tr>
                ) : (
                  reportData?.conversations.map((conv: any) => (
                    <tr key={conv.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-3 py-3">
                        <Checkbox
                          checked={selectedRows.has(conv.id)}
                          onCheckedChange={() => handleSelectRow(conv.id)}
                        />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground font-mono text-xs">{conv.protocol_number}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(conv.status)}
                          <span className="font-medium">{conv.contact?.full_name || '-'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">
                        {formatPhone(conv.contact?.phone)}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{conv.channel?.name || '-'}</td>
                      <td className="px-3 py-3 text-muted-foreground">{conv.assigned_user?.full_name || '-'}</td>
                      <td className="px-3 py-3 text-muted-foreground">{conv.department?.name || '-'}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {conv.tags?.slice(0, 2).map((t: any) => (
                            <span
                              key={t.tag?.id}
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{
                                backgroundColor: `${t.tag?.color || '#8B5CF6'}30`,
                                color: t.tag?.color || '#8B5CF6'
                              }}
                            >
                              {t.tag?.name}
                            </span>
                          ))}
                          {conv.tags && conv.tags.length > 2 && (
                            <span className="text-xs text-muted-foreground">+{conv.tags.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                        {format(new Date(conv.created_at), 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">
                        {conv.closed_at ? format(new Date(conv.closed_at), 'dd/MM/yyyy HH:mm') : '-'}
                      </td>
                      <td className="px-3 py-3 text-muted-foreground max-w-[200px]">
                        <span className="truncate block" title={conv.first_message || ''}>
                          {conv.first_message 
                            ? conv.first_message.length > 50 
                              ? conv.first_message.slice(0, 50) + '...' 
                              : conv.first_message
                            : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setPreviewConversationId(conv.id)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          title="Ver conversa"
                        >
                          <Eye size={16} className="text-muted-foreground hover:text-primary" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {reportData && reportData.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <div className="text-sm text-muted-foreground">
                {selectedRows.size > 0 && (
                  <span className="text-primary mr-4">{selectedRows.size} selecionado(s)</span>
                )}
                Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, reportData.total)} de {reportData.total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft size={16} />
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page} de {reportData.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(reportData.totalPages, p + 1))}
                  disabled={page === reportData.totalPages}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* Summary footer */}
          {reportData && reportData.conversations.length > 0 && (
            <div className="px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
              Total: {reportData.total} atendimento(s) | 
              Última atualização: {format(new Date(), 'HH:mm:ss', { locale: ptBR })}
            </div>
          )}
        </div>
      </div>

      {/* Conversation Preview Dialog */}
      <ConversationPreviewDialog
        conversationId={previewConversationId}
        isOpen={!!previewConversationId}
        onClose={() => setPreviewConversationId(null)}
      />

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedRows.size}
        selectedConversations={selectedConversationsData.map((c: any) => ({
          id: c.id,
          contact_id: c.contact_id,
          status: c.status,
        }))}
        onClearSelection={() => {
          setSelectedRows(new Set());
          setSelectAll(false);
        }}
        onTransfer={() => setBulkTransferModalOpen(true)}
        onClose={() => setBulkCloseModalOpen(true)}
        onAddTag={() => setBulkTagModalOpen(true)}
        onChangeLeadStatus={() => setBulkLeadStatusModalOpen(true)}
        onReopen={handleBulkReopen}
        isLoading={isReopening}
      />

      {/* Bulk Action Modals */}
      <BulkTransferModal
        open={bulkTransferModalOpen}
        onClose={() => setBulkTransferModalOpen(false)}
        conversationIds={Array.from(selectedRows)}
        onTransferSuccess={handleBulkSuccess}
      />

      <BulkCloseModal
        open={bulkCloseModalOpen}
        onClose={() => setBulkCloseModalOpen(false)}
        conversationIds={Array.from(selectedRows)}
        onSuccess={handleBulkSuccess}
      />

      <BulkTagModal
        open={bulkTagModalOpen}
        onClose={() => setBulkTagModalOpen(false)}
        contactIds={selectedContactIds}
        onSuccess={handleBulkSuccess}
      />

      <BulkLeadStatusModal
        open={bulkLeadStatusModalOpen}
        onClose={() => setBulkLeadStatusModalOpen(false)}
        contactIds={selectedContactIds}
        onSuccess={handleBulkSuccess}
      />
    </div>
  );
}
