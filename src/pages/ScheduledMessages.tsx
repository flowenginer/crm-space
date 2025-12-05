import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  CalendarClock, Search, Trash2, Edit3, Eye, Send,
  Clock, User, CheckCircle, XCircle,
  AlertCircle, Loader2, Calendar, ChevronLeft, ChevronRight,
  RefreshCw, Mic, Paperclip, FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Status configuration
const statusConfig = {
  scheduled: { label: 'Pendente', color: 'bg-amber-500', textColor: 'text-amber-500', icon: Clock },
  sent: { label: 'Enviada', color: 'bg-green-500', textColor: 'text-green-500', icon: CheckCircle },
  failed: { label: 'Falhou', color: 'bg-red-500', textColor: 'text-red-500', icon: XCircle },
  cancelled: { label: 'Cancelada', color: 'bg-muted-foreground', textColor: 'text-muted-foreground', icon: XCircle },
};

interface ScheduledMessage {
  id: string;
  content: string | null;
  scheduled_for: string;
  status: string | null;
  message_type: string | null;
  media_url: string | null;
  created_by: string | null;
  contact_id: string | null;
  contact?: { id: string; full_name: string; phone: string } | null;
  created_by_user?: { id: string; full_name: string | null; avatar_url: string | null } | null;
  channel?: { id: string; name: string; phone: string } | null;
}

