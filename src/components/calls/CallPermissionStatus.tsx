import { Phone, PhoneForwarded, Clock, XCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCallPermission } from '@/hooks/useCallPermission';
import { InitiateCallButton } from './InitiateCallButton';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CallPermissionStatusProps {
  contactId: string;
  contactPhone: string;
  contactName?: string;
  conversationId?: string;
  channelId?: string;
  className?: string;
  compact?: boolean;
}

export function CallPermissionStatus({
  contactId,
  contactPhone,
  contactName,
  conversationId,
  channelId,
  className,
  compact = true,
}: CallPermissionStatusProps) {
  const {
    status,
    requestedAt,
    isLoading,
    hasPermission,
    isPending,
    isDenied,
    canRequestAgain,
    requestPermission,
    isRequesting,
  } = useCallPermission({
    contactId,
    contactPhone,
    conversationId,
    channelId,
  });

  if (isLoading) {
    return (
      <div className={cn("flex items-center", className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If permission is granted, show the call button
  if (hasPermission) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                <CheckCircle2 className="h-3 w-3 text-green-500 mr-1" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Permissão de chamada concedida</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <InitiateCallButton
          contactPhone={contactPhone}
          contactId={contactId}
          contactName={contactName}
          size="icon"
          variant="ghost"
          className="h-5 w-5"
        />
      </div>
    );
  }

  // If pending, show waiting status
  if (isPending && !canRequestAgain) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-yellow-500" />
                {!compact && (
                  <span className="text-xs text-muted-foreground">
                    Aguardando
                    {requestedAt && (
                      <span className="ml-1 text-[10px]">
                        ({formatDistanceToNow(requestedAt, { locale: ptBR, addSuffix: true })})
                      </span>
                    )}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Aguardando resposta do contato</p>
              {requestedAt && (
                <p className="text-xs text-muted-foreground">
                  Solicitado {formatDistanceToNow(requestedAt, { locale: ptBR, addSuffix: true })}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  // If denied or never requested, show request button
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {isDenied && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <XCircle className="h-3.5 w-3.5 text-red-500 mr-0.5" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Permissão negada anteriormente</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={() => requestPermission(undefined)}
              disabled={isRequesting || !conversationId}
            >
              {isRequesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PhoneForwarded className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isDenied 
                ? 'Solicitar permissão novamente' 
                : 'Solicitar permissão para chamada'}
            </p>
            {!conversationId && (
              <p className="text-xs text-muted-foreground">
                Abra a conversa para solicitar
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
