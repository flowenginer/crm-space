import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSupportTicket, useUpdateTicket, useIsSupportTechnician, useSupportTechnicians } from '@/hooks/useSupportTickets';
import { TicketComments } from '@/components/support/TicketComments';
import { TicketStatusBadge } from '@/components/support/TicketStatusBadge';
import { TicketPriorityBadge } from '@/components/support/TicketPriorityBadge';
import { TicketCategoryBadge } from '@/components/support/TicketCategoryBadge';
import { TicketStatus, TicketPriority, STATUS_CONFIG, PRIORITY_CONFIG, MODULE_OPTIONS } from '@/types/support';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Calendar, User, Building, Monitor, Clock, CheckCircle } from 'lucide-react';

export default function TicketDetailPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  
  const { data: ticket, isLoading } = useSupportTicket(ticketId || null);
  const { data: isTechnician } = useIsSupportTechnician();
  const { data: technicians } = useSupportTechnicians();
  const updateTicket = useUpdateTicket();

  const handleStatusChange = (status: TicketStatus) => {
    if (!ticketId) return;
    updateTicket.mutate({ ticketId, data: { status } });
  };

  const handlePriorityChange = (priority: TicketPriority) => {
    if (!ticketId) return;
    updateTicket.mutate({ ticketId, data: { priority } });
  };

  const handleAssigneeChange = (assignedTo: string) => {
    if (!ticketId) return;
    updateTicket.mutate({ 
      ticketId, 
      data: { assigned_to: assignedTo === 'unassigned' ? null : assignedTo } 
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Ticket não encontrado.</p>
            <Button variant="outline" onClick={() => navigate('/suporte')} className="mt-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const requesterInitials = ticket.requester?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || '?';

  const moduleName = MODULE_OPTIONS.find(m => m.value === ticket.affected_module)?.label || ticket.affected_module;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/suporte')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-xl font-bold">
          Ticket #{ticket.ticket_number}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <CardTitle className="text-xl">{ticket.title}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <TicketStatusBadge status={ticket.status} />
                    <TicketPriorityBadge priority={ticket.priority} />
                    <TicketCategoryBadge category={ticket.category} />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap">{ticket.description}</p>
              </div>
            </CardContent>
          </Card>

          <TicketComments ticketId={ticket.id} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions (technicians only) */}
          {isTechnician && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={ticket.status} onValueChange={handleStatusChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_CONFIG) as TicketStatus[]).map((status) => (
                        <SelectItem key={status} value={status}>
                          {STATUS_CONFIG[status].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Prioridade</label>
                  <Select value={ticket.priority} onValueChange={handlePriorityChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(PRIORITY_CONFIG) as TicketPriority[]).map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {PRIORITY_CONFIG[priority].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Responsável</label>
                  <Select 
                    value={ticket.assigned_to || 'unassigned'} 
                    onValueChange={handleAssigneeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Não atribuído" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Não atribuído</SelectItem>
                      {technicians?.map((tech) => (
                        <SelectItem key={tech.user_id} value={tech.user_id}>
                          {tech.profile?.full_name || 'Técnico'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={ticket.requester?.avatar_url || undefined} />
                  <AvatarFallback>{requesterInitials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{ticket.requester?.full_name}</p>
                  <p className="text-xs text-muted-foreground">Solicitante</p>
                </div>
              </div>

              {ticket.tenant && (
                <div className="flex items-center gap-2 text-sm">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span>{ticket.tenant.name}</span>
                </div>
              )}

              {ticket.affected_module && (
                <div className="flex items-center gap-2 text-sm">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <span>{moduleName}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  Criado em {format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>

              {ticket.first_response_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Primeira resposta: {format(new Date(ticket.first_response_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              )}

              {ticket.resolved_at && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span>
                    Resolvido em {format(new Date(ticket.resolved_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              )}

              {ticket.assignee && (
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Responsável</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={ticket.assignee.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {ticket.assignee.full_name?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{ticket.assignee.full_name}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
