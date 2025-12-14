import { useState, useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Star, Paperclip, Clock, User, CheckCircle2, Hand, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useSharedBoxEmails, useClaimEmail, useUserSharedBoxes } from '@/hooks/useSharedEmailBoxes';
import { useBulkEmailActions } from '@/hooks/useBulkEmailActions';
import { EmailBulkActions } from './EmailBulkActions';
import { toast } from 'sonner';

interface SharedBoxEmailListProps {
  sharedBoxId: string;
  statusFilter: 'pending' | 'in_progress' | 'completed' | 'all';
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectEmail: (emailId: string) => void;
}

function formatEmailDate(date: string) {
  const d = new Date(date);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Ontem';
  return format(d, 'dd/MM', { locale: ptBR });
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const priorityColors: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive',
  normal: 'hidden',
  low: 'bg-muted text-muted-foreground'
};

const statusConfig = {
  pending: { label: 'Aguardando', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: Clock },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: User },
  completed: { label: 'Concluído', color: 'bg-green-500/10 text-green-600 border-green-500/30', icon: CheckCircle2 }
};

const folderTitles: Record<string, string> = {
  pending: 'Aguardando Atendimento',
  in_progress: 'Em Andamento',
  completed: 'Concluídos',
  all: 'Todos os E-mails'
};

