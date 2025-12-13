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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Package, Eye, BarChart3, Star, AlertTriangle, Pencil, Gift, Truck, Trash2, ChevronDown } from 'lucide-react';
import { useOrdersAdvanced, useContactOrderPositions, useUpdateOrderStatus, useDeleteOrder, Order } from '@/hooks/useOrders';
import { usePermissions } from '@/hooks/usePermissions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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

const SHIPPING_METHODS: Record<string, string> = {
  sedex: 'Sedex',
  pac: 'PAC',
  motoboy: 'Motoboy',
  pickup: 'Retirada',
  other: 'Outro',
};

export default function Orders() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [filters, setFilters] = useState<OrderFiltersState>(initialFilters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

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
    // Novos filtros
    store_id: filters.storeId !== 'all' ? filters.storeId : undefined,
    order_type: filters.orderType !== 'all' ? filters.orderType : undefined,
    fulfillment_status: filters.fulfillmentStatus !== 'all' ? filters.fulfillmentStatus : undefined,
    installments: filters.installments !== 'all' ? filters.installments : undefined,
    has_tracking: filters.hasTracking || undefined,
    expected_delivery_from: filters.expectedDeliveryFrom || undefined,
    expected_delivery_to: filters.expectedDeliveryTo || undefined,
    use_order_date: filters.useOrderDate || undefined,
    payment_condition: filters.paymentCondition !== 'all' ? filters.paymentCondition : undefined,
  }), [filters]);

  const { data: orders = [], isLoading } = useOrdersAdvanced(hookFilters);
  const updateOrderStatus = useUpdateOrderStatus();

  // Obter IDs dos contatos e pedidos para calcular posições
  const orderIds = useMemo(() => orders.map(o => o.id), [orders]);
  const contactIds = useMemo(() => 
    orders
      .map(o => o.contact_id)
      .filter((id): id is string => !!id),
    [orders]
  );

  const { data: orderPositions = {} } = useContactOrderPositions(orderIds, contactIds);
  const deleteOrder = useDeleteOrder();
  const { hasPermission, isAdmin, isSupervisor } = usePermissions();

  const canDeleteOrder = isAdmin || isSupervisor || hasPermission('orders', 'delete');

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
      if (filters.isFirstPurchase) {
        const position = orderPositions[order.id] || 0;
        if (position !== 1) return false;
      }
      
      return true;
    });
  }, [orders, filters.search, filters.isFirstPurchase, orderPositions]);

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

  const getOrderPosition = (order: Order) => {
    return orderPositions[order.id] || 0;
  };

  const getPositionLabel = (position: number) => {
    if (position === 1) return '1ª compra';
    if (position === 2) return '2º pedido';
    if (position === 3) return '3º pedido';
    return `${position}º pedido`;
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

  const getRemainingAmount = (order: Order) => {
    const total = order.total || 0;
    const paid = order.paid_amount || 0;
    return total - paid;
  };

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsOpen(true);
  };

  const handleRowClick = (order: Order) => {
    handleViewOrder(order);
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    await updateOrderStatus.mutateAsync({ orderId, status: newStatus });
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    // TODO: Implementar modo de edição no OrderModal
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Pedidos</h1>
            <p className="text-muted-foreground">Gerencie seus pedidos e vendas</p>
          </div>
          <Button onClick={() => { setEditingOrder(null); setIsModalOpen(true); }}>
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
                          <TableHead>Frete</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOrders.map((order) => {
                          const position = getOrderPosition(order);
                          const remainingAmount = getRemainingAmount(order);
                          
                          return (
                            <TableRow 
                              key={order.id}
                              className="cursor-pointer hover:bg-muted/50 transition-colors"
                              onClick={() => handleRowClick(order)}
                            >
                              <TableCell className="font-medium">
                                #{order.order_number}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{getContactName(order)}</span>
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
                                  {getContactPhone(order) && (
                                    <div className="text-sm text-muted-foreground">
                                      {getContactPhone(order)}
                                    </div>
                                  )}
                                  {position > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Badge 
                                        variant={position === 1 ? 'default' : 'secondary'} 
                                        className={position === 1 ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
                                      >
                                        {position === 1 && <Star className="h-3 w-3 mr-1 fill-current" />}
                                        {getPositionLabel(position)}
                                      </Badge>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Select
                                  value={order.status}
                                  onValueChange={(value) => handleStatusChange(order.id, value)}
                                >
                                  <SelectTrigger className="h-auto w-auto border-0 bg-transparent p-0 shadow-none focus:ring-0 [&>svg]:hidden">
                                    <Badge variant={statusConfig[order.status]?.variant || 'secondary'} className="cursor-pointer gap-1">
                                      {statusConfig[order.status]?.label || order.status}
                                      <ChevronDown className="h-3 w-3" />
                                    </Badge>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(statusConfig).map(([value, config]) => (
                                      <SelectItem key={value} value={value}>
                                        <Badge variant={config.variant}>
                                          {config.label}
                                        </Badge>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <Badge variant={paymentStatusConfig[order.payment_status || 'pending']?.variant || 'outline'}>
                                    {paymentStatusConfig[order.payment_status || 'pending']?.label || order.payment_status}
                                  </Badge>
                                  {order.payment_status !== 'paid' && remainingAmount > 0 && (
                                    <div className="text-xs text-muted-foreground">
                                      Falta: {formatCurrency(remainingAmount)}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  {order.is_free_shipping ? (
                                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                      <Gift className="h-3 w-3 mr-1" />
                                      Grátis
                                    </Badge>
                                  ) : (
                                    <>
                                      {(order.shipping_cost || 0) > 0 && (
                                        <div className="text-sm font-medium">
                                          {formatCurrency(order.shipping_cost)}
                                        </div>
                                      )}
                                      {order.shipping_method && (
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                          <Truck className="h-3 w-3" />
                                          {SHIPPING_METHODS[order.shipping_method] || order.shipping_method}
                                        </div>
                                      )}
                                      {!order.shipping_method && (order.shipping_cost || 0) === 0 && (
                                        <span className="text-xs text-muted-foreground">-</span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {formatCurrency(order.total)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {order.created_at && format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleEditOrder(order)}
                                        >
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Editar pedido</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleViewOrder(order)}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Visualizar pedido</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  {canDeleteOrder && (
                                    <AlertDialog>
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <AlertDialogTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            </AlertDialogTrigger>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Excluir pedido</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Excluir Pedido</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Tem certeza que deseja excluir o pedido #{order.order_number}? Esta ação não pode ser desfeita.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => deleteOrder.mutate(order.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Excluir
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
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