export default function ScheduledMessagesPage() {
  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  
  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 20;
  
  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ScheduledMessage | null>(null);
  
  const queryClient = useQueryClient();

  // Realtime subscription for automatic updates
  useEffect(() => {
    const channel = supabase
      .channel('scheduled-messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_messages'
        },
        (payload) => {
          console.log('Scheduled message updated:', payload);
          // Invalidate queries to refetch data
          queryClient.invalidateQueries({ queryKey: ['all-scheduled-messages'] });
          queryClient.invalidateQueries({ queryKey: ['scheduled-messages-stats'] });
          queryClient.invalidateQueries({ queryKey: ['pending-scheduled-count'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch scheduled messages with auto-refresh every 30 seconds
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['all-scheduled-messages', statusFilter, dateFilter, agentFilter, search, page],
    queryFn: async () => {
      let query = supabase
        .from('scheduled_messages')
        .select(`
          *,
          contact:contacts(id, full_name, phone),
          created_by_user:profiles!scheduled_messages_created_by_fkey(id, full_name, avatar_url),
          channel:whatsapp_channels(id, name, phone)
        `, { count: 'exact' })
        .order('scheduled_for', { ascending: true });

      // Status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Date filter
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      if (dateFilter === 'today') {
        query = query.gte('scheduled_for', today.toISOString())
                     .lt('scheduled_for', tomorrow.toISOString());
      } else if (dateFilter === 'tomorrow') {
        const dayAfter = new Date(tomorrow);
        dayAfter.setDate(dayAfter.getDate() + 1);
        query = query.gte('scheduled_for', tomorrow.toISOString())
                     .lt('scheduled_for', dayAfter.toISOString());
      } else if (dateFilter === 'week') {
        query = query.gte('scheduled_for', today.toISOString())
                     .lt('scheduled_for', nextWeek.toISOString());
      } else if (dateFilter === 'past') {
        query = query.lt('scheduled_for', now.toISOString());
      }

      // Agent filter
      if (agentFilter !== 'all') {
        query = query.eq('created_by', agentFilter);
      }

      // Pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      // Client-side search filter
      let filtered = data || [];
      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(msg => 
          msg.contact?.full_name?.toLowerCase().includes(searchLower) ||
          msg.contact?.phone?.includes(search) ||
          msg.content?.toLowerCase().includes(searchLower)
        );
      }

      return {
        messages: filtered as ScheduledMessage[],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch team members for filter
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team-members-filter'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data;
    }
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['scheduled-messages-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('status');
      
      if (error) throw error;

      const counts = {
        total: data.length,
        scheduled: data.filter(m => m.status === 'scheduled').length,
        sent: data.filter(m => m.status === 'sent').length,
        failed: data.filter(m => m.status === 'failed').length,
        cancelled: data.filter(m => m.status === 'cancelled').length,
      };

      return counts;
    }
  });

  // Cancel message
  const cancelMessage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_messages')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-scheduled-messages'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-scheduled-count'] });
      toast.success('Agendamento cancelado');
    },
    onError: () => {
      toast.error('Erro ao cancelar');
    }
  });

  // Delete message
  const deleteMessage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('scheduled_messages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-scheduled-messages'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages-stats'] });
      queryClient.invalidateQueries({ queryKey: ['pending-scheduled-count'] });
      toast.success('Mensagem excluída');
    },
    onError: () => {
      toast.error('Erro ao excluir');
    }
  });

  // Send now
  const sendNow = useMutation({
    mutationFn: async (message: ScheduledMessage) => {
      const { error } = await supabase
        .from('scheduled_messages')
        .update({ 
          scheduled_for: new Date().toISOString(),
          status: 'scheduled'
        })
        .eq('id', message.id);
      if (error) throw error;
      
      toast.info('Mensagem será enviada em instantes');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-scheduled-messages'] });
    }
  });

  // Format helpers
  const formatScheduledDate = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) {
      return `Hoje, ${format(d, 'HH:mm')}`;
    }
    if (isTomorrow(d)) {
      return `Amanhã, ${format(d, 'HH:mm')}`;
    }
    return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const formatPhone = (phone: string | undefined) => {
    if (!phone) return '-';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13 && digits.startsWith('55')) {
      const local = digits.slice(2);
      return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    }
    return phone;
  };

  const truncateMessage = (msg: string | null | undefined, length = 50) => {
    if (!msg) return '-';
    return msg.length > length ? msg.slice(0, length) + '...' : msg;
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarClock size={28} className="text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Mensagens Agendadas</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie todos os agendamentos de mensagens
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-primary/20 rounded-xl">
              <Clock size={18} className="text-primary" />
              <span className="text-primary font-semibold">
                {stats?.scheduled || 0} pendentes
              </span>
            </div>
            
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
            >
              <RefreshCw size={18} />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-card rounded-xl p-4 border border-border">
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </div>
          <div 
            className={`bg-card rounded-xl p-4 border cursor-pointer transition-colors ${
              statusFilter === 'scheduled' ? 'border-amber-500' : 'border-border hover:border-muted-foreground'
            }`}
            onClick={() => setStatusFilter(statusFilter === 'scheduled' ? 'all' : 'scheduled')}
          >
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-amber-500">{stats?.scheduled || 0}</div>
              <Clock size={20} className="text-amber-500" />
            </div>
            <div className="text-sm text-muted-foreground">Pendentes</div>
          </div>
          <div 
            className={`bg-card rounded-xl p-4 border cursor-pointer transition-colors ${
              statusFilter === 'sent' ? 'border-green-500' : 'border-border hover:border-muted-foreground'
            }`}
            onClick={() => setStatusFilter(statusFilter === 'sent' ? 'all' : 'sent')}
          >
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-green-500">{stats?.sent || 0}</div>
              <CheckCircle size={20} className="text-green-500" />
            </div>
            <div className="text-sm text-muted-foreground">Enviadas</div>
          </div>
          <div 
            className={`bg-card rounded-xl p-4 border cursor-pointer transition-colors ${
              statusFilter === 'failed' ? 'border-red-500' : 'border-border hover:border-muted-foreground'
            }`}
            onClick={() => setStatusFilter(statusFilter === 'failed' ? 'all' : 'failed')}
          >
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-red-500">{stats?.failed || 0}</div>
              <AlertCircle size={20} className="text-red-500" />
            </div>
            <div className="text-sm text-muted-foreground">Falharam</div>
          </div>
          <div 
            className={`bg-card rounded-xl p-4 border cursor-pointer transition-colors ${
              statusFilter === 'cancelled' ? 'border-muted-foreground' : 'border-border hover:border-muted-foreground'
            }`}
            onClick={() => setStatusFilter(statusFilter === 'cancelled' ? 'all' : 'cancelled')}
          >
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-muted-foreground">{stats?.cancelled || 0}</div>
              <XCircle size={20} className="text-muted-foreground" />
            </div>
            <div className="text-sm text-muted-foreground">Canceladas</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[250px] max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por contato ou mensagem..."
              className="pl-10"
            />
          </div>

          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-40">
              <Calendar size={16} className="mr-2 text-muted-foreground" />
              <SelectValue placeholder="Data" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as datas</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="tomorrow">Amanhã</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="past">Passadas</SelectItem>
            </SelectContent>
          </Select>

          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-48">
              <User size={16} className="mr-2 text-muted-foreground" />
              <SelectValue placeholder="Atendente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os atendentes</SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {member.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(statusFilter !== 'all' || dateFilter !== 'all' || agentFilter !== 'all' || search) && (
            <Button
              variant="ghost"
              onClick={() => {
                setStatusFilter('all');
                setDateFilter('all');
                setAgentFilter('all');
                setSearch('');
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-4">
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Data
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Contato
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Telefone
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Atendente
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Mensagem
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Loader2 size={24} className="animate-spin mx-auto text-primary" />
                    </td>
                  </tr>
                ) : data?.messages.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <CalendarClock size={40} className="mx-auto mb-3 opacity-50" />
                      <p>Nenhuma mensagem agendada</p>
                    </td>
                  </tr>
                ) : (
                  data?.messages.map((msg) => {
                    const config = statusConfig[msg.status as keyof typeof statusConfig] || statusConfig.scheduled;
                    const StatusIcon = config.icon;
                    const isExpired = msg.status === 'scheduled' && isPast(new Date(msg.scheduled_for));

                    return (
                      <tr key={msg.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            {formatScheduledDate(msg.scheduled_for)}
                          </div>
                          {isExpired && (
                            <span className="text-xs text-red-500">Atrasada</span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-sm font-medium">
                            {msg.contact?.full_name || 'Desconhecido'}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-sm text-muted-foreground">
                            {formatPhone(msg.contact?.phone)}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-sm text-muted-foreground">
                            {msg.created_by_user?.full_name || '-'}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <span className={`
                            inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                            ${config.textColor} bg-current/10
                          `}>
                            <StatusIcon size={12} />
                            {config.label}
                          </span>
                        </td>

                        <td className="px-4 py-3 max-w-xs">
                          <div className="flex items-center gap-2">
                            {msg.message_type === 'audio' && (
                              <Mic size={14} className="text-primary flex-shrink-0" />
                            )}
                            {msg.message_type === 'image' && (
                              <Paperclip size={14} className="text-blue-500 flex-shrink-0" />
                            )}
                            {msg.message_type === 'document' && (
                              <FileText size={14} className="text-amber-500 flex-shrink-0" />
                            )}
                            <span className="text-sm text-muted-foreground truncate">
                              {msg.content ? truncateMessage(msg.content) : (
                                <span className="italic">
                                  {msg.message_type === 'audio' ? 'Áudio' : 
                                   msg.message_type === 'image' ? 'Imagem' : 
                                   msg.message_type === 'document' ? 'Documento' : '-'}
                                </span>
                              )}
                            </span>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setSelectedMessage(msg);
                                setShowViewModal(true);
                              }}
                              className="p-2 hover:bg-muted rounded-lg transition-colors"
                              title="Ver detalhes"
                            >
                              <Eye size={16} className="text-muted-foreground" />
                            </button>

                            {msg.status === 'scheduled' && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedMessage(msg);
                                    setShowEditModal(true);
                                  }}
                                  className="p-2 hover:bg-primary/20 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Edit3 size={16} className="text-primary" />
                                </button>

                                <button
                                  onClick={() => sendNow.mutate(msg)}
                                  className="p-2 hover:bg-green-500/20 rounded-lg transition-colors"
                                  title="Enviar agora"
                                >
                                  <Send size={16} className="text-green-500" />
                                </button>

                                <button
                                  onClick={() => cancelMessage.mutate(msg.id)}
                                  className="p-2 hover:bg-amber-500/20 rounded-lg transition-colors"
                                  title="Cancelar"
                                >
                                  <XCircle size={16} className="text-amber-500" />
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => {
                                if (confirm('Excluir esta mensagem agendada?')) {
                                  deleteMessage.mutate(msg.id);
                                }
                              }}
                              className="p-2 hover:bg-destructive/20 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={16} className="text-destructive" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Mostrando {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, data.total)} de {data.total}
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
                  Página {page} de {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                >
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* View Modal */}
      <ViewMessageModal
        open={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedMessage(null);
        }}
        message={selectedMessage}
      />

      {/* Edit Modal */}
      <EditScheduledMessageModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedMessage(null);
        }}
        message={selectedMessage}
      />
    </div>
  );
}

