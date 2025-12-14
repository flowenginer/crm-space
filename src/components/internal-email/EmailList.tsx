import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Search, Star, Paperclip, MailOpen, Mail } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useInternalEmails, useToggleEmailStar, type EmailFolder, type InternalEmail } from '@/hooks/useInternalEmail';
import { Skeleton } from '@/components/ui/skeleton';

interface EmailListProps {
  folder: EmailFolder;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectEmail: (emailId: string) => void;
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

export function EmailList({ folder, searchQuery, onSearchChange, onSelectEmail }: EmailListProps) {
  const { data: emails, isLoading } = useInternalEmails(folder, searchQuery);
  const toggleStar = useToggleEmailStar();

  const handleStarClick = (e: React.MouseEvent, email: InternalEmail) => {
    e.stopPropagation();
    const isCurrentlyStarred = email.recipient_data?.is_starred || false;
    toggleStar.mutate({ emailId: email.id, isStarred: !isCurrentlyStarred });
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header com busca */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">{folderTitles[folder]}</h1>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar e-mails..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Lista de e-mails */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : emails?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <MailOpen className="h-12 w-12 mb-4 opacity-50" />
            <p>Nenhum e-mail encontrado</p>
          </div>
        ) : (
          <div className="divide-y">
            {emails?.map((email) => {
              const isRead = folder === 'sent' || folder === 'drafts' ? true : email.recipient_data?.is_read;
              const isStarred = email.recipient_data?.is_starred;
              const senderName = email.sender?.full_name || 'Desconhecido';
              const dateToShow = email.sent_at || email.updated_at || email.created_at;

              return (
                <div
                  key={email.id}
                  onClick={() => onSelectEmail(email.id)}
                  className={cn(
                    'flex items-start gap-3 p-4 cursor-pointer transition-colors hover:bg-muted/50',
                    !isRead && 'bg-primary/5'
                  )}
                >
                  {/* Avatar */}
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={email.sender?.avatar_url || undefined} />
                    <AvatarFallback className="text-xs">
                      {getInitials(senderName)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={cn(
                        'font-medium truncate',
                        !isRead && 'font-semibold'
                      )}>
                        {senderName}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatEmailDate(dateToShow)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-1">
                      {!isRead && (
                        <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                      )}
                      <span className={cn(
                        'text-sm truncate',
                        !isRead ? 'font-medium text-foreground' : 'text-muted-foreground'
                      )}>
                        {email.subject}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground truncate">
                      {email.body.substring(0, 100)}...
                    </p>

                    {/* Badges */}
                    <div className="flex items-center gap-2 mt-2">
                      {email.priority !== 'normal' && (
                        <Badge variant="outline" className={cn('text-xs', priorityColors[email.priority])}>
                          {email.priority === 'high' ? 'Alta' : 'Baixa'}
                        </Badge>
                      )}
                      {email.category && email.category !== 'general' && (
                        <Badge variant="outline" className={cn('text-xs', categoryColors[email.category])}>
                          {email.category === 'layout_request' ? 'Layout' : email.category}
                        </Badge>
                      )}
                      {email.order_id && (
                        <Badge variant="outline" className="text-xs">
                          Pedido
                        </Badge>
                      )}
                      {email.quote_id && (
                        <Badge variant="outline" className="text-xs">
                          Orçamento
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Ações laterais */}
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => handleStarClick(e, email)}
                      className="p-1 hover:bg-muted rounded"
                    >
                      <Star
                        className={cn(
                          'h-4 w-4',
                          isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                        )}
                      />
                    </button>
                    {(email.attachments?.length || 0) > 0 && (
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
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
