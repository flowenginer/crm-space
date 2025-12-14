import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Package, 
  Plus, 
  Eye, 
  RefreshCw,
  Calendar,
  DollarSign,
  User,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { useContactHistory, ContactOrder } from '@/hooks/useContactHistory';
import { useOrderStatuses } from '@/hooks/useOrderStatuses';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrderSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  contactName?: string;
  onSelectOrder: (order: ContactOrder) => void;
  onCreateNew: () => void;
  onReopenOrder: (order: ContactOrder) => void;
}

export function OrderSelectionModal({
  open,
  onOpenChange,
  contactId,
  contactName,
  onSelectOrder,
  onCreateNew,
  onReopenOrder,
}: OrderSelectionModalProps) {
  const [activeTab, setActiveTab] = useState<'view' | 'reopen'>('view');
  const { orders, isLoading } = useContactHistory(contactId);
  const { data: orderStatuses = [] } = useOrderStatuses();

  const formatCurrency = (value: number | null) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  // Get status config from dynamic statuses
  const getStatusConfig = (status: string) => {
    const statusConfig = orderStatuses.find(s => s.value === status);
    return {
      label: statusConfig?.name || status,
      color: statusConfig?.color || '#6B7280',
      isFinal: statusConfig?.is_final || false,
    };
  };

  // Separate orders by status - consider "cancelled" status as reopenable
  const cancelledStatusValue = 'cancelled';
  const activeOrders = orders.filter(o => o.status !== cancelledStatusValue);
  const cancelledOrders = orders.filter(o => o.status === cancelledStatusValue);

  const displayOrders = activeTab === 'view' ? orders : cancelledOrders;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Pedidos {contactName && `de ${contactName}`}
          </DialogTitle>
          <DialogDescription>
            Escolha uma opção para continuar
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action Buttons */}
          <div className="grid grid-cols-1 gap-2">
            <Button
              variant="default"
              className="w-full justify-start gap-3 h-14"
              onClick={() => {
                onCreateNew();
                onOpenChange(false);
              }}
            >
              <Plus className="h-5 w-5" />
              <div className="text-left">
                <p className="font-medium">Criar novo pedido</p>
                <p className="text-xs text-primary-foreground/70">Iniciar um pedido do zero</p>
              </div>
            </Button>
          </div>

          {/* Tabs for view/reopen */}
          {orders.length > 0 && (
            <>
              <div className="flex gap-2 border-b border-border">
                <button
                  onClick={() => setActiveTab('view')}
                  className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                    activeTab === 'view' 
                      ? 'text-primary border-b-2 border-primary' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Eye className="h-4 w-4 inline mr-1" />
                  Ver existentes ({orders.length})
                </button>
                {cancelledOrders.length > 0 && (
                  <button
                    onClick={() => setActiveTab('reopen')}
                    className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                      activeTab === 'reopen' 
                        ? 'text-primary border-b-2 border-primary' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <RefreshCw className="h-4 w-4 inline mr-1" />
                    Cancelados ({cancelledOrders.length})
                  </button>
                )}
              </div>

              {/* Order List */}
              <ScrollArea className="h-[300px]">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : displayOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <Package className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">
                      {activeTab === 'reopen' 
                        ? 'Nenhum pedido cancelado' 
                        : 'Nenhum pedido encontrado'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 pr-2">
                    {displayOrders.map((order) => {
                      const statusConfig = getStatusConfig(order.status);
                      return (
                        <button
                          key={order.id}
                          onClick={() => {
                            if (activeTab === 'reopen') {
                              onReopenOrder(order);
                            } else {
                              onSelectOrder(order);
                            }
                            onOpenChange(false);
                          }}
                          className="w-full p-3 bg-muted/50 hover:bg-muted rounded-lg transition-colors text-left group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">
                                  #{order.order_number}
                                </span>
                                <Badge 
                                  variant="secondary"
                                  className="text-xs"
                                  style={{ backgroundColor: statusConfig.color, color: 'white' }}
                                >
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              
                              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  {formatCurrency(order.total)}
                                </span>
                                {order.seller_profile?.full_name && (
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {order.seller_profile.full_name.split(' ')[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </>
          )}

          {/* Empty state - no orders */}
          {!isLoading && orders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
              <Package className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Este cliente ainda não tem pedidos</p>
              <p className="text-xs mt-1">Clique no botão acima para criar o primeiro</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
