import { XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ConversationEvent } from '@/hooks/useConversationEvents';

interface CloseEventCardProps {
  event: ConversationEvent;
}

// Helper to format seconds as human readable duration
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    return `${mins}min`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
}

export function CloseEventCard({ event }: CloseEventCardProps) {
  const { data, created_at, actor } = event;
  
  const closeReason = data.close_reason;
  const activeTimeSeconds = data.active_time_seconds as number | undefined;
  const totalTimeSeconds = data.total_time_seconds as number | undefined;
  
  const formattedDate = format(new Date(created_at), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  const closedByName = actor?.full_name || 'Sistema';

  return (
    <div className="flex justify-center my-3">
      <div className="bg-red-500/15 dark:bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 max-w-md w-full">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
            <XCircle size={16} className="text-red-600 dark:text-red-400" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">
              Conversa fechada
            </p>
            
            <p className="mt-1 text-xs text-red-600/80 dark:text-red-400/80">
              por {closedByName}
            </p>
            
            {closeReason && (
              <p className="mt-2 text-xs text-red-600/70 dark:text-red-400/70 italic">
                Motivo: "{closeReason}"
              </p>
            )}
            
            {activeTimeSeconds !== undefined && activeTimeSeconds > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600/60 dark:text-red-400/60">
                <Clock size={12} />
                <span>
                  Tempo ativo nesta sessão: {formatDuration(activeTimeSeconds)}
                  {totalTimeSeconds !== undefined && totalTimeSeconds > activeTimeSeconds && (
                    <span className="ml-1 opacity-70">
                      (total: {formatDuration(totalTimeSeconds)})
                    </span>
                  )}
                </span>
              </div>
            )}
            
            <p className="mt-1.5 text-[10px] text-red-500/60 dark:text-red-400/50">
              {formattedDate}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
