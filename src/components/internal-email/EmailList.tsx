import { useState, useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Star, Paperclip, MailOpen, RefreshCw, Archive, Trash2, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useInternalEmails, useToggleEmailStar, useMarkEmailAsRead, useMoveEmailToTrash, useArchiveEmail, type EmailFolder, type InternalEmail } from '@/hooks/useInternalEmail';
import { useBulkEmailActions } from '@/hooks/useBulkEmailActions';
import { Skeleton } from '@/components/ui/skeleton';
import { EmailFilters, EmailFiltersState, defaultFilters } from './EmailFilters';
import { EmailBulkActions } from './EmailBulkActions';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EmailListProps {
  folder: EmailFolder;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectEmail: (emailId: string) => void;
  showFilters?: boolean;
}

const folderTitles: Record<EmailFolder, string> = {
  inbox: 'Caixa de Entrada',
  sent: 'Enviados',
  drafts: 'Rascunhos',
  starred: 'Favoritos',
  archive: 'Arquivados',
  trash: 'Lixeira'
};

function formatEmailDate(dateString: string | null) {
  if (!dateString) return '';
  const date = new Date(dateString);
  
  if (isToday(date)) {
    return format(date, 'HH:mm');
  }
  if (isYesterday(date)) {
    return 'Ontem';
  }
  return format(date, 'dd/MM', { locale: ptBR });
}

// Attachment file type icons for chips
const getAttachmentIcon = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  if (['psd', 'ai', 'cdr'].includes(ext)) return '🎨';
  if (['zip', 'rar', '7z'].includes(ext)) return '📦';
  return '📎';
};

