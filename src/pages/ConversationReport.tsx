import { useState, useEffect } from 'react';
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

interface Filters {
  startDate: string;
  endDate: string;
  name: string;
  phone: string;
  leadStatus: string[];
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
  channel: [],
  agent: [],
  department: [],
  tag: [],
};

export default function ConversationReportPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
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

  // Fetch lead statuses dynamically from contacts table
  const { data: leadStatuses = [] } = useQuery({
    queryKey: ['lead-statuses-filter'],
    queryFn: async () => {
      const { data } = await supabase
        .from('contacts')
        .select('lead_status')
        .not('lead_status', 'is', null);
      
      // Return unique sorted values
      const unique = [...new Set(data?.map(c => c.lead_status))]
        .filter(Boolean)
        .sort() as string[];
      return unique;
    }
  });

  // Fetch report data
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['conversation-report', appliedFilters, page],
    queryFn: async () => {
      let query = supabase
        .from('conversations')
        .select(`
          id,
          status,
          created_at,
          closed_at,
          close_reason,
          lead_status,
          last_message_preview,
          contact:contacts(id, full_name, phone, lead_status),
          assigned_user:profiles!conversations_assigned_to_fkey(id, full_name),
          department:departments(id, name),
          channel:whatsapp_channels(id, name, phone),
          tags:conversation_tags(tag:tags(id, name, color))
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply date filters
      if (appliedFilters.startDate) {
        query = query.gte('created_at', `${appliedFilters.startDate}T00:00:00`);
      }
      if (appliedFilters.endDate) {
        query = query.lte('created_at', `${appliedFilters.endDate}T23:59:59`);
      }
      
      // Apply multi-select filters
      if (appliedFilters.agent.length > 0) {
        query = query.in('assigned_to', appliedFilters.agent);
      }
      if (appliedFilters.department.length > 0) {
        query = query.in('department_id', appliedFilters.department);
      }
      if (appliedFilters.channel.length > 0) {
        query = query.in('channel_id', appliedFilters.channel);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      let filtered = data || [];
      
      // Client-side filtering for name and phone (more flexible search)
      if (appliedFilters.name) {
        const searchLower = appliedFilters.name.toLowerCase();
        filtered = filtered.filter(c => 
          c.contact?.full_name?.toLowerCase().includes(searchLower)
        );
      }
      
      if (appliedFilters.phone) {
        const phoneDigits = appliedFilters.phone.replace(/\D/g, '');
        filtered = filtered.filter(c => 
          c.contact?.phone?.includes(phoneDigits)
        );
      }

      // Filter by lead status (from contact)
      if (appliedFilters.leadStatus.length > 0) {
        filtered = filtered.filter(c => 
          c.contact?.lead_status && appliedFilters.leadStatus.includes(c.contact.lead_status)
        );
      }

      // Filter by tags (multi-select)
      if (appliedFilters.tag.length > 0) {
        filtered = filtered.filter(c => 
          c.tags?.some((t: any) => appliedFilters.tag.includes(t.tag?.id))
        );
      }

      // Fetch first message for each conversation
      const conversationsWithFirstMessage = await Promise.all(
        filtered.map(async (conv) => {
          const { data: firstMsg } = await supabase
            .from('messages')
            .select('content, message_type')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          let firstMessageText = conv.last_message_preview || '';
          if (firstMsg) {
            if (firstMsg.message_type === 'audio') {
              firstMessageText = '[Áudio]';
            } else if (firstMsg.message_type === 'image') {
              firstMessageText = '[Imagem]';
            } else if (firstMsg.message_type === 'video') {
              firstMessageText = '[Vídeo]';
            } else if (firstMsg.message_type === 'document') {
              firstMessageText = '[Documento]';
            } else {
              firstMessageText = firstMsg.content || '';
            }
          }

          return {
            ...conv,
            first_message: firstMessageText,
            protocol_number: conv.id.slice(-6).toUpperCase()
          };
        })
      );

      return {
        conversations: conversationsWithFirstMessage,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
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
  const agentOptions = agents.map(a => ({ value: a.id, label: a.full_name || '' }));
  const departmentOptions = departments.map(d => ({ value: d.id, label: d.name }));
  const tagOptions = tags.map(t => ({ value: t.id, label: t.name }));
  const leadStatusOptions = leadStatuses.map(status => ({ value: status, label: status }));

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
          {/* Date Range Picker with Quick Buttons */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <DateRangePicker
                startDate={filters.startDate}
                endDate={filters.endDate}
                onStartDateChange={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
                onEndDateChange={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Nome</label>
                <Input
                  value={filters.name}
                  onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome do contato"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Contato</label>
                <Input
                  value={filters.phone}
                  onChange={(e) => setFilters(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Telefone"
                />
              </div>
            </div>
          </div>

          {/* Row 2 - Filters */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
                          onClick={() => window.open(`/conversations?id=${conv.id}`, '_blank')}
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
    </div>
  );
}
