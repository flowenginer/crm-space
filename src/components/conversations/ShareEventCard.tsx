import { Share2, Users, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConversationEvent } from '@/hooks/useConversationEvents';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ShareEventCardProps {
  event: ConversationEvent;
  currentUserId?: string;
}

export function ShareEventCard({ event, currentUserId }: ShareEventCardProps) {
  const data = event.data as {
    shared_with_user_id?: string;
    shared_with_department_id?: string;
    note?: string;
  };

  // Fetch shared_with user name if needed
  const { data: sharedWithUser } = useQuery({
    queryKey: ['profile', data.shared_with_user_id],
    queryFn: async () => {
      if (!data.shared_with_user_id) return null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', data.shared_with_user_id)
        .single();
      return profile;
    },
    enabled: !!data.shared_with_user_id,
    staleTime: 60000,
  });

  // Fetch department name if needed
  const { data: department } = useQuery({
    queryKey: ['department', data.shared_with_department_id],
    queryFn: async () => {
      if (!data.shared_with_department_id) return null;
      const { data: dept } = await supabase
        .from('departments')
        .select('name, color')
        .eq('id', data.shared_with_department_id)
        .single();
      return dept;
    },
    enabled: !!data.shared_with_department_id,
    staleTime: 60000,
  });

  const actorName = event.actor?.full_name || 'Alguém';
  const isMe = event.actor_id === currentUserId;
  
  const getTargetDisplay = () => {
    if (data.shared_with_department_id && department) {
      return (
        <span className="inline-flex items-center gap-1">
          <Building2 size={12} />
          <span className="font-medium">{department.name}</span>
        </span>
      );
    }
    if (data.shared_with_user_id && sharedWithUser) {
      return (
        <span className="inline-flex items-center gap-1">
          <Users size={12} />
          <span className="font-medium">{sharedWithUser.full_name}</span>
        </span>
      );
    }
    return <span className="font-medium">alguém</span>;
  };

  return (
    <div className="flex justify-center my-4">
      <div className="bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 rounded-xl px-4 py-3 max-w-sm">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
          <Share2 size={14} />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Conversa Compartilhada
          </span>
        </div>
        
        <p className="text-sm text-foreground/80">
          <span className="font-medium">{isMe ? 'Você' : actorName}</span>
          {' compartilhou esta conversa com '}
          {getTargetDisplay()}
        </p>
        
        {data.note && (
          <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-blue-500/40 pl-2">
            "{data.note}"
          </p>
        )}
        
        <p className="text-xs text-muted-foreground mt-2 text-right">
          {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
}