export function EmailList({ folder, searchQuery, onSearchChange, onSelectEmail, showFilters = false }: EmailListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<EmailFiltersState>(defaultFilters);
  const queryClient = useQueryClient();
  
  const { data: emails, isLoading, refetch } = useInternalEmails(folder, searchQuery);
  const toggleStar = useToggleEmailStar();
  const markAsRead = useMarkEmailAsRead();
  const moveToTrash = useMoveEmailToTrash();
  const archiveEmail = useArchiveEmail();
  const bulkActions = useBulkEmailActions();

  // Filter emails based on advanced filters
  const filteredEmails = useMemo(() => {
    if (!emails) return [];
    
    return emails.filter(email => {
      // Date filter
      if (filters.dateFrom) {
        const emailDate = new Date(email.sent_at || email.created_at);
        if (emailDate < filters.dateFrom) return false;
      }
      if (filters.dateTo) {
        const emailDate = new Date(email.sent_at || email.created_at);
        if (emailDate > filters.dateTo) return false;
      }
      
      // Sender filter
      if (filters.senderId && email.sender_id !== filters.senderId) return false;
      
      // Priority filter
      if (filters.priority !== 'all' && email.priority !== filters.priority) return false;
      
      // Read status filter
      if (filters.isRead !== 'all') {
        const isRead = email.recipient_data?.is_read;
        if (filters.isRead === 'read' && !isRead) return false;
        if (filters.isRead === 'unread' && isRead) return false;
      }
      
      return true;
    });
  }, [emails, filters]);

  const handleStarClick = (e: React.MouseEvent, email: InternalEmail) => {
    e.stopPropagation();
    const isCurrentlyStarred = email.recipient_data?.is_starred || false;
    toggleStar.mutate({ emailId: email.id, isStarred: !isCurrentlyStarred });
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
    const ids = Array.from(selectedIds);
    setSelectedIds(new Set()); // Limpa seleção antes da ação
    try {
      await bulkActions.markAsRead(ids);
      toast.success('E-mails marcados como lidos');
    } catch (error) {
      toast.error('Erro ao marcar e-mails como lidos');
    }
  };

  const handleBulkMarkAsUnread = async () => {
    const ids = Array.from(selectedIds);
    setSelectedIds(new Set());
    try {
      await bulkActions.markAsUnread(ids);
      toast.success('E-mails marcados como não lidos');
    } catch (error) {
      toast.error('Erro ao marcar e-mails como não lidos');
    }
  };

  const handleBulkToggleStar = async () => {
    const ids = Array.from(selectedIds);
    setSelectedIds(new Set());
    try {
      await bulkActions.toggleStar(ids, true);
      toast.success('E-mails favoritados');
    } catch (error) {
      toast.error('Erro ao favoritar e-mails');
    }
  };

  const handleBulkArchive = async () => {
    const ids = Array.from(selectedIds);
    setSelectedIds(new Set());
    try {
      await bulkActions.archive(ids);
      toast.success('E-mails arquivados');
    } catch (error) {
      toast.error('Erro ao arquivar e-mails');
    }
  };

  const handleBulkMoveToTrash = async () => {
    const ids = Array.from(selectedIds);
    setSelectedIds(new Set());
    try {
      // Passa true se estamos na pasta "sent" para deletar corretamente
      await bulkActions.moveToTrash(ids, folder === 'sent');
      toast.success('E-mails movidos para a lixeira');
    } catch (error) {
      toast.error('Erro ao mover e-mails para a lixeira');
    }
  };

  const allSelected = filteredEmails?.length > 0 && selectedIds.size === filteredEmails.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < (filteredEmails?.length || 0);

  return (
    <div className="flex-1 flex flex-col">
      {/* Header com busca */}
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{folderTitles[folder]}</h1>
          <div className="flex-1 max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar e-mails..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()} className="h-9 w-9">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {showFilters && (
            <EmailFilters 
              filters={filters} 
              onFiltersChange={setFilters}
              showSharedBoxFilter={true}
            />
          )}
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
            <p className="text-sm">Nenhum e-mail encontrado</p>
          </div>
        ) : (
          <TooltipProvider delayDuration={200}>
            <div className="divide-y divide-border/30">
              {filteredEmails?.map((email) => {
                const isRead = folder === 'sent' || folder === 'drafts' ? true : email.recipient_data?.is_read;
                const isStarred = email.recipient_data?.is_starred;
                const senderName = email.sender?.full_name || 'Desconhecido';
                const dateToShow = email.sent_at || email.updated_at || email.created_at;
                const isSelected = selectedIds.has(email.id);
                const attachments = email.attachments || [];
                const hasAttachments = attachments.length > 0;

                return (
                  <div
                    key={email.id}
                    className={cn(
                      'group flex items-center gap-2 px-3 py-2 cursor-pointer transition-all duration-100',
                      'hover:shadow-sm',
                      !isRead ? 'bg-primary/5 hover:bg-primary/8' : 'hover:bg-muted/50',
                      isSelected && 'bg-primary/10 hover:bg-primary/12'
                    )}
                  >
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

                    {/* Star */}
                    <button
                      onClick={(e) => handleStarClick(e, email)}
                      className={cn(
                        'shrink-0 p-0.5 rounded transition-colors',
                        isStarred ? 'text-yellow-500' : 'text-muted-foreground/40 hover:text-yellow-500'
                      )}
                    >
                      <Star className={cn('h-4 w-4', isStarred && 'fill-current')} />
                    </button>

                    {/* Main content - single line */}
                    <div 
                      className="flex-1 flex items-center gap-3 min-w-0 overflow-hidden"
                      onClick={() => onSelectEmail(email.id)}
                    >
                      {/* Sender name - fixed width */}
                      <span className={cn(
                        'text-sm w-40 shrink-0 truncate',
                        !isRead ? 'font-semibold text-foreground' : 'text-muted-foreground'
                      )}>
                        {senderName}
                      </span>

                      {/* Subject and preview */}
                      <div className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden">
                        <span className={cn(
                          'text-sm truncate shrink-0 max-w-[300px]',
                          !isRead ? 'font-medium text-foreground' : 'text-foreground/80'
                        )}>
                          {email.subject}
                        </span>
                        <span className="text-sm text-muted-foreground/60 truncate hidden sm:inline">
                          — {email.body.substring(0, 60)}
                        </span>
                      </div>

                      {/* Attachment chips */}
                      {hasAttachments && (
                        <div className="flex items-center gap-1 shrink-0">
                          {attachments.slice(0, 2).map((att: any, idx: number) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-muted/80 rounded text-muted-foreground"
                              title={att.file_name}
                            >
                              <span>{getAttachmentIcon(att.file_name)}</span>
                              <span className="max-w-[60px] truncate">{att.file_name}</span>
                            </span>
                          ))}
                          {attachments.length > 2 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{attachments.length - 2}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Hover actions */}
                    <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isRead) {
                                markAsRead.mutate(email.id);
                                toast.success('Marcado como lido');
                              }
                            }}
                          >
                            {isRead ? <Mail className="h-4 w-4" /> : <MailOpen className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {isRead ? 'Já lido' : 'Marcar como lido'}
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Date - always visible */}
                    <span className="text-xs text-muted-foreground shrink-0 w-12 text-right">
                      {formatEmailDate(dateToShow)}
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
