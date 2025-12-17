import { useState } from 'react';
import { AlertTriangle, X, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useActiveRescue, useCancelRescue, useScheduledMessages } from '@/hooks/useActiveRescue';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RescueActiveAlertProps {
  conversationId: string;
}

export function RescueActiveAlert({ conversationId }: RescueActiveAlertProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  
  const { data: activeRescue } = useActiveRescue(conversationId);
  const { data: scheduledMessages = [] } = useScheduledMessages(activeRescue?.id || null);
  const cancelRescue = useCancelRescue();

  if (!activeRescue) return null;

  const pendingMessages = scheduledMessages.filter(m => m.status === 'pending');
  const nextMessage = pendingMessages[0];

  const handleCancel = async () => {
    try {
      await cancelRescue.mutateAsync({
        rescueId: activeRescue.id,
        conversationId,
      });
      toast.success('Resgate cancelado');
      setShowCancelDialog(false);
    } catch (error) {
      toast.error('Erro ao cancelar resgate');
    }
  };

  const formatNextSend = () => {
    if (!nextMessage) return null;
    const scheduledTime = new Date(nextMessage.scheduled_for);
    const now = new Date();
    
    if (scheduledTime <= now) {
      return 'enviando...';
    }
    
    return formatDistanceToNow(scheduledTime, { 
      addSuffix: true, 
      locale: ptBR,
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 px-4 py-2 bg-destructive/10 border-t border-destructive/20">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-destructive shrink-0" />
          <span className="text-sm font-medium text-destructive">
            Resgate ativo
          </span>
          {activeRescue.template && (
            <span className="text-xs text-muted-foreground">
              ({activeRescue.template.title})
            </span>
          )}
          {nextMessage && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
              <Clock size={12} />
              <span>Próxima {formatNextSend()}</span>
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCancelDialog(true)}
          className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <X size={14} className="mr-1" />
          Cancelar
        </Button>
      </div>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Resgate?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá cancelar todas as mensagens pendentes do resgate.
              {pendingMessages.length > 0 && (
                <span className="block mt-2">
                  {pendingMessages.length} mensagem(ns) ainda não enviada(s).
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelRescue.isPending}
            >
              {cancelRescue.isPending && <Loader2 size={14} className="mr-2 animate-spin" />}
              Cancelar Resgate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