export function SharedBoxEmailList({
  sharedBoxId,
  statusFilter,
  searchQuery,
  onSearchChange,
  onSelectEmail
}: SharedBoxEmailListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { data: emails, isLoading, refetch } = useSharedBoxEmails(sharedBoxId, statusFilter);
  const { data: sharedBoxes } = useUserSharedBoxes();
  const claimEmail = useClaimEmail();
  const bulkActions = useBulkEmailActions();

  const currentBox = sharedBoxes?.find(b => b.id === sharedBoxId);

  // Filtrar por busca
  const filteredEmails = useMemo(() => {
    if (!emails) return [];
    if (!searchQuery) return emails;
    
    const query = searchQuery.toLowerCase();
    return emails.filter(email => (
      email.subject?.toLowerCase().includes(query) ||
      email.body?.toLowerCase().includes(query) ||
      email.sender?.full_name?.toLowerCase().includes(query)
    ));
  }, [emails, searchQuery]);

  const handleClaim = async (e: React.MouseEvent, emailId: string) => {
    e.stopPropagation();
    try {
      await claimEmail.mutateAsync(emailId);
      toast.success('E-mail assumido com sucesso!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao assumir e-mail');
    }
  };

  const handleCheckboxChange = (emailId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(emailId);
    } else {
      newSelected.delete(emailId);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredEmails?.map(e => e.id) || []));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkMarkAsRead = async () => {
    try {
      await bulkActions.markAsRead(Array.from(selectedIds));
      toast.success('E-mails marcados como lidos');
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Erro ao marcar e-mails como lidos');
    }
  };

  const handleBulkMarkAsUnread = async () => {
    try {
      await bulkActions.markAsUnread(Array.from(selectedIds));
      toast.success('E-mails marcados como não lidos');
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Erro ao marcar e-mails como não lidos');
    }
  };

  const handleBulkToggleStar = async () => {
    try {
      await bulkActions.toggleStar(Array.from(selectedIds), true);
      toast.success('E-mails favoritados');
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Erro ao favoritar e-mails');
    }
  };

  const handleBulkArchive = async () => {
    try {
      await bulkActions.archive(Array.from(selectedIds));
      toast.success('E-mails arquivados');
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Erro ao arquivar e-mails');
    }
  };

  const handleBulkMoveToTrash = async () => {
    try {
      await bulkActions.moveToTrash(Array.from(selectedIds));
      toast.success('E-mails movidos para a lixeira');
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Erro ao mover e-mails para a lixeira');
    }
  };

  const allSelected = filteredEmails?.length > 0 && selectedIds.size === filteredEmails.length;

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{currentBox?.name || 'Caixa Compartilhada'}</h2>
            <p className="text-sm text-muted-foreground">{folderTitles[statusFilter]}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()} className="h-9 w-9">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar e-mails..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        
        {/* Select all checkbox */}
        {filteredEmails && filteredEmails.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={allSelected}
              onCheckedChange={handleSelectAll}
              className="h-4 w-4"
            />
            <span className="text-xs">
              {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
            </span>
            <span className="text-xs text-muted-foreground/60">
              ({filteredEmails.length} e-mail{filteredEmails.length > 1 ? 's' : ''})
            </span>
          </div>
        )}
      </div>

      {/* Bulk actions bar */}
      <EmailBulkActions
        selectedCount={selectedIds.size}
        onMarkAsRead={handleBulkMarkAsRead}
        onMarkAsUnread={handleBulkMarkAsUnread}
        onToggleStar={handleBulkToggleStar}
        onArchive={handleBulkArchive}
        onMoveToTrash={handleBulkMoveToTrash}
        onClearSelection={() => setSelectedIds(new Set())}
        isLoading={bulkActions.isLoading}
      />

      {/* Lista de e-mails */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-48" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2.5 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEmails?.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            {statusFilter === 'pending' 
              ? 'Nenhum e-mail aguardando atendimento'
              : statusFilter === 'in_progress'
              ? 'Nenhum e-mail em andamento'
              : 'Nenhum e-mail encontrado'
            }
          </div>
        ) : (
          <div>
            {filteredEmails?.map((email) => {
              const senderName = email.sender?.full_name || 'Desconhecido';
              const workflowStatus = email.workflow_status as keyof typeof statusConfig;
              const StatusIcon = statusConfig[workflowStatus]?.icon || Clock;
              const claimedByName = email.claimed_by_user?.full_name;
              const isSelected = selectedIds.has(email.id);

              return (
                <div
                  key={email.id}
                  className={cn(
                    'group flex items-start gap-3 px-4 py-3 cursor-pointer transition-all duration-150 border-b border-border/50',
                    'hover:bg-muted/50',
                    !email.claimed_by && 'bg-amber-500/5',
                    isSelected && 'bg-primary/10'
                  )}
                >
                  {/* Checkbox */}
                  <div 
                    className="pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => handleCheckboxChange(email.id, checked as boolean)}
                      className="h-4 w-4"
                    />
                  </div>

                  {/* Avatar do remetente */}
                  <Avatar 
                    className="h-9 w-9 flex-shrink-0"
                    onClick={() => onSelectEmail(email.id)}
                  >
                    <AvatarImage src={email.sender?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-muted">{getInitials(senderName)}</AvatarFallback>
                  </Avatar>

                  {/* Conteúdo */}
                  <div 
                    className="flex-1 min-w-0"
                    onClick={() => onSelectEmail(email.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{senderName}</p>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {email.sent_at && formatEmailDate(email.sent_at)}
                      </span>
                    </div>
                    <p className="text-sm truncate font-medium mt-0.5">{email.subject}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {email.body?.substring(0, 80)}
                    </p>

                    {/* Badges e Status */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {/* Status do workflow */}
                      <Badge variant="outline" className={cn('text-[10px] h-5 gap-1', statusConfig[workflowStatus]?.color)}>
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig[workflowStatus]?.label}
                      </Badge>

                      {/* Quem assumiu */}
                      {claimedByName && (
                        <Badge variant="outline" className="text-[10px] h-5 gap-1">
                          <User className="h-3 w-3" />
                          {claimedByName}
                        </Badge>
                      )}

                      {/* Prioridade */}
                      {email.priority !== 'normal' && (
                        <Badge variant="outline" className={cn('text-[10px] h-5', priorityColors[email.priority])}>
                          {email.priority === 'high' ? 'Alta' : 'Baixa'}
                        </Badge>
                      )}

                      {/* Categoria */}
                      {email.category && email.category !== 'general' && (
                        <Badge variant="outline" className="text-[10px] h-5">
                          {email.category === 'layout_request' ? 'Layout' : email.category}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Ação de assumir (apenas para pendentes) */}
                  {!email.claimed_by && statusFilter === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 gap-1 text-xs h-8"
                      onClick={(e) => handleClaim(e, email.id)}
                      disabled={claimEmail.isPending}
                    >
                      <Hand className="h-3.5 w-3.5" />
                      Assumir
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
