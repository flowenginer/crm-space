import { useState, useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Star, Hand, RefreshCw, Archive, Trash2, MailOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useSharedBoxEmails, useClaimEmail, useUserSharedBoxes } from '@/hooks/useSharedEmailBoxes';
import { useBulkEmailActions } from '@/hooks/useBulkEmailActions';
import { useArchiveEmail, useMoveEmailToTrash } from '@/hooks/useInternalEmail';
import { EmailBulkActions } from './EmailBulkActions';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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

const statusConfig = {
  pending: { label: 'Aguardando', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  completed: { label: 'Concluído', color: 'bg-green-500/10 text-green-600 border-green-500/30' }
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
  const moveToTrash = useMoveEmailToTrash();
  const archiveEmail = useArchiveEmail();

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
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <h2 className="text-lg font-semibold">{currentBox?.name || 'Caixa Compartilhada'}</h2>
            <p className="text-sm text-muted-foreground">{folderTitles[statusFilter]}</p>
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar e-mails..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()} className="h-9 w-9">
            <RefreshCw className="h-4 w-4" />
          </Button>
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

      {/* Lista de e-mails - Layout compacto estilo Gmail */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="divide-y divide-border/50">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 h-10">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 flex-1 max-w-md" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        ) : filteredEmails?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <MailOpen className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">
              {statusFilter === 'pending' 
                ? 'Nenhum e-mail aguardando atendimento'
                : statusFilter === 'in_progress'
                ? 'Nenhum e-mail em andamento'
                : 'Nenhum e-mail encontrado'
              }
            </p>
          </div>
        ) : (
          <TooltipProvider delayDuration={200}>
            <div className="divide-y divide-border/30">
              {filteredEmails?.map((email) => {
                const senderName = email.sender?.full_name || 'Desconhecido';
                const workflowStatus = email.workflow_status as keyof typeof statusConfig;
                const isSelected = selectedIds.has(email.id);
                const isPending = !email.claimed_by;

                return (
                  <div
                    key={email.id}
                    className={cn(
                      'group flex items-center gap-2 px-3 py-2 cursor-pointer transition-all duration-100',
                      'hover:shadow-sm',
                      isPending 
                        ? 'bg-amber-500/8 border-l-2 border-amber-500 hover:bg-amber-500/12' 
                        : 'border-l-2 border-transparent hover:bg-muted/50',
                      isSelected && 'bg-primary/10 hover:bg-primary/12'
                    )}
                  >
                    {/* Pending indicator (amber dot) */}
                    <div className="shrink-0 w-2 flex justify-center">
                      {isPending && (
                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      )}
                    </div>

                    {/* Checkbox */}
                    <div 
                      className="shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleCheckboxChange(email.id, checked as boolean)}
                        className="h-4 w-4"
                      />
                    </div>

                    {/* Star placeholder for alignment */}
                    <div className="shrink-0 w-5" />

                    {/* Main content - single line */}
                    <div 
                      className="flex-1 flex items-center gap-3 min-w-0 overflow-hidden"
                      onClick={() => onSelectEmail(email.id)}
                    >
                      {/* Sender name - fixed width */}
                      <span className={cn(
                        'text-sm w-36 shrink-0 truncate',
                        isPending ? 'font-bold text-foreground' : 'text-muted-foreground'
                      )}>
                        {senderName}
                      </span>

                      {/* Subject and preview */}
                      <div className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden">
                        <span className={cn(
                          'text-sm truncate shrink-0 max-w-[240px]',
                          isPending ? 'font-semibold text-foreground' : 'text-foreground/80'
                        )}>
                          {email.subject}
                        </span>
                        <span className="text-sm text-muted-foreground/60 truncate hidden sm:inline">
                          — {email.body?.substring(0, 50)}
                        </span>
                      </div>

                      {/* Status badge - compact */}
                      <Badge 
                        variant="outline" 
                        className={cn(
                          'text-[10px] h-5 px-1.5 shrink-0',
                          statusConfig[workflowStatus]?.color
                        )}
                      >
                        {statusConfig[workflowStatus]?.label}
                      </Badge>
                    </div>

                    {/* Hover actions */}
                    <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isPending && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                              onClick={(e) => handleClaim(e, email.id)}
                              disabled={claimEmail.isPending}
                            >
                              <Hand className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Assumir</TooltipContent>
                        </Tooltip>
                      )}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              archiveEmail.mutate(email.id);
                              toast.success('E-mail arquivado');
                            }}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Arquivar</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              moveToTrash.mutate(email.id);
                              toast.success('E-mail movido para lixeira');
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">Excluir</TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Date - always visible */}
                    <span className="text-xs text-muted-foreground shrink-0 w-12 text-right">
                      {email.sent_at && formatEmailDate(email.sent_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        )}
      </ScrollArea>
    </div>
  );
}
