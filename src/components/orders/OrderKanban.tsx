import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, User, AlertTriangle } from 'lucide-react';
import { Order, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useOrderStatuses } from '@/hooks/useOrderStatuses';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface OrderKanbanProps {
  orders: Order[];
  onViewOrder: (order: Order) => void;
}

const formatCurrency = (value: number | null) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

// Check if contact has complete registration for shipping
const isContactComplete = (contact: Order['contact']) => {
  if (!contact) return false;
  const c = contact as Record<string, unknown>;
  return !!(
    c.full_name &&
    c.cpf_cnpj &&
    c.zip_code &&
    c.street &&
    c.number &&
    c.neighborhood &&
    c.city &&
    c.state
  );
};

export function OrderKanban({ orders, onViewOrder }: OrderKanbanProps) {
  const { data: orderStatuses = [] } = useOrderStatuses(true);
  const updateStatus = useUpdateOrderStatus();
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);

  // Filtrar status não-finais para o kanban (exceto cancelado)
  const statusColumns = orderStatuses.filter(s => !s.is_final);

  const handleDragStart = (order: Order) => {
    setDraggedOrder(order);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (status: string) => {
    if (draggedOrder && draggedOrder.status !== status) {
      // Get the current status config
      const currentStatus = orderStatuses.find(s => s.value === draggedOrder.status);
      
      // Block status change if contact registration is incomplete (except for draft)
      if (status !== 'draft' && currentStatus?.value === 'draft') {
        if (!isContactComplete(draggedOrder.contact)) {
          toast.error('Cadastro do cliente incompleto', {
            description: 'Complete o cadastro do cliente antes de alterar o status do pedido.',
          });
          setDraggedOrder(null);
          return;
        }
      }
      
      await updateStatus.mutateAsync({ orderId: draggedOrder.id, status });
    }
    setDraggedOrder(null);
  };

  const getContactName = (order: Order) => {
    if (order.contact && 'full_name' in order.contact) {
      return (order.contact as { full_name: string }).full_name;
    }
    return 'Cliente não informado';
  };

  if (statusColumns.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Carregando status...
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {statusColumns.map((column) => {
        const columnOrders = orders.filter(o => o.status === column.value);
        
        return (
          <div
            key={column.value}
            className="flex-shrink-0 w-72"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(column.value)}
          >
            <Card className="h-full">
              <CardHeader className="py-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: column.color }}
                    />
                    <span>{column.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {columnOrders.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-[calc(100vh-350px)]">
                  <div className="space-y-3 pr-2">
                    {columnOrders.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        Nenhum pedido
                      </div>
                    ) : (
                      columnOrders.map((order) => {
                        const contactIncomplete = !isContactComplete(order.contact);
                        
                        return (
                          <div
                            key={order.id}
                            draggable
                            onDragStart={() => handleDragStart(order)}
                            className="p-3 rounded-lg border bg-card hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">#{order.order_number}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onViewOrder(order)}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                              <User className="h-3 w-3" />
                              <span className="truncate">{getContactName(order)}</span>
                              {contactIncomplete && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertTriangle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Cadastro incompleto para envio</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm text-emerald-600">
                                {formatCurrency(order.total)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {order.created_at && format(new Date(order.created_at), "dd/MM", { locale: ptBR })}
                              </span>
                            </div>

                            {order.payment_status === 'paid' && (
                              <Badge variant="default" className="mt-2 text-xs">
                                Pago
                              </Badge>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
