import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Package, 
  User, 
  Calendar, 
  CreditCard, 
  Truck, 
  ShoppingCart,
  Clock,
  Download,
  Printer,
  Send,
  MessageSquare,
  ArrowLeft,
  History
} from 'lucide-react';
import { useOrder, useOrderItems, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useOrderStatuses } from '@/hooks/useOrderStatuses';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useGeneratePDF, PDFDocumentData } from '@/hooks/useGeneratePDF';
import { SendDocumentModal } from '@/components/orders/SendDocumentModal';
import { OrderTimeline } from '@/components/orders/OrderTimeline';

interface OrderDetailsInlineModalProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string | null;
  conversationId: string;
  contactPhone: string;
  onBack?: () => void;
}

export function OrderDetailsInlineModal({ 
  orderId,
  open, 
  onOpenChange,
  channelId,
  conversationId,
  contactPhone,
  onBack,
}: OrderDetailsInlineModalProps) {
  const [showSendModal, setShowSendModal] = useState(false);
  const { data: order, isLoading: isLoadingOrder } = useOrder(orderId);
  const { data: items = [] } = useOrderItems(orderId);
  const { data: orderStatuses = [] } = useOrderStatuses();
  const updateStatus = useUpdateOrderStatus();
  const [selectedStatus, setSelectedStatus] = useState(order?.status || '');
  const { downloadPDF, printPDF } = useGeneratePDF();

  // Update selected status when order loads
  if (order && order.status !== selectedStatus && !updateStatus.isPending) {
    setSelectedStatus(order.status);
  }

  const formatCurrency = (value: number | null) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;
    setSelectedStatus(newStatus);
    await updateStatus.mutateAsync({ orderId: order.id, status: newStatus });
  };

  if (!orderId) return null;

  // Get current status config
  const currentStatusConfig = orderStatuses.find(s => s.value === order?.status);
  const isFinalStatus = currentStatusConfig?.is_final ?? false;
  const activeStatuses = orderStatuses.filter(s => s.is_active);

  // Prepare PDF data
  const preparePDFData = (): PDFDocumentData | null => {
    if (!order) return null;
    return {
      type: 'order',
      number: order.order_number,
      date: order.created_at ? format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ptBR }) : '',
      contact: {
        name: order.contact?.full_name || 'Cliente não informado',
        phone: order.contact?.phone,
      },
      items: items.map(item => ({
        name: item.product_name,
        variation: item.variation_name || undefined,
        sku: item.sku || undefined,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        subtotal: item.subtotal,
      })),
      subtotal: order.subtotal || 0,
      discount: order.discount_amount || undefined,
      shipping: order.shipping_cost || undefined,
      total: order.total || 0,
      paymentMethod: order.payment_method || undefined,
      notes: order.notes || undefined,
    };
  };

  const handleDownloadPDF = () => {
    const pdfData = preparePDFData();
    if (!pdfData || !order) return;
    downloadPDF(pdfData, `pedido_${order.order_number}.pdf`);
    toast.success('PDF baixado com sucesso!');
  };

  const handlePrintPDF = () => {
    const pdfData = preparePDFData();
    if (!pdfData) return;
    printPDF(pdfData);
  };

  const pdfData = preparePDFData();

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              {onBack && (
                <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="flex items-center justify-between flex-1">
                <DialogTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {order ? `Pedido ${order.order_number}` : 'Carregando...'}
                </DialogTitle>
                {order && currentStatusConfig && (
                  <Badge 
                    variant="secondary"
                    style={{ backgroundColor: currentStatusConfig.color, color: 'white' }}
                  >
                    {currentStatusConfig.name}
                  </Badge>
                )}
              </div>
            </div>
          </DialogHeader>

          {isLoadingOrder ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : order ? (
            <>
              {/* Main Send Button - Prominent */}
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-medium">Enviar para o cliente</p>
                      <p className="text-sm text-muted-foreground">
                        Envie o pedido diretamente via WhatsApp
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowSendModal(true)}
                    disabled={!channelId}
                    className="gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Enviar via WhatsApp
                  </Button>
                </div>
                {!channelId && (
                  <p className="text-xs text-destructive mt-2">
                    Não há canal de WhatsApp associado a esta conversa
                  </p>
                )}
              </div>

              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
                  <TabsTrigger value="items">Itens ({items.length})</TabsTrigger>
                  <TabsTrigger value="timeline" className="gap-1">
                    <History className="h-4 w-4" />
                    Histórico
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[40vh] mt-4">
                  <TabsContent value="details" className="space-y-6 px-4">
                    {/* Cliente */}
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Cliente
                      </h4>
                      {order.contact ? (
                        <div className="bg-muted/50 p-3 rounded-lg">
                          <p className="font-medium">{order.contact.full_name}</p>
                          <p className="text-sm text-muted-foreground">{order.contact.phone}</p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">Nenhum cliente vinculado</p>
                      )}
                    </div>

                    <Separator />

                    {/* Valores */}
                    <div className="space-y-2">
                      <h4 className="font-medium flex items-center gap-2">
                        <ShoppingCart className="h-4 w-4" />
                        Valores
                      </h4>
                      <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal:</span>
                          <span>{formatCurrency(order.subtotal)}</span>
                        </div>
                        {(order.discount_amount || 0) > 0 && (
                          <div className="flex justify-between text-destructive">
                            <span>Desconto:</span>
                            <span>-{formatCurrency(order.discount_amount || 0)}</span>
                          </div>
                        )}
                        {(order.shipping_cost || 0) > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Frete:</span>
                            <span>+{formatCurrency(order.shipping_cost || 0)}</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total:</span>
                          <span className="text-primary">{formatCurrency(order.total)}</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Datas */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Data de Criação
                        </h4>
                        <p className="text-sm">
                          {order.created_at 
                            ? format(new Date(order.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                            : '-'}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Status
                        </h4>
                        <p className="text-sm">
                          {currentStatusConfig?.name || order.status}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Pagamento e Entrega */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <CreditCard className="h-4 w-4" />
                          Pagamento
                        </h4>
                        <p className="text-sm capitalize">
                          {order.payment_method?.replace('_', ' ') || 'Não definido'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Status: {order.payment_status === 'paid' ? 'Pago' : 'Pendente'}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          Entrega
                        </h4>
                        <p className="text-sm capitalize">
                          {order.shipping_method || 'Não definida'}
                        </p>
                      </div>
                    </div>

                    {/* Notas */}
                    {order.notes && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <h4 className="font-medium">Observações</h4>
                          <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                            {order.notes}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Status */}
                    {!isFinalStatus && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <h4 className="font-medium">Alterar Status</h4>
                          <Select value={selectedStatus} onValueChange={handleStatusChange}>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {activeStatuses.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  {status.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="items" className="space-y-4 px-4">
                    {items.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        Nenhum item no pedido
                      </p>
                    ) : (
                      items.map((item) => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium">{item.product_name}</p>
                            {item.variation_name && (
                              <p className="text-sm text-muted-foreground">{item.variation_name}</p>
                            )}
                            {item.sku && (
                              <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(item.subtotal)}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.quantity}x {formatCurrency(item.unit_price)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="timeline" className="px-4">
                    <OrderTimeline order={order} />
                  </TabsContent>
                </ScrollArea>
              </Tabs>

              <div className="flex flex-wrap justify-between items-center gap-2 pt-4 border-t">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={handlePrintPDF}>
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Send Document Modal */}
      {pdfData && (
        <SendDocumentModal
          open={showSendModal}
          onOpenChange={setShowSendModal}
          documentData={pdfData}
          contactPhone={contactPhone}
          channelId={channelId}
          conversationId={conversationId}
        />
      )}
    </>
  );
}
