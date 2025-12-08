import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  Users,
  Phone,
  Loader2,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import {
  useContactRequests,
  useApproveContactRequest,
  useRejectContactRequest,
  type ContactRequest,
} from '@/hooks/useContactRequests';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ContactRequestsPanel() {
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedRequest, setSelectedRequest] = useState<ContactRequest | null>(null);
  const [responseNote, setResponseNote] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  const { data: requests, isLoading } = useContactRequests(
    activeTab === 'all' ? undefined : (activeTab as 'pending' | 'approved' | 'rejected')
  );

  const approveRequest = useApproveContactRequest();
  const rejectRequest = useRejectContactRequest();

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;

    if (actionType === 'approve') {
      await approveRequest.mutateAsync({
        requestId: selectedRequest.id,
        responseNote: responseNote.trim() || undefined,
      });
    } else {
      await rejectRequest.mutateAsync({
        requestId: selectedRequest.id,
        responseNote: responseNote.trim() || undefined,
      });
    }

    setSelectedRequest(null);
    setResponseNote('');
    setActionType(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/50">Pendente</Badge>;
      case 'approved':
        return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/50">Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 dark:bg-red-950/50">Rejeitado</Badge>;
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    if (type === 'owner') {
      return (
        <Badge variant="secondary" className="gap-1">
          <UserCheck className="h-3 w-3" />
          Responsável
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3 w-3" />
        Atendente
      </Badge>
    );
  };

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Requisições de Contato
        </CardTitle>
        <CardDescription>
          Gerencie as solicitações de acesso a contatos de outros atendentes
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="pending" className="gap-2">
              <Clock className="h-4 w-4" />
              Pendentes
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Aprovadas
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2">
              <XCircle className="h-4 w-4" />
              Rejeitadas
            </TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Nenhuma requisição {activeTab === 'pending' ? 'pendente' : activeTab === 'approved' ? 'aprovada' : activeTab === 'rejected' ? 'rejeitada' : ''} encontrada
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests?.map((request) => (
                <div
                  key={request.id}
                  className="rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Header com status e tipo */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(request.status)}
                        {getTypeBadge(request.request_type)}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(request.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>

                      {/* Info do contato */}
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{request.contact?.full_name}</span>
                        <span className="text-muted-foreground">{request.contact?.phone}</span>
                      </div>

                      {/* Fluxo de transferência */}
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={request.current_owner?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(request.current_owner?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-muted-foreground">
                            {request.current_owner?.full_name || 'Sem atendente'}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={request.requester?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {getInitials(request.requester?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {request.requester?.full_name || 'Usuário'}
                          </span>
                        </div>
                      </div>

                      {/* Motivo */}
                      {request.reason && (
                        <div className="rounded-md bg-muted/50 p-2 text-sm">
                          <span className="text-muted-foreground">Motivo: </span>
                          {request.reason}
                        </div>
                      )}

                      {/* Resposta (se houver) */}
                      {request.response_note && (
                        <div className="rounded-md bg-muted/50 p-2 text-sm border-l-2 border-primary">
                          <span className="text-muted-foreground">Resposta: </span>
                          {request.response_note}
                          {request.responder && (
                            <span className="text-xs text-muted-foreground ml-2">
                              — {request.responder.full_name}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Ações */}
                    {request.status === 'pending' && (
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            setSelectedRequest(request);
                            setActionType('approve');
                          }}
                        >
                          <CheckCircle className="h-4 w-4" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => {
                            setSelectedRequest(request);
                            setActionType('reject');
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                          Rejeitar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Tabs>

        {/* Modal de confirmação */}
        <Dialog
          open={!!selectedRequest && !!actionType}
          onOpenChange={() => {
            setSelectedRequest(null);
            setActionType(null);
            setResponseNote('');
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'approve' ? 'Aprovar Requisição' : 'Rejeitar Requisição'}
              </DialogTitle>
              <DialogDescription>
                {actionType === 'approve'
                  ? selectedRequest?.request_type === 'owner'
                    ? 'O contato será transferido permanentemente para o solicitante.'
                    : 'O solicitante poderá atender este contato temporariamente.'
                  : 'A requisição será rejeitada e o solicitante será notificado.'}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <label className="text-sm font-medium">
                Observação (opcional)
              </label>
              <Textarea
                placeholder="Adicione uma observação sobre sua decisão..."
                value={responseNote}
                onChange={(e) => setResponseNote(e.target.value)}
                className="mt-2"
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                  setResponseNote('');
                }}
              >
                Cancelar
              </Button>
              <Button
                variant={actionType === 'approve' ? 'default' : 'destructive'}
                onClick={handleAction}
                disabled={approveRequest.isPending || rejectRequest.isPending}
              >
                {(approveRequest.isPending || rejectRequest.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {actionType === 'approve' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
