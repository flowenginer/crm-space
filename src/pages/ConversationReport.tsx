import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ClipboardList, Search, Calendar, Printer,
  FileSpreadsheet, Loader2, ChevronLeft, ChevronRight, Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';

interface Filters {
  startDate: string;
  endDate: string;
  name: string;
  phone: string;
  status: string;
  channel: string;
  agent: string;
  department: string;
  tag: string;
  closeReason: string;
  leadStatus: string;
}

const initialFilters: Filters = {
  startDate: format(new Date(), 'yyyy-MM-dd'),
  endDate: format(new Date(), 'yyyy-MM-dd'),
  name: '',
  phone: '',
  status: '',
  channel: '',
  agent: '',
  department: '',
  tag: '',
  closeReason: '',
  leadStatus: '',
};

const statusOptions = [
  { value: 'open', label: 'Ativo' },
  { value: 'pending', label: 'Pendente' },
  { value: 'closed', label: 'Fechado' },
];

export default function ConversationReportPage() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const pageSize = 50;

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

  // Fetch report data
  const { data: reportData, isLoading } = useQuery({
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
          contact:contacts(id, full_name, phone, lead_status),
          assigned_user:profiles!conversations_assigned_to_fkey(id, full_name),
          department:departments(id, name),
          channel:whatsapp_channels(id, name, phone),
          tags:conversation_tags(tag:tags(id, name, color))
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (appliedFilters.startDate) {
        query = query.gte('created_at', `${appliedFilters.startDate}T00:00:00`);
      }
      if (appliedFilters.endDate) {
        query = query.lte('created_at', `${appliedFilters.endDate}T23:59:59`);
      }
      if (appliedFilters.status) {
        query = query.eq('status', appliedFilters.status);
      }
      if (appliedFilters.agent) {
        query = query.eq('assigned_to', appliedFilters.agent);
      }
      if (appliedFilters.department) {
        query = query.eq('department_id', appliedFilters.department);
      }
      if (appliedFilters.channel) {
        query = query.eq('channel_id', appliedFilters.channel);
      }
      if (appliedFilters.closeReason) {
        query = query.eq('close_reason', appliedFilters.closeReason);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      let filtered = data || [];
      
      if (appliedFilters.name) {
        const searchLower = appliedFilters.name.toLowerCase();
        filtered = filtered.filter(c => 
          c.contact?.full_name?.toLowerCase().includes(searchLower)
        );
      }
      
      if (appliedFilters.phone) {
        filtered = filtered.filter(c => 
          c.contact?.phone?.includes(appliedFilters.phone)
        );
      }

      if (appliedFilters.tag) {
        filtered = filtered.filter(c => 
          c.tags?.some((t: any) => t.tag?.id === appliedFilters.tag)
        );
      }

      // Fetch first message for each conversation
      const conversationsWithFirstMessage = await Promise.all(
        filtered.map(async (conv) => {
          const { data: firstMsg } = await supabase
            .from('messages')
            .select('content')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          return {
            ...conv,
            first_message: firstMsg?.content || null,
            protocol_number: conv.id.slice(-6).toUpperCase()
          };
        })
      );

      return {
        conversations: conversationsWithFirstMessage,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    }
  });

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    setAppliedFilters(filters);
    setPage(1);
    setSelectedRows(new Set());
    setSelectAll(false);
  };

  const handleReset = () => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
    setSelectedRows(new Set());
    setSelectAll(false);
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
      'Status Lead': conv.contact?.lead_status || '',
      'Etiquetas': conv.tags?.map((t: any) => t.tag?.name).join(', ') || '',
      'Data Abertura': format(new Date(conv.created_at), 'dd/MM/yyyy HH:mm'),
      'Data Fechamento': conv.closed_at ? format(new Date(conv.closed_at), 'dd/MM/yyyy HH:mm') : '',
      'Motivo Fechamento': conv.close_reason || '',
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <ClipboardList size={28} className="text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Consultar Atendimentos</h1>
            <p className="text-sm text-muted-foreground">
              Relatório detalhado de todos os atendimentos
            </p>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="px-6 py-4 bg-muted/30 border-b border-border">
        <div className="space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">De</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Até</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Nome</label>
              <Input
                value={filters.name}
                onChange={(e) => handleFilterChange('name', e.target.value)}
                placeholder="Nome do contato"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Contato</label>
              <Input
                value={filters.phone}
                onChange={(e) => handleFilterChange('phone', e.target.value)}
                placeholder="Telefone"
              />
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Status</label>
              <Select value={filters.status} onValueChange={(v) => handleFilterChange('status', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {statusOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Canal</label>
              <Select value={filters.channel} onValueChange={(v) => handleFilterChange('channel', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {channels.map(ch => (
                    <SelectItem key={ch.id} value={ch.id}>
                      {ch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Agente</label>
              <Select value={filters.agent} onValueChange={(v) => handleFilterChange('agent', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {agents.map(agent => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Departamento</label>
              <Select value={filters.department} onValueChange={(v) => handleFilterChange('department', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {departments.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-xs text-muted-foreground mb-1">Etiqueta</label>
              <Select value={filters.tag} onValueChange={(v) => handleFilterChange('tag', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {tags.map(tag => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: tag.color || '#8B5CF6' }}
                        />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                      <td className="px-3 py-3 text-muted-foreground">{conv.protocol_number}</td>
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
                      <td className="px-3 py-3 text-muted-foreground max-w-[150px]">
                        <span className="truncate block" title={conv.first_message || ''}>
                          {conv.first_message ? conv.first_message.slice(0, 40) + '...' : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => window.open(`/conversations?id=${conv.id}`, '_blank')}
                          className="p-2 hover:bg-muted rounded-lg"
                          title="Ver conversa"
                        >
                          <Eye size={16} className="text-muted-foreground" />
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
        </div>
      </div>
    </div>
  );
}
