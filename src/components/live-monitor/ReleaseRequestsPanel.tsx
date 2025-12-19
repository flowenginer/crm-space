import { Check, X, Clock, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  usePendingReleaseRequests,
  useRespondReleaseRequest,
} from '@/hooks/useAgentAvailability';

export function ReleaseRequestsPanel() {
  const { data: requests = [], isLoading } = usePendingReleaseRequests();
  const respondRequest = useRespondReleaseRequest();

  if (isLoading || requests.length === 0) {
    return null;
  }

  return (
    <Card className="mb-4 border-amber-500/50 bg-amber-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-amber-500" />
          <CardTitle className="text-base">
            Solicitações de Liberação
          </CardTitle>
          <Badge variant="secondary" className="bg-amber-500 text-white">
            {requests.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="flex items-center justify-between p-3 rounded-lg bg-background border"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {request.agent_name?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{request.agent_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {request.reason || 'Solicito liberação'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(request.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-destructive hover:bg-destructive/10"
                  onClick={() =>
                    respondRequest.mutate({
                      requestId: request.id,
                      approved: false,
                      agentId: request.agent_id,
                    })
                  }
                  disabled={respondRequest.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  className="h-8 bg-green-600 hover:bg-green-700"
                  onClick={() =>
                    respondRequest.mutate({
                      requestId: request.id,
                      approved: true,
                      agentId: request.agent_id,
                    })
                  }
                  disabled={respondRequest.isPending}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Liberar
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
