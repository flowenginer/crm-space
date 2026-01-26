import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSupportTickets, useIsSupportTechnician } from '@/hooks/useSupportTickets';
import { TicketCard } from '@/components/support/TicketCard';
import { TicketForm } from '@/components/support/TicketForm';
import { TicketStatus, STATUS_CONFIG } from '@/types/support';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Ticket, LayoutDashboard } from 'lucide-react';

export default function SupportPage() {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  
  const { data: isTechnician } = useIsSupportTechnician();
  const { data: tickets, isLoading } = useSupportTickets(
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );

  const handleTicketClick = (ticketId: string) => {
    navigate(`/suporte/${ticketId}`);
  };

  if (showForm) {
    return (
      <div className="container mx-auto py-6 max-w-3xl">
        <TicketForm 
          onSuccess={() => setShowForm(false)} 
          onCancel={() => setShowForm(false)} 
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ticket className="h-6 w-6" />
            Suporte
          </h1>
          <p className="text-muted-foreground">
            Crie e acompanhe seus tickets de suporte
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {isTechnician && (
            <Button variant="outline" onClick={() => navigate('/admin/suporte')}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          )}
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Ticket
          </Button>
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as TicketStatus | 'all')}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="open">{STATUS_CONFIG.open.label}</TabsTrigger>
          <TabsTrigger value="in_progress">{STATUS_CONFIG.in_progress.label}</TabsTrigger>
          <TabsTrigger value="waiting_response">{STATUS_CONFIG.waiting_response.label}</TabsTrigger>
          <TabsTrigger value="resolved">{STATUS_CONFIG.resolved.label}</TabsTrigger>
          <TabsTrigger value="closed">{STATUS_CONFIG.closed.label}</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-2" />
                        <Skeleton className="h-5 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                      <Skeleton className="h-10 w-10 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : tickets && tickets.length > 0 ? (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onClick={() => handleTicketClick(ticket.id)}
                  showTenant={isTechnician}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhum ticket encontrado</h3>
                  <p className="text-muted-foreground mb-4">
                    {statusFilter === 'all' 
                      ? 'Você ainda não abriu nenhum ticket de suporte.'
                      : `Nenhum ticket com status "${STATUS_CONFIG[statusFilter as TicketStatus].label}".`
                    }
                  </p>
                  <Button onClick={() => setShowForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Criar Ticket
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
