import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone,
  Plus,
  X,
  Calendar,
  Clock,
  MessageSquare,
  Filter,
  Trash2,
  Edit2,
  Send,
  PhoneMissed,
  PhoneCall,
  PhoneOff,
  PhoneForwarded,
  Voicemail,
  Check,
  User,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import {
  useCallLogs,
  useCallResults,
  useCreateCallLog,
  useUpdateCallLog,
  useDeleteCallLog,
  CallLog,
} from '@/hooks/useCallLogs';

interface CallLogModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: {
    id: string;
    full_name: string;
    phone: string;
  } | null;
  conversationId?: string | null;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  PhoneMissed,
  PhoneCall,
  PhoneOff,
  PhoneForwarded,
  Voicemail,
  Check,
  Phone,
};

export function CallLogModal({ open, onOpenChange, contact, conversationId }: CallLogModalProps) {
  const [filterResultId, setFilterResultId] = useState<string>('all');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');
  const [newResultId, setNewResultId] = useState<string>('');
  const [scheduleFollowup, setScheduleFollowup] = useState(false);
  const [followupDate, setFollowupDate] = useState<Date | undefined>();
  const [followupMessage, setFollowupMessage] = useState('');

  const { data: callLogs = [], isLoading } = useCallLogs(contact?.id || null);
  const { data: callResults = [] } = useCallResults();
  const createCallLog = useCreateCallLog();
  const updateCallLog = useUpdateCallLog();
  const deleteCallLog = useDeleteCallLog();

  const filteredLogs = filterResultId === 'all'
    ? callLogs
    : callLogs.filter(log => log.result_id === filterResultId);

  const handleAddNew = () => {
    setIsAddingNew(true);
    setNewNote('');
    setNewResultId('');
    setScheduleFollowup(false);
    setFollowupDate(undefined);
    setFollowupMessage('');
  };

  const handleSaveNew = async () => {
    if (!contact) return;

    await createCallLog.mutateAsync({
      contact_id: contact.id,
      conversation_id: conversationId || null,
      result_id: newResultId || null,
      notes: newNote || undefined,
      schedule_followup: scheduleFollowup,
      followup_date: followupDate?.toISOString() || null,
      followup_message: followupMessage || null,
    });

    setIsAddingNew(false);
    setNewNote('');
    setNewResultId('');
    setScheduleFollowup(false);
    setFollowupDate(undefined);
    setFollowupMessage('');
  };

  const handleEdit = (log: CallLog) => {
    setEditingId(log.id);
    setNewResultId(log.result_id || '');
    setNewNote(log.notes || '');
    setScheduleFollowup(log.schedule_followup);
    setFollowupDate(log.followup_date ? new Date(log.followup_date) : undefined);
    setFollowupMessage(log.followup_message || '');
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    await updateCallLog.mutateAsync({
      id: editingId,
      result_id: newResultId || null,
      notes: newNote || null,
      schedule_followup: scheduleFollowup,
      followup_date: followupDate?.toISOString() || null,
      followup_message: followupMessage || null,
    });

    setEditingId(null);
    setNewNote('');
    setNewResultId('');
    setScheduleFollowup(false);
    setFollowupDate(undefined);
    setFollowupMessage('');
  };

  const handleDelete = async (log: CallLog) => {
    if (confirm('Tem certeza que deseja excluir este registro?')) {
      await deleteCallLog.mutateAsync({ id: log.id, contactId: log.contact_id });
    }
  };

  const getResultIcon = (iconName: string | undefined) => {
    const Icon = iconMap[iconName || 'Phone'] || Phone;
    return Icon;
  };

  const stats = {
    total: callLogs.length,
    answered: callLogs.filter(l => l.result?.name?.includes('Atendeu')).length,
    noAnswer: callLogs.filter(l => l.result?.name === 'Não atendeu').length,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Phone className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <DialogTitle className="text-lg">Gestor de Ligações</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {contact?.full_name} • {contact?.phone}
                </p>
              </div>
            </div>
            
            {/* Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="text-center">
                <p className="font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-green-500">{stats.answered}</p>
                <p className="text-xs text-muted-foreground">Atendidas</p>
              </div>
              <div className="text-center">
                <p className="font-bold text-red-500">{stats.noAnswer}</p>
                <p className="text-xs text-muted-foreground">Não atendeu</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar */}
        <div className="px-6 py-3 border-b flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterResultId} onValueChange={setFilterResultId}>
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="Filtrar por resultado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os resultados</SelectItem>
                {callResults.map(result => (
                  <SelectItem key={result.id} value={result.id}>
                    {result.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleAddNew} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Registrar Ligação
          </Button>
        </div>

        {/* Table */}
        <ScrollArea className="flex-1">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[120px]">Data</TableHead>
                <TableHead className="w-[80px]">Hora</TableHead>
                <TableHead className="w-[200px]">Resultado</TableHead>
                <TableHead>Observações</TableHead>
                <TableHead className="w-[120px]">Agente</TableHead>
                <TableHead className="w-[80px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* New entry row */}
              {isAddingNew && (
                <TableRow className="bg-green-500/5 border-green-500/20">
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Clock className="h-3 w-3" />
                      {format(new Date(), 'HH:mm')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={newResultId} onValueChange={setNewResultId}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {callResults.map(result => {
                          const Icon = getResultIcon(result.icon);
                          return (
                            <SelectItem key={result.id} value={result.id}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" style={{ color: result.color }} />
                                {result.name}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <Input
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Observações..."
                        className="h-8"
                      />
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={scheduleFollowup}
                            onChange={(e) => setScheduleFollowup(e.target.checked)}
                            className="rounded"
                          />
                          Agendar retorno
                        </label>
                        {scheduleFollowup && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" size="sm" className="h-6 text-xs">
                                {followupDate ? format(followupDate, 'dd/MM HH:mm') : 'Data'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <CalendarComponent
                                mode="single"
                                selected={followupDate}
                                onSelect={setFollowupDate}
                                locale={ptBR}
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      Você
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7"
                        onClick={() => setIsAddingNew(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="h-7 w-7 text-green-500 hover:text-green-600"
                        onClick={handleSaveNew}
                        disabled={createCallLog.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {/* Existing logs */}
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {callLogs.length === 0 
                      ? 'Nenhuma ligação registrada ainda. Clique em "Registrar Ligação" para começar.'
                      : 'Nenhum resultado encontrado com esse filtro.'}
                  </TableCell>
                </TableRow>
              ) : filteredLogs.map((log) => {
                const isEditing = editingId === log.id;
                const ResultIcon = getResultIcon(log.result?.icon);

                return (
                  <TableRow key={log.id} className={cn(isEditing && 'bg-amber-500/5')}>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(log.call_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {log.call_time.substring(0, 5)}
                      </div>
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Select value={newResultId} onValueChange={setNewResultId}>
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {callResults.map(result => {
                              const Icon = getResultIcon(result.icon);
                              return (
                                <SelectItem key={result.id} value={result.id}>
                                  <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4" style={{ color: result.color }} />
                                    {result.name}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      ) : log.result ? (
                        <Badge
                          variant="outline"
                          className="gap-1"
                          style={{ 
                            borderColor: log.result.color,
                            color: log.result.color,
                            backgroundColor: `${log.result.color}10`
                          }}
                        >
                          <ResultIcon className="h-3 w-3" />
                          {log.result.name}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Observações..."
                          className="h-8"
                        />
                      ) : (
                        <div className="space-y-1">
                          <p className="text-sm">{log.notes || '-'}</p>
                          {log.schedule_followup && log.followup_date && (
                            <Badge variant="secondary" className="text-xs gap-1">
                              <Send className="h-3 w-3" />
                              Retorno: {format(new Date(log.followup_date), 'dd/MM HH:mm')}
                            </Badge>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <User className="h-3 w-3" />
                        {log.user?.full_name || 'N/A'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-green-500 hover:text-green-600"
                            onClick={handleSaveEdit}
                            disabled={updateCallLog.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7"
                            onClick={() => handleEdit(log)}
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(log)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
