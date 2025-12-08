import { RefreshCw, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ConversationEvent } from '@/hooks/useConversationEvents';

interface ReopenEventCardProps {
  event: ConversationEvent;
}

export function ReopenEventCard({ event }: ReopenEventCardProps) {
  const { data, created_at, actor } = event;
  
  const previousCloseReason = data.previous_close_reason || data.close_reason;
  const previousClosedAt = data.previous_closed_at;
  const trigger = data.trigger as string | undefined; // 'client_message' | 'manual'
  
  const formattedDate = format(new Date(created_at), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  const formattedClosedAt = previousClosedAt 
    ? format(new Date(previousClosedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
    : null;

  // Determine the trigger text
  const triggerText = trigger === 'client_message' 
    ? 'Cliente enviou nova mensagem'
    : trigger === 'manual'
      ? actor?.full_name 
        ? `Reaberta por ${actor.full_name}`
        : 'Reaberta manualmente'
      : 'Conversa reaberta';

  return (
    <div className="flex justify-center my-3">
      <div className="bg-amber-500/15 dark:bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 max-w-md w-full">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
            <RefreshCw size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Conversa reaberta
            </p>
            
            <p className="mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">
              {triggerText}
            </p>
            
            {previousCloseReason && (
              <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600/70 dark:text-amber-400/70">
                <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                <span>
                  Motivo do fechamento anterior: <span className="font-medium">{previousCloseReason}</span>
                </span>
              </div>
            )}
            
            {formattedClosedAt && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-600/60 dark:text-amber-400/60">
                <Clock size={12} />
                <span>Fechada em: {formattedClosedAt}</span>
              </div>
            )}
            
            <p className="mt-1.5 text-[10px] text-amber-500/60 dark:text-amber-400/50">
              {formattedDate}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
