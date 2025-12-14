import { useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
  Reply,
  ReplyAll,
  Forward,
  Star,
  Archive,
  Trash2,
  MoreVertical,
  Paperclip,
  Download,
  ExternalLink,
  Package,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useInternalEmail,
  useMarkEmailAsRead,
  useToggleEmailStar,
  useMoveEmailToTrash,
  useArchiveEmail
} from '@/hooks/useInternalEmail';
import { toast } from 'sonner';

interface EmailViewerProps {
  emailId: string;
  onBack: () => void;
  onReply: (emailId: string, type: 'reply' | 'replyAll' | 'forward') => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const priorityLabels = {
  low: { label: 'Baixa', class: 'bg-muted text-muted-foreground' },
  normal: { label: 'Normal', class: 'hidden' },
  high: { label: 'Alta', class: 'bg-destructive/10 text-destructive' }
};

export function EmailViewer({ emailId, onBack, onReply }: EmailViewerProps) {
  const { data: email, isLoading } = useInternalEmail(emailId);
  const markAsRead = useMarkEmailAsRead();
  const toggleStar = useToggleEmailStar();
  const moveToTrash = useMoveEmailToTrash();
  const archiveEmail = useArchiveEmail();

  // Marcar como lido ao visualizar
  useEffect(() => {
    if (email && !email.recipient_data?.is_read) {
      markAsRead.mutate(emailId);
    }
  }, [email, emailId, markAsRead]);

  const handleStar = () => {
    const isCurrentlyStarred = email?.recipient_data?.is_starred || false;
    toggleStar.mutate({ emailId, isStarred: !isCurrentlyStarred });
  };

  const handleArchive = () => {
    archiveEmail.mutate(emailId, {
      onSuccess: () => {
        toast.success('E-mail arquivado');
        onBack();
      }
    });
  };

  const handleDelete = () => {
    moveToTrash.mutate(emailId, {
      onSuccess: () => {
        toast.success('E-mail movido para lixeira');
        onBack();
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!email) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">E-mail não encontrado</p>
      </div>
    );
  }

  const senderName = email.sender?.full_name || 'Desconhecido';
  const recipientsTo = email.recipients?.filter(r => r.recipient_type === 'to') || [];
  const recipientsCc = email.recipients?.filter(r => r.recipient_type === 'cc') || [];
  const isStarred = email.recipient_data?.is_starred;

  return (
    <div className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onReply(emailId, 'reply')}>
            <Reply className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onReply(emailId, 'replyAll')}>
            <ReplyAll className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onReply(emailId, 'forward')}>
            <Forward className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={handleStar}>
            <Star className={cn('h-4 w-4', isStarred && 'fill-yellow-400 text-yellow-400')} />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleArchive}>
            <Archive className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => markAsRead.mutate(emailId)}>
                Marcar como não lido
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Conteúdo do e-mail */}
      <ScrollArea className="flex-1">
        <div className="p-6 max-w-4xl">
          {/* Assunto */}
          <h1 className="text-2xl font-semibold mb-6">{email.subject}</h1>

          {/* Header do e-mail */}
          <div className="flex items-start gap-4 mb-6">
            <Avatar className="h-12 w-12">
              <AvatarImage src={email.sender?.avatar_url || undefined} />
              <AvatarFallback>{getInitials(senderName)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{senderName}</p>
                  <div className="text-sm text-muted-foreground">
                    <span>Para: </span>
                    {recipientsTo.map((r, i) => (
                      <span key={r.id}>
                        {r.user?.full_name}
                        {i < recipientsTo.length - 1 && ', '}
                      </span>
                    ))}
                  </div>
                  {recipientsCc.length > 0 && (
                    <div className="text-sm text-muted-foreground">
                      <span>Cc: </span>
                      {recipientsCc.map((r, i) => (
                        <span key={r.id}>
                          {r.user?.full_name}
                          {i < recipientsCc.length - 1 && ', '}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-sm text-muted-foreground text-right">
                  {email.sent_at && format(new Date(email.sent_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 mt-3">
                {email.priority !== 'normal' && (
                  <Badge variant="outline" className={priorityLabels[email.priority].class}>
                    Prioridade {priorityLabels[email.priority].label}
                  </Badge>
                )}
                {email.category && email.category !== 'general' && (
                  <Badge variant="outline">
                    {email.category === 'layout_request' ? 'Solicitação de Layout' : 
                     email.category === 'layout_delivery' ? 'Entrega de Layout' : email.category}
                  </Badge>
                )}
                {email.order && (
                  <Badge variant="outline" className="gap-1">
                    <Package className="h-3 w-3" />
                    Pedido #{email.order.order_number}
                  </Badge>
                )}
                {email.quote && (
                  <Badge variant="outline" className="gap-1">
                    <FileText className="h-3 w-3" />
                    Orçamento #{email.quote.quote_number}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          {/* Corpo do e-mail */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {email.body_html ? (
              <div dangerouslySetInnerHTML={{ __html: email.body_html }} />
            ) : (
              <div className="whitespace-pre-wrap">{email.body}</div>
            )}
          </div>

          {/* Anexos */}
          {email.attachments && email.attachments.length > 0 && (
            <>
              <Separator className="my-6" />
              <div>
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Anexos ({email.attachments.length})
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {email.attachments.map((attachment) => (
                    <a
                      key={attachment.id}
                      href={attachment.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted transition-colors group"
                    >
                      <div className="p-2 bg-muted rounded">
                        <Paperclip className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.file_size)}
                        </p>
                      </div>
                      <Download className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Botões de ação */}
          <div className="flex items-center gap-3 mt-8 pt-6 border-t">
            <Button variant="outline" onClick={() => onReply(emailId, 'reply')}>
              <Reply className="h-4 w-4 mr-2" />
              Responder
            </Button>
            <Button variant="outline" onClick={() => onReply(emailId, 'replyAll')}>
              <ReplyAll className="h-4 w-4 mr-2" />
              Responder a Todos
            </Button>
            <Button variant="outline" onClick={() => onReply(emailId, 'forward')}>
              <Forward className="h-4 w-4 mr-2" />
              Encaminhar
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
