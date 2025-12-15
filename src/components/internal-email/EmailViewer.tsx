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
  Package,
  FileText,
  Hand,
  RotateCcw,
  CheckCircle2,
  Clock,
  User,
  History
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  useInternalEmail,
  useMarkEmailAsRead,
  useToggleEmailStar,
  useMoveEmailToTrash,
  useArchiveEmail
} from '@/hooks/useInternalEmail';
import {
  useClaimEmail,
  useReleaseEmail,
  useCompleteEmail,
  useEmailActivityLog,
  useUserSharedBoxes
} from '@/hooks/useSharedEmailBoxes';
import { EmailAttachmentPreview } from './EmailAttachmentPreview';
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


const priorityLabels = {
  low: { label: 'Baixa', class: 'bg-muted text-muted-foreground' },
  normal: { label: 'Normal', class: 'hidden' },
  high: { label: 'Alta', class: 'bg-destructive/10 text-destructive' }
};

const statusConfig = {
  pending: { label: 'Aguardando', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: Clock },
  in_progress: { label: 'Em Andamento', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: User },
  completed: { label: 'Concluído', color: 'bg-green-500/10 text-green-600 border-green-500/30', icon: CheckCircle2 }
};

const actionLabels: Record<string, string> = {
  claimed: 'Assumiu o e-mail',
  released: 'Devolveu para a fila',
  in_progress: 'Iniciou atendimento',
  completed: 'Concluiu atendimento',
  pending: 'Voltou para aguardando'
};

export function EmailViewer({ emailId, onBack, onReply }: EmailViewerProps) {
  const { data: email, isLoading } = useInternalEmail(emailId);
  const { data: activityLog } = useEmailActivityLog(emailId);
  const { data: userSharedBoxes } = useUserSharedBoxes();
  const markAsRead = useMarkEmailAsRead();
  const toggleStar = useToggleEmailStar();
  const moveToTrash = useMoveEmailToTrash();
  const archiveEmail = useArchiveEmail();
  const claimEmail = useClaimEmail();
  const releaseEmail = useReleaseEmail();
  const completeEmail = useCompleteEmail();

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

  const handleClaim = async () => {
    try {
      await claimEmail.mutateAsync(emailId);
      toast.success('E-mail assumido com sucesso!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao assumir e-mail');
    }
  };

  const handleRelease = async () => {
    try {
      await releaseEmail.mutateAsync(emailId);
      toast.success('E-mail devolvido para a fila');
    } catch (error) {
      console.error('[EmailViewer] Erro ao devolver:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao devolver e-mail');
    }
  };

  const handleComplete = async () => {
    try {
      await completeEmail.mutateAsync(emailId);
      toast.success('E-mail marcado como concluído');
    } catch (error) {
      console.error('[EmailViewer] Erro ao concluir:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao concluir e-mail');
    }
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
  const isSharedEmail = !!email.shared_box_id;
  const isMemberOfSharedBox = email.shared_box_id && 
    userSharedBoxes?.some(box => box.id === email.shared_box_id);
  const workflowStatus = (email.workflow_status || 'pending') as keyof typeof statusConfig;
  const StatusIcon = statusConfig[workflowStatus]?.icon || Clock;
  const claimedByName = email.claimed_by_user?.full_name;

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
          {/* Ações de caixa compartilhada - só mostra para membros da caixa */}
          {isSharedEmail && isMemberOfSharedBox && (
            <>
              {!email.claimed_by && workflowStatus === 'pending' && (
                <Button variant="outline" size="sm" onClick={handleClaim} className="gap-1">
                  <Hand className="h-4 w-4" />
                  Assumir
                </Button>
              )}
              {email.claimed_by && workflowStatus === 'in_progress' && (
                <>
                  <Button variant="outline" size="sm" onClick={handleComplete} className="gap-1 text-green-600 border-green-500/30 hover:bg-green-500/10">
                    <CheckCircle2 className="h-4 w-4" />
                    Concluir
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleRelease} className="gap-1 text-muted-foreground">
                    <RotateCcw className="h-4 w-4" />
                    Devolver
                  </Button>
                </>
              )}
            </>
          )}
          
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

          {/* Status de caixa compartilhada */}
          {isSharedEmail && (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted/50">
              <Badge variant="outline" className={cn('gap-1', statusConfig[workflowStatus]?.color)}>
                <StatusIcon className="h-3.5 w-3.5" />
                {statusConfig[workflowStatus]?.label}
              </Badge>
              {claimedByName && (
                <span className="text-sm text-muted-foreground">
                  Responsável: <span className="font-medium text-foreground">{claimedByName}</span>
                </span>
              )}
              {email.claimed_at && (
                <span className="text-xs text-muted-foreground">
                  • Assumido em {format(new Date(email.claimed_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </span>
              )}
            </div>
          )}

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
                <EmailAttachmentPreview attachments={email.attachments} />
              </div>
            </>
          )}

          {/* Histórico de atividades (para caixas compartilhadas) */}
          {isSharedEmail && activityLog && activityLog.length > 0 && (
            <>
              <Separator className="my-6" />
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
                    <History className="h-4 w-4" />
                    Histórico de Atividades ({activityLog.length})
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="space-y-3 pl-6 border-l-2 border-muted ml-2">
                    {activityLog.map((log) => (
                      <div key={log.id} className="relative">
                        <div className="absolute -left-[25px] w-3 h-3 rounded-full bg-muted border-2 border-background" />
                        <div className="text-sm">
                          <span className="font-medium">{log.actor?.full_name || 'Sistema'}</span>
                          <span className="text-muted-foreground"> {actionLabels[log.action] || log.action}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
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
