import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SupportTicket } from '@/types/support';
import { TicketStatusBadge } from './TicketStatusBadge';
import { TicketPriorityBadge } from './TicketPriorityBadge';
import { TicketCategoryBadge } from './TicketCategoryBadge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Clock, User } from 'lucide-react';

interface TicketCardProps {
  ticket: SupportTicket;
  onClick?: () => void;
  showTenant?: boolean;
}

export function TicketCard({ ticket, onClick, showTenant = false }: TicketCardProps) {
  const requesterInitials = ticket.requester?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || '?';

  return (
    <Card 
      className="hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-mono text-muted-foreground">
                #{ticket.ticket_number}
              </span>
              <TicketStatusBadge status={ticket.status} />
              <TicketPriorityBadge priority={ticket.priority} />
            </div>
            
            <h3 className="font-semibold truncate mb-1">{ticket.title}</h3>
            
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {ticket.description}
            </p>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <TicketCategoryBadge category={ticket.category} />
              
              {showTenant && ticket.tenant && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {ticket.tenant.name}
                </span>
              )}
              
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(ticket.created_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={ticket.requester?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">{requesterInitials}</AvatarFallback>
              </Avatar>
            </div>
            
            {ticket.assignee && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <span>{ticket.assignee.full_name}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
