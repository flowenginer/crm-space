import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Order, useOrderItems, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useCreateTransaction } from '@/hooks/useFinancial';
import { useOrderStatuses } from '@/hooks/useOrderStatuses';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Package, User, CreditCard, Calendar, Receipt, History, Download, Printer, Send } from 'lucide-react';
import { OrderTimeline } from './OrderTimeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useGeneratePDF, PDFDocumentData } from '@/hooks/useGeneratePDF';
import { SendDocumentModal } from './SendDocumentModal';
import { useConversations } from '@/hooks/useConversations';

interface OrderDetailsModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrderDetailsModal({ order, open, onOpenChange }: OrderDetailsModalProps) {
  const [showSendModal, setShowSendModal] = useState(false);
  const { data: items = [] } = useOrderItems(order?.id || null);
  const { data: orderStatuses = [] } = useOrderStatuses();
  const updateStatus = useUpdateOrderStatus();
  const createTransaction = useCreateTransaction();
  const { downloadPDF, printPDF } = useGeneratePDF();
  const { data: conversations = [] } = useConversations();

  if (!order) return null;

  // Find active statuses for dropdown
  const activeStatuses = orderStatuses.filter(s => s.is_active);
  
  // Find current status config
  const currentStatusConfig = orderStatuses.find(s => s.value === order.status);
  
  // Check if current status is final
  const isFinalStatus = currentStatusConfig?.is_final ?? false;

  // Find conversation for this contact
  const conversation = conversations.find(c => c.contact_id === order.contact_id);

  const formatCurrency = (value: number | null) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const handleStatusChange = async (newStatus: string) => {
    await updateStatus.mutateAsync({ orderId: order.id, status: newStatus });
  };

  const handleGenerateReceivable = async () => {
    if (!order.total || order.total <= 0) {
      toast.error('Pedido sem valor para gerar conta a receber');
      return;
    }

    await createTransaction.mutateAsync({
      type: 'income',
      amount: order.total,
      description: `Pedido #${order.order_number}`,
      due_date: new Date().toISOString().split('T')[0],
      contact_id: order.contact_id || undefined,
      order_id: order.id,
    });

    toast.success('Conta a receber gerada com sucesso!');
  };

  // Helper to get badge variant from color
  const getVariantFromColor = (color?: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (!color) return 'secondary';
    if (color.includes('red') || color.includes('rose')) return 'destructive';
    if (color.includes('gray') || color.includes('slate')) return 'outline';
    return 'default';
  };

  // Prepare PDF data
  const preparePDFData = (): PDFDocumentData => ({
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
  });

  const handleDownloadPDF = () => {
    downloadPDF(preparePDFData(), `pedido_${order.order_number}.pdf`);
    toast.success('PDF baixado com sucesso!');
  };

  const handlePrintPDF = () => {
    printPDF(preparePDFData());
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Pedido #{order.order_number}</span>
            <Badge 
              variant={getVariantFromColor(currentStatusConfig?.color)}
              style={currentStatusConfig?.color ? { backgroundColor: currentStatusConfig.color, color: 'white' } : undefined}
            >
              {currentStatusConfig?.name || order.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <ScrollArea className="max-h-[60vh] px-4">
              <div className="space-y-6 pt-4">
                {/* Cliente */}
                <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                  <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <h3 className="font-medium">Cliente</h3>
                    <p className="text-sm text-muted-foreground">
                      {order.contact?.full_name || 'Cliente não informado'}
                    </p>
                    {order.contact?.phone && (
                      <p className="text-sm text-muted-foreground">{order.contact.phone}</p>
                    )}
                  </div>
                </div>

                {/* Itens */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-medium">Itens do Pedido</h3>
                  </div>
                  <div className="border rounded-lg divide-y">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3">
                        <div>
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
                    ))}
                  </div>
                </div>

                {/* Totais */}
                <div className="space-y-2 p-4 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  {(order.discount_amount || 0) > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>Desconto</span>
                      <span>-{formatCurrency(order.discount_amount)}</span>
                    </div>
                  )}
                  {(order.shipping_cost || 0) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Frete</span>
                      <span>{formatCurrency(order.shipping_cost)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                </div>

                {/* Pagamento */}
                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-medium">Pagamento</h3>
                    <p className="text-sm text-muted-foreground">
                      Status: {order.payment_status === 'paid' ? 'Pago' : 'Pendente'}
                    </p>
                    {order.payment_method && (
                      <p className="text-sm text-muted-foreground">
                        Método: {order.payment_method}
                      </p>
                    )}
                  </div>
                </div>

                {/* Datas */}
                <div className="flex items-start gap-3 p-4 border rounded-lg">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <h3 className="font-medium">Informações</h3>
                    <p className="text-sm text-muted-foreground">
                      Criado em: {order.created_at && format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                {/* Observações */}
                {order.notes && (
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">Observações</h3>
                    <p className="text-sm text-muted-foreground">{order.notes}</p>
                  </div>
                )}

                {/* Alterar Status */}
                {!isFinalStatus && (
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-3">Alterar Status</h3>
                    <Select value={order.status} onValueChange={handleStatusChange}>
                      <SelectTrigger>
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
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="timeline">
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="pt-4">
                <OrderTimeline order={order} />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex flex-wrap justify-between gap-2 pt-4 border-t">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrintPDF}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            {order.contact?.phone && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowSendModal(true)}
              >
                <Send className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateReceivable}
              disabled={createTransaction.isPending}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Gerar Conta
            </Button>
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Send Document Modal */}
    <SendDocumentModal
      open={showSendModal}
      onOpenChange={setShowSendModal}
      documentData={preparePDFData()}
      contactPhone={order.contact?.phone || ''}
      channelId={conversation?.channel_id || null}
      conversationId={conversation?.id}
    />
    </>
  );
}
