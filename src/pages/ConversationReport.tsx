import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

function getTimezoneOffset(): string {
  const offset = new Date().getTimezoneOffset();
  const sign = offset <= 0 ? '+' : '-';
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  ClipboardList, Search, Printer,
  FileSpreadsheet, Loader2, ChevronLeft, ChevronRight, Eye, RefreshCw,
  Settings2, GripVertical, AlertCircle, X
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
import { useUserChannels } from '@/hooks/useUserChannels';
import { BulkLeadStatusModal } from '@/components/conversations/BulkLeadStatusModal';
import { BulkRescueModal } from '@/components/conversations/BulkRescueModal';
import { useBulkReopenConversations } from '@/hooks/useBulkConversationActions';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ---- Column Definition Types ----
type ColumnDef = {
  key: string;
  label: string;
  enabled: boolean;
};

const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'protocol_number', label: '#', enabled: true },
  { key: 'contact_full_name', label: 'Nome', enabled: true },
  { key: 'contact_phone', label: 'Contato', enabled: true },
  { key: 'contact_origin', label: 'Origem', enabled: true },
  { key: 'referral_source_app', label: 'Plataforma Anúncio', enabled: true },
  { key: 'referral_source_url', label: 'URL Anúncio', enabled: true },
  { key: 'contact_lead_status', label: 'Status do Lead', enabled: true },
  { key: 'channel_name', label: 'Canal', enabled: true },
  { key: 'agent_name', label: 'Agente', enabled: true },
  { key: 'department_name', label: 'Departamento', enabled: true },
  { key: 'tags', label: 'Etiquetas', enabled: true },
  { key: 'status', label: 'Status Conversa', enabled: true },
  { key: 'close_reason', label: 'Motivo Fechamento', enabled: true },
  { key: 'created_at', label: 'Data Abertura', enabled: true },
  { key: 'closed_at', label: 'Data Fechamento', enabled: true },
  { key: 'first_message', label: '1ª Mensagem', enabled: true },
  { key: 'first_response_time', label: 'Tempo 1º Atendimento', enabled: false },
  { key: 'total_active_time', label: 'Tempo Total Atendimento', enabled: false },
  { key: 'sent_messages_count', label: 'Msgs Enviadas', enabled: false },
  { key: 'received_messages_count', label: 'Msgs Recebidas', enabled: false },
  { key: 'lead_score', label: 'Score do Lead', enabled: false },
  { key: 'internal_notes', label: 'Notas Internas', enabled: false },
];

function mergeWithDefaults(saved: ColumnDef[]): ColumnDef[] {
  const keys = saved.map(c => c.key);
  const newCols = DEFAULT_COLUMNS.filter(c => !keys.includes(c.key));
  return [...saved, ...newCols];
}

