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
  Clock,
  Download,
  Printer,
  Send,
  MessageSquare,
  ArrowLeft,
  History,
  Building2,
  Phone,
  Mail
} from 'lucide-react';
import { useOrder, useOrderItems, useUpdateOrderStatus } from '@/hooks/useOrders';
import { useOrderStatuses } from '@/hooks/useOrderStatuses';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useGeneratePDF, PDFDocumentData } from '@/hooks/useGeneratePDF';
import { SendDocumentModal } from '@/components/orders/SendDocumentModal';
import { OrderTimeline } from '@/components/orders/OrderTimeline';
import { getProductDisplayName } from '@/lib/utils';

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
  const { data: companySettings } = useCompanySettings();
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

  // Calculate totals
  const totalItems = items.length;
  const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);

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
              <DialogTitle className="sr-only">
                {order ? `Pedido ${order.order_number}` : 'Carregando...'}
              </DialogTitle>
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
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="details">Detalhes</TabsTrigger>
                  <TabsTrigger value="timeline" className="gap-1">
                    <History className="h-4 w-4" />
                    Histórico
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[50vh] mt-4">
                  <TabsContent value="details" className="space-y-4 px-1">
                    {/* === HEADER DA EMPRESA === */}
                    <div className="bg-muted/50 border border-border rounded-lg p-4">
                      <div className="flex items-start gap-4">
                        {companySettings?.logo_url ? (
                          <img 
                            src={companySettings.logo_url} 
                            alt="Logo" 
                            className="h-14 w-14 object-contain rounded"
                          />
                        ) : (
                          <div className="h-14 w-14 bg-muted rounded flex items-center justify-center">
                            <Building2 className="h-7 w-7 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg truncate">
                            {companySettings?.company_name || 'Empresa'}
                          </h3>
                          {companySettings?.address && (
                            <p className="text-sm text-muted-foreground">
                              {companySettings.address}
                              {companySettings.city && ` - ${companySettings.city}`}
                              {companySettings.state && `/${companySettings.state}`}
                              {companySettings.zip_code && ` - ${companySettings.zip_code}`}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-4 mt-1 text-sm text-muted-foreground">
                            {companySettings?.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {companySettings.phone}
                              </span>
                            )}
                            {companySettings?.cnpj && (
                              <span>CNPJ: {companySettings.cnpj}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* === NÚMERO DO DOCUMENTO === */}
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <Package className="h-6 w-6 text-primary" />
                        <span className="text-xl font-bold text-primary">
                          PEDIDO Nº {order.order_number}
                        </span>
                        {currentStatusConfig && (
                          <Badge 
                            variant="secondary"
                            style={{ backgroundColor: currentStatusConfig.color, color: 'white' }}
                          >
                            {currentStatusConfig.name}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* === BARRA DE DATAS === */}
                    <div className="bg-muted/30 rounded-lg p-3 grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-xs text-muted-foreground">Criado em</span>
                          <p className="text-sm font-medium">
                            {order.created_at 
                              ? format(new Date(order.created_at), "dd/MM/yyyy", { locale: ptBR })
                              : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-xs text-muted-foreground">Status</span>
                          <p className="text-sm font-medium">
                            {currentStatusConfig?.name || order.status}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* === BOX DO CLIENTE === */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <User className="h-3 w-3" />
                        Cliente
                      </h4>
                      <div className="border-2 border-muted-foreground/40 rounded-lg p-4">
                        {order.contact ? (
                          <div className="space-y-1">
                            <p className="font-semibold text-lg">{order.contact.full_name}</p>
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              {order.contact.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {order.contact.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-muted-foreground">Nenhum cliente vinculado</p>
                        )}
                      </div>
                    </div>

                    {/* === OBSERVAÇÕES === */}
                    {order.notes && (
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Observações</p>
                        <p className="text-sm">{order.notes}</p>
                      </div>
                    )}

                    {/* === TABELA DE ITENS === */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Itens ({items.length})
                      </h4>
                      <div className="border border-border rounded-lg overflow-hidden">
                        {/* Header */}
                        <div className="bg-muted grid grid-cols-12 gap-2 p-3 text-xs font-semibold text-muted-foreground uppercase">
                          <div className="col-span-6">Descrição</div>
                          <div className="col-span-2 text-center">Qtd</div>
                          <div className="col-span-2 text-right">Unitário</div>
                          <div className="col-span-2 text-right">Subtotal</div>
                        </div>
                        {/* Items */}
                        {items.length === 0 ? (
                          <div className="p-4 text-center text-muted-foreground">
                            Nenhum item no pedido
                          </div>
                        ) : (
                          <div className="divide-y divide-border">
                            {items.map((item) => (
                              <div key={item.id} className="grid grid-cols-12 gap-2 p-3 text-sm">
                                <div className="col-span-6">
                                  <p className="font-medium">{getProductDisplayName(item.product_name, item.variation_name, item.sku)}</p>
                                  {item.sku && (
                                    <p className="text-xs text-muted-foreground">SKU: {item.sku}</p>
                                  )}
                                </div>
                                <div className="col-span-2 text-center">{item.quantity}</div>
                                <div className="col-span-2 text-right">{formatCurrency(item.unit_price)}</div>
                                <div className="col-span-2 text-right font-medium">{formatCurrency(item.subtotal)}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* === RESUMO === */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Resumo
                      </h4>
                      <div className="border border-border rounded-lg overflow-hidden">
                        {/* Header */}
                        <div className="bg-muted grid grid-cols-6 gap-2 p-2 text-xs font-semibold text-muted-foreground uppercase text-center">
                          <div>Nº Itens</div>
                          <div>Qtd Prod</div>
                          <div>Desconto</div>
                          <div>Subtotal</div>
                          <div>Frete</div>
                          <div>Total</div>
                        </div>
                        {/* Values */}
                        <div className="border-t-2 border-muted-foreground/40 grid grid-cols-6 gap-2 p-3 text-sm text-center">
                          <div>{totalItems}</div>
                          <div>{totalQuantity}</div>
                          <div className="text-destructive">
                            {order.discount_amount ? `-${formatCurrency(order.discount_amount)}` : '-'}
                          </div>
                          <div>{formatCurrency(order.subtotal)}</div>
                          <div>{order.shipping_cost ? formatCurrency(order.shipping_cost) : '-'}</div>
                          <div className="font-bold text-primary">{formatCurrency(order.total)}</div>
                        </div>
                      </div>
                    </div>

                    {/* === PAGAMENTO E ENTREGA === */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-muted/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <CreditCard className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase">Pagamento</span>
                        </div>
                        <p className="text-sm font-medium capitalize">
                          {order.payment_method?.replace('_', ' ') || 'Não definido'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Status: {order.payment_status === 'paid' ? 'Pago' : 'Pendente'}
                        </p>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs font-semibold text-muted-foreground uppercase">Entrega</span>
                        </div>
                        <p className="text-sm font-medium capitalize">
                          {order.shipping_method || 'Não definida'}
                        </p>
                      </div>
                    </div>

                    {/* === ALTERAR STATUS === */}
                    {!isFinalStatus && (
                      <div className="bg-muted/30 rounded-lg p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Alterar Status</p>
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
                    )}
                  </TabsContent>

                  <TabsContent value="timeline" className="px-1">
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
