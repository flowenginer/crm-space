import { Link2Off, Users, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConversationEvent } from '@/hooks/useConversationEvents';

interface ShareCancelledEventCardProps {
  event: ConversationEvent;
  currentUserId?: string;
}

export function ShareCancelledEventCard({ event, currentUserId }: ShareCancelledEventCardProps) {
  const data = event.data as {
    cancelled_share_with_user_id?: string;
    cancelled_share_with_user_name?: string;
    cancelled_share_with_department_id?: string;
    cancelled_share_with_department_name?: string;
  };

  const actorName = event.actor?.full_name || 'Alguém';
  const isMe = event.actor_id === currentUserId;
  
  const getTargetDisplay = () => {
    if (data.cancelled_share_with_department_id && data.cancelled_share_with_department_name) {
      return (
        <span className="inline-flex items-center gap-1">
          <Building2 size={12} />
          <span className="font-medium">{data.cancelled_share_with_department_name}</span>
        </span>
      );
    }
    if (data.cancelled_share_with_user_id) {
      return (
        <span className="inline-flex items-center gap-1">
          <Users size={12} />
          <span className="font-medium">{data.cancelled_share_with_user_name || 'usuário'}</span>
        </span>
      );
    }
    return <span className="font-medium">alguém</span>;
  };

  return (
    <div className="flex justify-center my-4">
      <div className="bg-orange-500/10 dark:bg-orange-500/20 border border-orange-500/20 rounded-xl px-4 py-3 max-w-sm">
        <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-1">
          <Link2Off size={14} />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Compartilhamento Cancelado
          </span>
        </div>
        
        <p className="text-sm text-foreground/80">
          <span className="font-medium">{isMe ? 'Você' : actorName}</span>
          {' cancelou o compartilhamento com '}
          {getTargetDisplay()}
        </p>
        
        <p className="text-xs text-muted-foreground mt-2 text-right">
          {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
}