// ---- Sortable Column Item ----
function SortableColumnItem({ col, onToggle }: { col: ColumnDef; onToggle: (key: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
        <GripVertical size={16} />
      </div>
      <Checkbox
        checked={col.enabled}
        onCheckedChange={() => onToggle(col.key)}
        id={`col-${col.key}`}
      />
      <label htmlFor={`col-${col.key}`} className="text-sm cursor-pointer flex-1">{col.label}</label>
    </div>
  );
}

// ---- Main Component ----
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

const conversationStatusOptions = [
  { value: 'open', label: 'Ativo' },
  { value: 'pending', label: 'Pendente' },
  { value: 'closed', label: 'Fechado' },
];

const formatOrigin = (origin: string | null | undefined) => {
  if (!origin) return 'Não identificado';
  const origins: Record<string, string> = {
    'meta_ads': 'Meta Ads',
    'whatsapp': 'Orgânico (WhatsApp)',
    'manual': 'Manual',
    'import': 'Importação'
  };
  return origins[origin] || origin;
};

function getFieldValue(conv: any, key: string): any {
  switch (key) {
    case 'protocol_number': return conv.protocol_number;
    case 'contact_full_name': return conv.contact?.full_name || '';
    case 'contact_phone': return conv.contact?.phone || '';
    case 'contact_origin': return formatOrigin(conv.contact?.origin);
    case 'referral_source_app': return conv.referral_source_app || '';
    case 'referral_source_url': return conv.referral_source_url || '';
    case 'contact_lead_status': return conv.contact?.lead_status || '';
    case 'channel_name': return conv.channel?.name || '';
    case 'agent_name': return conv.assigned_user?.full_name || '';
    case 'department_name': return conv.department?.name || '';
    case 'tags': return conv.tags?.map((t: any) => t.tag?.name).join(', ') || '';
    case 'status': return conv.status === 'open' ? 'Ativo' : conv.status === 'pending' ? 'Pendente' : 'Fechado';
    case 'close_reason': return conv.close_reason || '';
    case 'created_at': return conv.created_at ? format(new Date(conv.created_at), 'dd/MM/yyyy HH:mm') : '';
    case 'closed_at': return conv.closed_at ? format(new Date(conv.closed_at), 'dd/MM/yyyy HH:mm') : '';
    case 'first_message': return conv.first_message || '';
    case 'first_response_time': {
      if (!conv.first_response_at || !conv.created_at) return '-';
      const diffMs = new Date(conv.first_response_at).getTime() - new Date(conv.created_at).getTime();
      if (diffMs < 0) return '-';
      const mins = Math.floor(diffMs / 60000);
      if (mins < 60) return `${mins} min`;
      const hrs = Math.floor(mins / 60);
      const remaining = mins % 60;
      return `${hrs}h ${remaining}min`;
    }
    case 'total_active_time': {
      const secs = conv.total_active_time_seconds;
      if (!secs) return '-';
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    case 'sent_messages_count': return conv.sent_messages_count ?? '-';
    case 'received_messages_count': return conv.received_messages_count ?? '-';
    case 'lead_score': return conv.contact?.lead_score ?? '-';
    case 'internal_notes': return conv.internal_notes_text || '-';
    default: return '';
  }
}

export default function ConversationReportPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewConversationId, setPreviewConversationId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Column config state — starts with defaults, will be overwritten once DB data loads
  const [columnConfig, setColumnConfig] = useState<ColumnDef[]>(DEFAULT_COLUMNS.map(c => ({ ...c })));
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bulk action modals
  const [bulkTransferModalOpen, setBulkTransferModalOpen] = useState(false);
  const [bulkCloseModalOpen, setBulkCloseModalOpen] = useState(false);
  const [bulkTagModalOpen, setBulkTagModalOpen] = useState(false);
  const [bulkLeadStatusModalOpen, setBulkLeadStatusModalOpen] = useState(false);
  const [bulkRescueModalOpen, setBulkRescueModalOpen] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

  const bulkReopen = useBulkReopenConversations();
  const pageSize = 50;

  // DnD sensors for column reordering
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Load user preferences from DB
  const { data: userProfile } = useQuery({
    queryKey: ['profile-preferences'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('id', user.id)
        .single();
      return data;
    }
  });

  // Populate column config from DB preferences once loaded
  useEffect(() => {
    if (userProfile?.preferences) {
      const prefs = userProfile.preferences as any;
      if (Array.isArray(prefs.report_columns)) {
        setColumnConfig(mergeWithDefaults(prefs.report_columns));
      }
    }
  }, [userProfile]);

  // Save preferences mutation (debounced)
  const savePreferencesMutation = useMutation({
    mutationFn: async (cols: ColumnDef[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const currentPrefs = (userProfile?.preferences as any) || {};
      await supabase
        .from('profiles')
        .update({ preferences: { ...currentPrefs, report_columns: cols } })
        .eq('id', user.id);
    }
  });

  // Debounced save to DB when columnConfig changes (skip initial render)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      savePreferencesMutation.mutate(columnConfig);
    }, 800);
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnConfig]);

  // Setup realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('conversation-report-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['conversation-report'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        queryClient.invalidateQueries({ queryKey: ['conversation-report'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Fetch filter options
  const userChannels = useUserChannels();
  const channels = userChannels.map(ch => ({ id: ch.id, name: ch.name, phone: ch.phone }));

  const { data: agents = [] } = useQuery({
    queryKey: ['agents-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('is_active', true).order('full_name');
      return data || [];
    }
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('departments').select('id, name').eq('is_active', true).order('name');
      return data || [];
    }
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('tags').select('id, name, color').order('name');
      return data || [];
    }
  });

  const { data: leadStatuses = [] } = useQuery({
    queryKey: ['lead-statuses-filter'],
    queryFn: async () => {
      const { data } = await supabase.from('lead_statuses').select('id, name, color').eq('is_active', true).order('order_position');
      return data || [];
    }
  });

  // Fetch report data
  // Se o usuário tem canais restritos, sempre força o filtro (mesmo sem seleção explícita)
  const allowedChannelIds = useMemo(() => channels.map(ch => ch.id), [channels]);
  const getEffectiveChannelIds = (selectedChannels: string[]) => {
    if (selectedChannels.length > 0) return selectedChannels;
    // Se o usuário tem restrição de canais, força o filtro
    if (allowedChannelIds.length > 0) return allowedChannelIds;
    return null;
  };

  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['conversation-report', appliedFilters, page],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_conversations_report', {
        p_start_date: appliedFilters.startDate ? `${appliedFilters.startDate}T00:00:00${getTimezoneOffset()}` : null,
        p_end_date: appliedFilters.endDate ? `${appliedFilters.endDate}T23:59:59${getTimezoneOffset()}` : null,
        p_name: appliedFilters.name || null,
        p_phone: appliedFilters.phone || null,
        p_lead_status: appliedFilters.leadStatus.length > 0 ? appliedFilters.leadStatus : null,
        p_channel_ids: getEffectiveChannelIds(appliedFilters.channel),
        p_agent_ids: appliedFilters.agent.length > 0 ? appliedFilters.agent : null,
        p_department_ids: appliedFilters.department.length > 0 ? appliedFilters.department : null,
        p_tag_ids: appliedFilters.tag.length > 0 ? appliedFilters.tag : null,
        p_conversation_status: appliedFilters.conversationStatus.length > 0 ? appliedFilters.conversationStatus : null,
        p_page: page,
        p_page_size: pageSize
      });
      if (error) throw error;
      const total = data?.[0]?.total_count || 0;
      const conversations = (data || []).map((row: any) => ({
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
        first_response_at: row.first_response_at,
        total_active_time_seconds: row.total_active_time_seconds,
        sent_messages_count: row.sent_messages_count,
        received_messages_count: row.received_messages_count,
        referral_source_app: row.referral_source_app || '',
        referral_source_url: row.referral_source_url || '',
        internal_notes_text: row.internal_notes_text || '',
        contact: {
          full_name: row.contact_full_name,
          phone: row.contact_phone,
          lead_status: row.contact_lead_status,
          origin: row.contact_origin,
          lead_score: row.contact_lead_score,
        },
        channel: { name: row.channel_name },
        assigned_user: { full_name: row.agent_name },
        department: { name: row.department_name },
        first_message: row.first_message || '',
        protocol_number: row.id.slice(-6).toUpperCase(),
        tags: []
      }));

      if (conversations.length > 0) {
        const contactIds = [...new Set(conversations.map((c: any) => c.contact_id))];
        const { data: tagsData } = await supabase
          .from('contact_tags')
          .select('contact_id, tag:tags(id, name, color)')
          .in('contact_id', contactIds);
        if (tagsData) {
          const tagsByContact = tagsData.reduce((acc: any, item: any) => {
            if (!acc[item.contact_id]) acc[item.contact_id] = [];
            acc[item.contact_id].push({ tag: item.tag });
            return acc;
          }, {});
          conversations.forEach((conv: any) => { conv.tags = tagsByContact[conv.contact_id] || []; });
        }
      }
      return { conversations, total: Number(total), totalPages: Math.ceil(Number(total) / pageSize) };
    },
    refetchOnWindowFocus: false,
  });

  const handleSearch = () => {
    setAppliedFilters(filters);
    setPage(1);
    setSelectedRows(new Set());
    setSelectAll(false);
    setSelectAllPages(false);
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
    const allOnPage = reportData?.conversations.length === newSelected.size;
    setSelectAll(allOnPage);
    if (!allOnPage) setSelectAllPages(false);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRows(new Set());
      setSelectAll(false);
      setSelectAllPages(false);
    } else {
      setSelectedRows(new Set(reportData?.conversations.map((c: any) => c.id) || []));
      setSelectAll(true);
    }
  };

  const handleSelectAllPages = () => {
    setSelectAllPages(true);
  };

  const handleCancelSelectAllPages = () => {
    setSelectAllPages(false);
    setSelectedRows(new Set());
    setSelectAll(false);
  };

  const selectedConversationsData = useMemo(() => {
    if (!reportData?.conversations) return [];
    return reportData.conversations.filter((c: any) => selectedRows.has(c.id));
  }, [reportData, selectedRows]);

  const selectedContactIds = useMemo(() => {
    return [...new Set(selectedConversationsData.map((c: any) => c.contact_id))];
  }, [selectedConversationsData]);

  const handleBulkSuccess = () => {
    setSelectedRows(new Set());
    setSelectAll(false);
    setSelectAllPages(false);
  };

  const handleBulkReopen = async () => {
    const closedConversations = selectedConversationsData.filter((c: any) => c.status === 'closed');
    if (closedConversations.length === 0) {
      toast.error('Nenhuma conversa fechada selecionada');
      return;
    }
    setIsReopening(true);
    try {
      const result = await bulkReopen.mutateAsync({ conversationIds: closedConversations.map((c: any) => c.id) });
      if (result.success > 0 && result.failed === 0) toast.success(`${result.success} conversa(s) reaberta(s) com sucesso`);
      else if (result.success > 0 && result.failed > 0) toast.warning(`${result.success} reaberta(s), ${result.failed} falhou(aram)`);
      else toast.error('Falha ao reabrir conversas');
      handleBulkSuccess();
    } catch (error: any) {
      console.error('[ConversationReport] Reopen error:', error);
      toast.error('Erro ao reabrir conversas');
    } finally {
      setIsReopening(false);
    }
  };

  // Export with column config and cross-page support
  const handleExportExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      let dataToExport: any[] = [];

      if (selectAllPages && reportData?.total) {
        toast.info(`Buscando todos os ${reportData.total} registros...`);
        const { data, error } = await supabase.rpc('search_conversations_report', {
          p_start_date: appliedFilters.startDate ? `${appliedFilters.startDate}T00:00:00${getTimezoneOffset()}` : null,
          p_end_date: appliedFilters.endDate ? `${appliedFilters.endDate}T23:59:59${getTimezoneOffset()}` : null,
          p_name: appliedFilters.name || null,
          p_phone: appliedFilters.phone || null,
          p_lead_status: appliedFilters.leadStatus.length > 0 ? appliedFilters.leadStatus : null,
          p_channel_ids: getEffectiveChannelIds(appliedFilters.channel),
          p_agent_ids: appliedFilters.agent.length > 0 ? appliedFilters.agent : null,
          p_department_ids: appliedFilters.department.length > 0 ? appliedFilters.department : null,
          p_tag_ids: appliedFilters.tag.length > 0 ? appliedFilters.tag : null,
          p_conversation_status: appliedFilters.conversationStatus.length > 0 ? appliedFilters.conversationStatus : null,
          p_page: 1,
          p_page_size: reportData.total
        });
        if (error) throw error;

        dataToExport = (data || []).map((row: any) => ({
          id: row.id,
          contact_id: row.contact_id,
          status: row.status,
          created_at: row.created_at,
          closed_at: row.closed_at,
          close_reason: row.close_reason,
          first_response_at: row.first_response_at,
          total_active_time_seconds: row.total_active_time_seconds,
          sent_messages_count: row.sent_messages_count,
          received_messages_count: row.received_messages_count,
          referral_source_app: row.referral_source_app || '',
          referral_source_url: row.referral_source_url || '',
          internal_notes_text: row.internal_notes_text || '',
          contact: { full_name: row.contact_full_name, phone: row.contact_phone, lead_status: row.contact_lead_status, origin: row.contact_origin, lead_score: row.contact_lead_score },
          channel: { name: row.channel_name },
          assigned_user: { full_name: row.agent_name },
          department: { name: row.department_name },
          first_message: row.first_message || '',
          protocol_number: row.id.slice(-6).toUpperCase(),
          tags: []
        }));

        // Fetch tags for all contacts in conversations
        if (dataToExport.length > 0) {
          const contactIds = [...new Set(dataToExport.map((c: any) => c.contact_id))];
          // Fetch in batches of 500
          const batches = [];
          for (let i = 0; i < contactIds.length; i += 500) batches.push(contactIds.slice(i, i + 500));
          const tagsByContact: Record<string, any[]> = {};
          for (const batch of batches) {
            const { data: tagsData } = await supabase.from('contact_tags').select('contact_id, tag:tags(id, name, color)').in('contact_id', batch);
            if (tagsData) {
              tagsData.forEach((item: any) => {
                if (!tagsByContact[item.contact_id]) tagsByContact[item.contact_id] = [];
                tagsByContact[item.contact_id].push({ tag: item.tag });
              });
            }
          }
          dataToExport.forEach((conv: any) => { conv.tags = tagsByContact[conv.contact_id] || []; });
        }
      } else {
        const source = selectedRows.size > 0
          ? reportData?.conversations.filter((c: any) => selectedRows.has(c.id))
          : reportData?.conversations;
        dataToExport = source || [];
      }

      if (!dataToExport.length) {
        toast.error('Nenhum dado para exportar');
        return;
      }

      const activeColumns = columnConfig.filter(col => col.enabled);
      if (activeColumns.length === 0) {
        toast.error('Selecione pelo menos uma coluna para exportar');
        return;
      }

      const excelData = dataToExport.map((conv: any) =>
        Object.fromEntries(activeColumns.map(col => [col.label, getFieldValue(conv, col.key)]))
      );

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Atendimentos');
      const colWidths = activeColumns.map(col => ({ wch: Math.max(col.label.length, 15) }));
      worksheet['!cols'] = colWidths;

      const fileName = `atendimentos_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success(`Arquivo Excel gerado com ${dataToExport.length} registro(s)!`);
    } catch (error: any) {
      console.error('[ConversationReport] Export error:', error);
      toast.error('Erro ao gerar o arquivo Excel');
    } finally {
      setIsExporting(false);
    }
  }, [selectAllPages, reportData, selectedRows, appliedFilters, columnConfig]);

  const handlePrint = () => { window.print(); };

  const formatPhone = (phone: string | null | undefined) => {
    if (!phone) return '-';
    const digits = phone.replace(/\D/g, '');
    if (digits.length >= 12) return digits.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 ($2) $3-$4');
    if (digits.length >= 10) return digits.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
    return phone;
  };

  const getStatusBadge = (status: string | null) => {
    const config: Record<string, { label: string; color: string }> = {
      open: { label: 'Ativo', color: 'bg-green-500' },
      pending: { label: 'Pendente', color: 'bg-amber-500' },
      closed: { label: 'Fechado', color: 'bg-muted-foreground' },
    };
    const { label, color } = config[status || 'closed'] || config.closed;
    return <span className={`px-2 py-0.5 rounded text-xs text-white ${color}`}>{label}</span>;
  };

  // Column settings handlers
  const handleColumnToggle = (key: string) => {
    setColumnConfig(prev => prev.map(col => col.key === key ? { ...col, enabled: !col.enabled } : col));
  };

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumnConfig(prev => {
        const oldIndex = prev.findIndex(c => c.key === active.id);
        const newIndex = prev.findIndex(c => c.key === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleResetColumns = () => {
    setColumnConfig(DEFAULT_COLUMNS.map(c => ({ ...c })));
  };

  // Cross-page selection banner visibility
  const showSelectAllPagesBanner = selectAll && !selectAllPages && reportData && reportData.total > pageSize;

  const channelOptions = channels.map(ch => ({ value: ch.id, label: ch.name }));
  const agentOptions = [{ value: 'no_agent', label: '⚠️ Sem agente' }, ...agents.map(a => ({ value: a.id, label: a.full_name || '' }))];
  const departmentOptions = [{ value: 'no_department', label: '⚠️ Sem departamento' }, ...departments.map(d => ({ value: d.id, label: d.name }))];
  const tagOptions = tags.map(t => ({ value: t.id, label: t.name }));
  const leadStatusOptions = leadStatuses.map(ls => ({ value: ls.name, label: ls.name }));

  const effectiveSelectedCount = selectAllPages ? (reportData?.total || 0) : selectedRows.size;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList size={28} className="text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Consultar Atendimentos</h1>
              <p className="text-sm text-muted-foreground">Relatório detalhado de todos os atendimentos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Tempo real ativo
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="px-6 py-4 bg-muted/30 border-b border-border">
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <DateRangePicker
                startDate={filters.startDate}
                endDate={filters.endDate}
                onStartDateChange={(date) => setFilters(prev => ({ ...prev, startDate: date }))}
                onEndDateChange={(date) => setFilters(prev => ({ ...prev, endDate: date }))}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Nome</label>
              <Input value={filters.name} onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))} placeholder="Nome do contato" className="h-10" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Contato</label>
              <Input value={filters.phone} onChange={(e) => setFilters(prev => ({ ...prev, phone: e.target.value }))} placeholder="Telefone" className="h-10" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Status do Lead</label>
              <MultiSelect options={leadStatusOptions} value={filters.leadStatus} onChange={(value) => setFilters(prev => ({ ...prev, leadStatus: value }))} placeholder="Todos" searchable searchPlaceholder="Pesquisar status..." />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Status Conversa</label>
              <MultiSelect options={conversationStatusOptions} value={filters.conversationStatus} onChange={(value) => setFilters(prev => ({ ...prev, conversationStatus: value }))} placeholder="Todos" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Canal</label>
              <MultiSelect options={channelOptions} value={filters.channel} onChange={(value) => setFilters(prev => ({ ...prev, channel: value }))} placeholder="Todos" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Agente</label>
              <MultiSelect options={agentOptions} value={filters.agent} onChange={(value) => setFilters(prev => ({ ...prev, agent: value }))} placeholder="Todos" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Departamento</label>
              <MultiSelect options={departmentOptions} value={filters.department} onChange={(value) => setFilters(prev => ({ ...prev, department: value }))} placeholder="Todos" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Etiqueta</label>
              <MultiSelect options={tagOptions} value={filters.tag} onChange={(value) => setFilters(prev => ({ ...prev, tag: value }))} placeholder="Todas" searchable searchPlaceholder="Pesquisar etiqueta..." />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleSearch} className="flex-1 gap-2">
                <Search size={16} />
                GERAR
              </Button>
              <Button onClick={handlePrint} variant="outline" className="gap-2">
                <Printer size={16} />
              </Button>
              <div className="flex items-center gap-1">
                <Button
                  onClick={handleExportExcel}
                  variant="secondary"
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  disabled={isExporting}
                  title="Exportar para Excel"
                >
                  {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                </Button>
                <Button
                  onClick={() => setShowColumnSettings(true)}
                  variant="outline"
                  size="icon"
                  className="h-10 w-10"
                  title="Configurar colunas do export"
                >
                  <Settings2 size={16} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="px-6 py-4">
        <div className="bg-card rounded-xl border border-border overflow-hidden">

          {/* Cross-page select all banner */}
          {showSelectAllPagesBanner && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                <AlertCircle size={16} className="shrink-0" />
                <span>
                  <strong>{pageSize} atendimentos</strong> desta página selecionados.
                  Há <strong>{reportData.total}</strong> atendimentos no filtro atual.
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="default"
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
                  onClick={handleSelectAllPages}
                >
                  Selecionar todos os {reportData.total}
                </Button>
                <button onClick={handleCancelSelectAllPages} className="text-amber-700 dark:text-amber-300 hover:text-amber-900">
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Active cross-page selection indicator */}
          {selectAllPages && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-primary/10 border-b border-primary/20">
              <div className="flex items-center gap-2 text-sm text-primary">
                <AlertCircle size={16} className="shrink-0" />
                <span>Todos os <strong>{reportData?.total}</strong> atendimentos do filtro atual estão selecionados.</span>
              </div>
              <button onClick={handleCancelSelectAllPages} className="text-primary hover:text-primary/70 text-xs flex items-center gap-1">
                <X size={14} />
                Cancelar
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-3 py-3 text-left">
                    <Checkbox checked={selectAll} onCheckedChange={handleSelectAll} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">#</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Nome</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Contato</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Origem</th>
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
                    <td colSpan={13} className="px-4 py-12 text-center">
                      <Loader2 size={24} className="animate-spin mx-auto text-primary" />
                      <p className="mt-2 text-sm text-muted-foreground">Carregando atendimentos...</p>
                    </td>
                  </tr>
                ) : reportData?.conversations.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-12 text-center text-muted-foreground">
                      <ClipboardList size={40} className="mx-auto mb-3 opacity-50" />
                      <p>Nenhum atendimento encontrado</p>
                      <p className="text-sm">Ajuste os filtros e clique em GERAR</p>
                    </td>
                  </tr>
                ) : (
                  reportData?.conversations.map((conv: any) => (
                    <tr key={conv.id} className={`hover:bg-muted/50 transition-colors ${selectedRows.has(conv.id) || selectAllPages ? 'bg-primary/5' : ''}`}>
                      <td className="px-3 py-3">
                        <Checkbox checked={selectAllPages || selectedRows.has(conv.id)} onCheckedChange={() => { if (!selectAllPages) handleSelectRow(conv.id); }} />
                      </td>
                      <td className="px-3 py-3 text-muted-foreground font-mono text-xs">{conv.protocol_number}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(conv.status)}
                          <span className="font-medium">{conv.contact?.full_name || '-'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground">{formatPhone(conv.contact?.phone)}</td>
                      <td className="px-3 py-3 text-muted-foreground">{formatOrigin(conv.contact?.origin)}</td>
                      <td className="px-3 py-3 text-muted-foreground">{conv.channel?.name || '-'}</td>
                      <td className="px-3 py-3 text-muted-foreground">{conv.assigned_user?.full_name || '-'}</td>
                      <td className="px-3 py-3 text-muted-foreground">{conv.department?.name || '-'}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {conv.tags?.slice(0, 2).map((t: any) => (
                            <span key={t.tag?.id} className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: `${t.tag?.color || '#8B5CF6'}30`, color: t.tag?.color || '#8B5CF6' }}>
                              {t.tag?.name}
                            </span>
                          ))}
                          {conv.tags && conv.tags.length > 2 && (
                            <span className="text-xs text-muted-foreground">+{conv.tags.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{format(new Date(conv.created_at), 'dd/MM/yyyy HH:mm')}</td>
                      <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{conv.closed_at ? format(new Date(conv.closed_at), 'dd/MM/yyyy HH:mm') : '-'}</td>
                      <td className="px-3 py-3 text-muted-foreground max-w-[200px]">
                        <span className="truncate block" title={conv.first_message || ''}>
                          {conv.first_message ? (conv.first_message.length > 50 ? conv.first_message.slice(0, 50) + '...' : conv.first_message) : '-'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <button onClick={() => setPreviewConversationId(conv.id)} className="p-2 hover:bg-muted rounded-lg transition-colors" title="Ver conversa">
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
                {effectiveSelectedCount > 0 && (
                  <span className="text-primary mr-4">
                    {selectAllPages ? `Todos os ${effectiveSelectedCount}` : effectiveSelectedCount} selecionado(s)
                  </span>
                )}
                Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, reportData.total)} de {reportData.total}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft size={16} />
                </Button>
                <span className="text-sm text-muted-foreground">Página {page} de {reportData.totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(reportData.totalPages, p + 1))} disabled={page === reportData.totalPages}>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}

          {/* Summary footer */}
          {reportData && reportData.conversations.length > 0 && (
            <div className="px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
              Total: {reportData.total} atendimento(s) | Última atualização: {format(new Date(), 'HH:mm:ss', { locale: ptBR })}
            </div>
          )}
        </div>
      </div>

      {/* Conversation Preview Dialog */}
      <ConversationPreviewDialog conversationId={previewConversationId} isOpen={!!previewConversationId} onClose={() => setPreviewConversationId(null)} />

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={effectiveSelectedCount}
        selectedConversations={selectAllPages ? [] : selectedConversationsData.map((c: any) => ({ id: c.id, contact_id: c.contact_id, status: c.status }))}
        onClearSelection={() => { setSelectedRows(new Set()); setSelectAll(false); setSelectAllPages(false); }}
        onTransfer={() => setBulkTransferModalOpen(true)}
        onClose={() => setBulkCloseModalOpen(true)}
        onAddTag={() => setBulkTagModalOpen(true)}
        onChangeLeadStatus={() => setBulkLeadStatusModalOpen(true)}
        onReopen={handleBulkReopen}
        onRescue={() => setBulkRescueModalOpen(true)}
        isLoading={isReopening}
      />

      {/* Bulk Action Modals */}
      <BulkTransferModal open={bulkTransferModalOpen} onClose={() => setBulkTransferModalOpen(false)} conversationIds={Array.from(selectedRows)} onTransferSuccess={handleBulkSuccess} />
      <BulkCloseModal open={bulkCloseModalOpen} onClose={() => setBulkCloseModalOpen(false)} conversationIds={Array.from(selectedRows)} onSuccess={handleBulkSuccess} />
      <BulkTagModal open={bulkTagModalOpen} onClose={() => setBulkTagModalOpen(false)} contactIds={selectedContactIds} onSuccess={handleBulkSuccess} />
      <BulkLeadStatusModal open={bulkLeadStatusModalOpen} onClose={() => setBulkLeadStatusModalOpen(false)} contactIds={selectedContactIds} onSuccess={handleBulkSuccess} />
      <BulkRescueModal open={bulkRescueModalOpen} onClose={() => setBulkRescueModalOpen(false)} conversationIds={Array.from(selectedRows)} onSuccess={handleBulkSuccess} />

      {/* Column Settings Dialog */}
      <Dialog open={showColumnSettings} onOpenChange={setShowColumnSettings}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 size={18} />
              Configurar Colunas do Export
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Marque as colunas que deseja incluir no Excel e arraste para reordenar.</p>

          <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
              <SortableContext items={columnConfig.map(c => c.key)} strategy={verticalListSortingStrategy}>
                {columnConfig.map(col => (
                  <SortableColumnItem key={col.key} col={col} onToggle={handleColumnToggle} />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border">
            <Button variant="ghost" size="sm" onClick={handleResetColumns} className="text-muted-foreground text-xs">
              Restaurar padrão
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{columnConfig.filter(c => c.enabled).length} coluna(s) ativas</span>
              <Button size="sm" onClick={() => setShowColumnSettings(false)}>Fechar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
