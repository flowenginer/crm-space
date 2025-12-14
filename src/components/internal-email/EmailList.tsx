import { useState, useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Star, Paperclip, MailOpen, Mail, RefreshCw, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useInternalEmails, useToggleEmailStar, useMarkEmailAsRead, useMoveEmailToTrash, useArchiveEmail, type EmailFolder, type InternalEmail } from '@/hooks/useInternalEmail';
import { useBulkEmailActions } from '@/hooks/useBulkEmailActions';
import { Skeleton } from '@/components/ui/skeleton';
import { EmailFilters, EmailFiltersState, defaultFilters } from './EmailFilters';
import { EmailBulkActions } from './EmailBulkActions';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

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

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const priorityColors = {
  low: 'bg-muted text-muted-foreground',
  normal: 'hidden',
  high: 'bg-destructive/10 text-destructive'
};

const categoryColors: Record<string, string> = {
  'layout_request': 'bg-amber-500/10 text-amber-600',
  'layout_delivery': 'bg-emerald-500/10 text-emerald-600',
  'general': 'hidden'
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

      {/* Lista de e-mails */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-1/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-2.5 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredEmails?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <MailOpen className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">Nenhum e-mail encontrado</p>
          </div>
        ) : (
          <div>
            {filteredEmails?.map((email) => {
              const isRead = folder === 'sent' || folder === 'drafts' ? true : email.recipient_data?.is_read;
              const isStarred = email.recipient_data?.is_starred;
              const senderName = email.sender?.full_name || 'Desconhecido';
              const dateToShow = email.sent_at || email.updated_at || email.created_at;
              const isSelected = selectedIds.has(email.id);

              return (
                <div
                  key={email.id}
                  className={cn(
                    'group flex items-start gap-3 px-4 py-3 cursor-pointer transition-all duration-150 border-b border-border/50',
                    'hover:bg-muted/50',
                    !isRead && 'bg-primary/5',
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

                  {/* Unread indicator */}
                  <div className={cn(
                    'w-1 h-full min-h-[40px] rounded-full shrink-0 self-stretch',
                    !isRead ? 'bg-primary' : 'bg-transparent'
                  )} />

                  {/* Avatar */}
                  <Avatar 
                    className="h-9 w-9 shrink-0"
                    onClick={() => onSelectEmail(email.id)}
                  >
                    <AvatarImage src={email.sender?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs bg-muted">
                      {getInitials(senderName)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Conteúdo */}
                  <div 
                    className="flex-1 min-w-0"
                    onClick={() => onSelectEmail(email.id)}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className={cn(
                        'text-sm truncate',
                        !isRead ? 'font-semibold' : 'font-medium'
                      )}>
                        {senderName}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatEmailDate(dateToShow)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={cn(
                        'text-sm truncate',
                        !isRead ? 'font-medium' : 'text-muted-foreground'
                      )}>
                        {email.subject}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground/80 truncate">
                      {email.body.substring(0, 80)}
                    </p>

                    {/* Badges */}
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {email.priority !== 'normal' && (
                        <Badge variant="outline" className={cn('text-[10px] h-5', priorityColors[email.priority])}>
                          {email.priority === 'high' ? 'Alta' : 'Baixa'}
                        </Badge>
                      )}
                      {email.category && email.category !== 'general' && (
                        <Badge variant="outline" className={cn('text-[10px] h-5', categoryColors[email.category])}>
                          {email.category === 'layout_request' ? 'Layout' : email.category}
                        </Badge>
                      )}
                      {email.order_id && (
                        <Badge variant="outline" className="text-[10px] h-5">Pedido</Badge>
                      )}
                      {email.quote_id && (
                        <Badge variant="outline" className="text-[10px] h-5">Orçamento</Badge>
                      )}
                    </div>
                  </div>

                  {/* Ações laterais */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
                    <button
                      onClick={(e) => handleStarClick(e, email)}
                      className={cn(
                        'p-1 rounded transition-colors',
                        isStarred ? 'text-yellow-500' : 'text-muted-foreground/50 hover:text-muted-foreground'
                      )}
                    >
                      <Star
                        className={cn('h-4 w-4', isStarred && 'fill-current')}
                      />
                    </button>
                    {(email.attachments?.length || 0) > 0 && (
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground/50" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