// View Message Modal
function ViewMessageModal({ open, onClose, message }: { open: boolean; onClose: () => void; message: ScheduledMessage | null }) {
  if (!message) return null;

  const config = statusConfig[message.status as keyof typeof statusConfig] || statusConfig.scheduled;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes do Agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold">
              {message.contact?.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="font-medium">{message.contact?.full_name}</div>
              <div className="text-sm text-muted-foreground">{message.contact?.phone}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground">Data Agendada</label>
              <div>
                {format(new Date(message.scheduled_for), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Status</label>
              <div className={`flex items-center gap-1 ${config.textColor}`}>
                <config.icon size={14} />
                {config.label}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Agendado por</label>
            <div>{message.created_by_user?.full_name || '-'}</div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Mensagem</label>
            <div className="p-3 bg-muted rounded-lg text-muted-foreground whitespace-pre-wrap">
              {message.content || (
                <span className="italic">
                  {message.message_type === 'audio' ? '🎵 Áudio anexado' :
                   message.message_type === 'image' ? '📷 Imagem anexada' :
                   message.message_type === 'document' ? '📄 Documento anexado' : 'Sem conteúdo'}
                </span>
              )}
            </div>
          </div>

          {message.media_url && (
            <div>
              <label className="text-xs text-muted-foreground">Mídia</label>
              {message.message_type === 'audio' && (
                <audio src={message.media_url} controls className="w-full mt-1" />
              )}
              {message.message_type === 'image' && (
                <img src={message.media_url} alt="Anexo" className="w-full rounded-lg mt-1" />
              )}
              {message.message_type === 'document' && (
                <a 
                  href={message.media_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 bg-muted rounded-lg text-primary hover:text-primary/80 mt-1"
                >
                  <FileText size={16} />
                  Ver documento
                </a>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Edit Scheduled Message Modal
function EditScheduledMessageModal({ open, onClose, message }: { open: boolean; onClose: () => void; message: ScheduledMessage | null }) {
  const [content, setContent] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (message) {
      setContent(message.content || '');
      const date = new Date(message.scheduled_for);
      setScheduledDate(date.toISOString().split('T')[0]);
      setScheduledTime(date.toTimeString().slice(0, 5));
    }
  }, [message]);

  const handleSave = async () => {
    if (!scheduledDate || !scheduledTime) {
      toast.error('Selecione data e hora');
      return;
    }

    if (!message) return;

    setIsLoading(true);
    try {
      const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`);

      const { error } = await supabase
        .from('scheduled_messages')
        .update({
          content,
          scheduled_for: scheduledFor.toISOString()
        })
        .eq('id', message.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['all-scheduled-messages'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-messages-stats'] });
      toast.success('Agendamento atualizado!');
      onClose();
    } catch (error) {
      toast.error('Erro ao atualizar');
    } finally {
      setIsLoading(false);
    }
  };

  if (!message) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Agendamento</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Data</label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Hora</label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Mensagem</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" size={16} /> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
