import { Loader2, AlertTriangle, Clock, MessageSquare } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import type { CriticalConversation } from '@/hooks/useDashboardAdvanced';

interface CriticalConversationsProps {
  data: CriticalConversation[];
  isLoading?: boolean;
}

function formatWaitingTime(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
}

function getUrgencyColor(minutes: number): string {
  if (minutes >= 120) return 'text-destructive bg-destructive/10';
  if (minutes >= 60) return 'text-warning bg-warning/10';
  return 'text-orange-500 bg-orange-500/10';
}

export function CriticalConversations({ data, isLoading }: CriticalConversationsProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <h3 className="text-lg font-semibold text-foreground">Conversas Críticas</h3>
        </div>
        <div className="h-[200px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-elevated">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <h3 className="text-lg font-semibold text-foreground">Conversas Críticas</h3>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-warning/10 text-warning font-medium">
          {data.length} aguardando
        </span>
      </div>
      
      {data.length === 0 ? (
        <div className="h-[180px] flex flex-col items-center justify-center text-muted-foreground">
          <MessageSquare className="h-10 w-10 mb-3 opacity-50" />
          <p>Nenhuma conversa aguardando resposta</p>
          <p className="text-sm mt-1">Ótimo trabalho!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((conversation) => (
            <div 
              key={conversation.id}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer group"
              onClick={() => navigate(`/conversations?id=${conversation.id}`)}
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {conversation.contactName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">
                  {conversation.contactName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {conversation.agentName ? `Atribuído: ${conversation.agentName}` : 'Sem atribuição'}
                </p>
              </div>
              
              <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${getUrgencyColor(conversation.waitingTime)}`}>
                <Clock className="h-3 w-3" />
                {formatWaitingTime(conversation.waitingTime)}
              </div>
            </div>
          ))}
          
          <Button 
            variant="ghost" 
            className="w-full mt-2 text-primary hover:text-primary"
            onClick={() => navigate('/conversations')}
          >
            Ver todas as conversas
          </Button>
        </div>
      )}
    </div>
  );
}
