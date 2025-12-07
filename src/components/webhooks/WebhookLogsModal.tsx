import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  Eye,
  RotateCcw,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { WebhookConfig, useWebhookDeliveries, useRetryDelivery } from "@/hooks/useWebhooks";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface WebhookLogsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook: WebhookConfig | null;
}

export function WebhookLogsModal({ open, onOpenChange, webhook }: WebhookLogsModalProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading, refetch } = useWebhookDeliveries(webhook?.id || null, page, pageSize);
  const retryDelivery = useRetryDelivery();

  const deliveries = data?.data || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const filteredDeliveries = statusFilter === 'all' 
    ? deliveries 
    : deliveries.filter(d => d.status === statusFilter);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'pending':
      case 'retrying':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string, statusCode?: number | null) => {
    switch (status) {
      case 'success':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">{statusCode || 200} OK</Badge>;
      case 'failed':
        return <Badge variant="destructive">{statusCode || 'Erro'}</Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pendente</Badge>;
      case 'retrying':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Reenviando...</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Logs: {webhook?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 pb-4 border-b">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="success">Sucesso</SelectItem>
              <SelectItem value="failed">Falha</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mb-4 opacity-50" />
              <p>Nenhum log encontrado</p>
            </div>
          ) : (
            <div className="space-y-2 pr-4">
              {filteredDeliveries.map(delivery => (
                <Collapsible key={delivery.id}>
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left">
                        {getStatusIcon(delivery.status)}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{delivery.event_type}</span>
                            {getStatusBadge(delivery.status, delivery.status_code)}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{format(new Date(delivery.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</span>
                            {delivery.response_time_ms && (
                              <>
                                <span>•</span>
                                <span>{delivery.response_time_ms}ms</span>
                              </>
                            )}
                          </div>
                        </div>

                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t bg-muted/30 p-3 space-y-3">
                        {delivery.error_message && (
                          <div>
                            <p className="text-xs font-medium text-destructive mb-1">Erro:</p>
                            <p className="text-xs text-muted-foreground bg-destructive/10 p-2 rounded">
                              {delivery.error_message}
                            </p>
                          </div>
                        )}

                        <div>
                          <p className="text-xs font-medium mb-1">Payload:</p>
                          <pre className="text-xs bg-background p-2 rounded overflow-auto max-h-[200px] border">
                            {JSON.stringify(delivery.payload, null, 2)}
                          </pre>
                        </div>

                        {delivery.response_body && (
                          <div>
                            <p className="text-xs font-medium mb-1">Resposta:</p>
                            <pre className="text-xs bg-background p-2 rounded overflow-auto max-h-[100px] border">
                              {delivery.response_body}
                            </pre>
                          </div>
                        )}

                        {delivery.status === 'failed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => retryDelivery.mutate(delivery.id)}
                            disabled={retryDelivery.isPending}
                          >
                            {retryDelivery.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <RotateCcw className="h-4 w-4 mr-2" />
                            )}
                            Reenviar
                          </Button>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}
            </div>
          )}
        </ScrollArea>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Página {page} de {totalPages} ({totalCount} logs)
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
