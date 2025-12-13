import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Package, Eye, BarChart3, Star, AlertTriangle } from 'lucide-react';
import { useOrdersAdvanced, useContactOrderCounts, Order } from '@/hooks/useOrders';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { OrderModal } from '@/components/orders/OrderModal';
import { OrderDetailsModal } from '@/components/orders/OrderDetailsModal';
import { OrdersDashboard } from '@/components/orders/OrdersDashboard';
import { OrderKanban } from '@/components/orders/OrderKanban';
import { OrderFilters, OrderFiltersState, initialFilters } from '@/components/orders/OrderFilters';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  pending: { label: 'Pendente', variant: 'outline' },
  confirmed: { label: 'Confirmado', variant: 'default' },
  processing: { label: 'Processando', variant: 'default' },
  shipped: { label: 'Enviado', variant: 'default' },
  delivered: { label: 'Entregue', variant: 'default' },
  canceled: { label: 'Cancelado', variant: 'destructive' },
};

const paymentStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'outline' },
  paid: { label: 'Pago', variant: 'default' },
  refunded: { label: 'Reembolsado', variant: 'destructive' },
  partial: { label: 'Parcial', variant: 'secondary' },
};

export default function Orders() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [filters, setFilters] = useState<OrderFiltersState>(initialFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  // Converter filtros do componente para o hook
  const hookFilters = useMemo(() => ({
    status: filters.status !== 'all' ? filters.status : undefined,
    assigned_to: filters.assignedTo !== 'all' ? filters.assignedTo : undefined,
    payment_status: filters.paymentStatus !== 'all' ? filters.paymentStatus : undefined,
    payment_method: filters.paymentMethod !== 'all' ? filters.paymentMethod : undefined,
    shipping_method: filters.shippingMethod !== 'all' ? filters.shippingMethod : undefined,
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
    min_total: filters.minTotal ? parseFloat(filters.minTotal) : undefined,
    max_total: filters.maxTotal ? parseFloat(filters.maxTotal) : undefined,
    has_discount: filters.hasDiscount || undefined,
    has_conversation: filters.hasConversation || undefined,
  }), [filters]);

  const { data: orders = [], isLoading } = useOrdersAdvanced(hookFilters);

  // Obter IDs dos contatos para verificar primeira compra
  const contactIds = useMemo(() => 
    orders
      .map(o => o.contact_id)
      .filter((id): id is string => !!id),
    [orders]
  );

  const { data: orderCounts = {} } = useContactOrderCounts(contactIds);

  // Filtrar por busca textual e primeira compra
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Filtro de busca textual
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const contactName = order.contact?.full_name || '';
        const contactPhone = order.contact?.phone || '';
        const matchesSearch = 
          order.order_number.toLowerCase().includes(search) ||
          contactName.toLowerCase().includes(search) ||
          contactPhone.includes(search);
        if (!matchesSearch) return false;
      }
      
      // Filtro de primeira compra
      if (filters.isFirstPurchase && order.contact_id) {
        const count = orderCounts[order.contact_id] || 0;
        if (count > 1) return false;
      }
      
      return true;
    });
  }, [orders, filters.search, filters.isFirstPurchase, orderCounts]);

  // Excluir cancelados do kanban
  const kanbanOrders = filteredOrders.filter(o => o.status !== 'canceled');

  const formatCurrency = (value: number | null) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const getContactName = (order: Order) => {
    return order.contact?.full_name || 'Cliente não informado';
  };

  const getContactPhone = (order: Order) => {
    return order.contact?.phone || null;
  };

  const isFirstPurchase = (order: Order) => {
    if (!order.contact_id) return false;
    return (orderCounts[order.contact_id] || 0) === 1;
  };

  const isContactComplete = (contact: Order['contact']) => {
    if (!contact) return false;
    return !!(
      contact.full_name &&
      contact.cpf_cnpj &&
      contact.zip_code &&
      contact.street &&
      contact.number &&
      contact.neighborhood &&
      contact.city &&
      contact.state
    );
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };

  return (
    <>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pedidos</h1>
            <p className="text-muted-foreground">Gerencie seus pedidos e vendas</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Pedido
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2">
              <Package className="h-4 w-4" />
              Pedidos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <OrdersDashboard orders={orders} />
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <OrderFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                />
              </CardContent>
            </Card>

            {/* Content */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando pedidos...
              </div>
            ) : viewMode === 'kanban' ? (
              <OrderKanban orders={kanbanOrders} onViewOrder={handleViewOrder} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Lista de Pedidos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredOrders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Nenhum pedido encontrado
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">
                              #{order.order_number}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div>
                                  <div className="font-medium">
                                    {getContactName(order)}
                                  </div>
                                  {getContactPhone(order) && (
                                    <div className="text-sm text-muted-foreground">
                                      {getContactPhone(order)}
                                    </div>
                                  )}
                                </div>
                                {isFirstPurchase(order) && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Primeira compra</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                                {!isContactComplete(order.contact) && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Cadastro incompleto para envio</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusConfig[order.status]?.variant || 'secondary'}>
                                {statusConfig[order.status]?.label || order.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={paymentStatusConfig[order.payment_status || 'pending']?.variant || 'outline'}>
                                {paymentStatusConfig[order.payment_status || 'pending']?.label || order.payment_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(order.total)}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {order.created_at && format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewOrder(order)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <OrderModal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
      />

      <OrderDetailsModal
        order={selectedOrder}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </>
  );
}
