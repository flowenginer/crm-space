import { ArrowRightLeft, Building2, User } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ConversationEvent } from '@/hooks/useConversationEvents';

interface TransferEventCardProps {
  event: ConversationEvent;
}

export function TransferEventCard({ event }: TransferEventCardProps) {
  const { data, created_at } = event;
  
  const fromName = data.from_user_name || 'Usuário';
  const toName = data.to_user_name || data.to_department_name || 'Destino';
  const isTransferToDepartment = !!data.to_department_id;

  const formattedDate = format(new Date(created_at), "dd/MM/yyyy 'às' HH:mm", {
    locale: ptBR,
  });

  return (
    <div className="flex justify-center my-3">
      <div className="bg-blue-500/15 dark:bg-blue-500/10 border border-blue-500/30 rounded-lg px-4 py-3 max-w-md w-full">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
            <ArrowRightLeft size={16} className="text-blue-600 dark:text-blue-400" />
          </div>
          
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Conversa transferida
            </p>
            
            <div className="flex items-center gap-1.5 mt-1 text-xs text-blue-600/80 dark:text-blue-400/80">
              <span className="font-medium">{fromName}</span>
              <span>→</span>
              <span className="flex items-center gap-1">
                {isTransferToDepartment ? (
                  <Building2 size={12} />
                ) : (
                  <User size={12} />
                )}
                <span className="font-medium">{toName}</span>
              </span>
            </div>
            
            {data.note && (
              <p className="mt-2 text-xs text-blue-600/70 dark:text-blue-400/70 italic">
                "{data.note}"
              </p>
            )}
            
            <p className="mt-1.5 text-[10px] text-blue-500/60 dark:text-blue-400/50">
              {formattedDate}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
