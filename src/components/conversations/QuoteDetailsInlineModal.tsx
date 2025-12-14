import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { 
  FileText, 
  User, 
  Calendar, 
  CreditCard, 
  Truck, 
  ArrowRight,
  Clock,
  Download,
  Printer,
  Send,
  MessageSquare,
  ArrowLeft,
  Building2,
  Phone,
  Mail
} from 'lucide-react';
import { useQuote, useQuoteItems, useUpdateQuoteStatus, useConvertQuoteToOrder } from '@/hooks/useQuotes';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useGeneratePDF, PDFDocumentData } from '@/hooks/useGeneratePDF';
import { SendDocumentModal } from '@/components/orders/SendDocumentModal';
import { getProductDisplayName } from '@/lib/utils';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviado', variant: 'default' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
  expired: { label: 'Expirado', variant: 'outline' },
  converted: { label: 'Convertido', variant: 'default' },
};

interface QuoteDetailsInlineModalProps {
  quoteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string | null;
  conversationId: string;
  contactPhone: string;
  onBack?: () => void;
}

export function QuoteDetailsInlineModal({ 
  quoteId,
  open, 
  onOpenChange,
  channelId,
  conversationId,
  contactPhone,
  onBack,
}: QuoteDetailsInlineModalProps) {
  const [showSendModal, setShowSendModal] = useState(false);
  const { data: quote, isLoading: isLoadingQuote } = useQuote(quoteId);
  const { data: items = [] } = useQuoteItems(quoteId);
  const { data: companySettings } = useCompanySettings();
  const updateStatus = useUpdateQuoteStatus();
  const convertToOrder = useConvertQuoteToOrder();
  const [selectedStatus, setSelectedStatus] = useState(quote?.status || 'draft');
  const { downloadPDF, printPDF } = useGeneratePDF();

  // Update selected status when quote loads
  if (quote && quote.status !== selectedStatus && !updateStatus.isPending) {
    setSelectedStatus(quote.status);
  }

  const formatCurrency = (value: number | null) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!quote) return;
    setSelectedStatus(newStatus);
    await updateStatus.mutateAsync({ quoteId: quote.id, status: newStatus });
  };

  const handleConvertToOrder = async () => {
    if (!quote) return;
    await convertToOrder.mutateAsync(quote.id);
    onOpenChange(false);
  };

  if (!quoteId) return null;

  const isExpired = quote?.valid_until && new Date(quote.valid_until) < new Date();
  const canConvert = quote?.status === 'approved' && !isExpired;

  // Prepare PDF data
  const preparePDFData = (): PDFDocumentData | null => {
    if (!quote) return null;
    
    // Type assertion to access new fields
    const quoteData = quote as any;
    
    return {
      type: 'quote',
      number: quote.quote_number,
      date: quote.created_at ? format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: ptBR }) : '',
      validUntil: quote.valid_until ? format(new Date(quote.valid_until), 'dd/MM/yyyy', { locale: ptBR }) : undefined,
      contact: {
        name: quote.contact?.full_name || 'Cliente não informado',
        phone: quote.contact?.phone,
        email: quote.contact?.email,
      },
      items: items.map(item => ({
        name: item.product_name,
        variation: item.variation_name || undefined,
        sku: item.sku || undefined,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        subtotal: item.subtotal,
      })),
      subtotal: quote.subtotal || 0,
      discount: quote.discount_amount || undefined,
      shipping: quote.shipping_cost || undefined,
      total: quote.total || 0,
      paymentMethod: quote.payment_method || undefined,
      paymentCondition: quoteData.payment_condition || undefined,
      paymentSchedule: quoteData.payment_schedule || undefined,
      installments: quote.installments || undefined,
      notes: quote.notes || undefined,
    };
  };

  const handleDownloadPDF = () => {
    const pdfData = preparePDFData();
    if (!pdfData || !quote) return;
    downloadPDF(pdfData, `orcamento_${quote.quote_number}.pdf`);
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
                {quote ? `Orçamento ${quote.quote_number}` : 'Carregando...'}
              </DialogTitle>
            </div>
          </DialogHeader>

          {isLoadingQuote ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : quote ? (
            <>
              {/* Main Send Button - Prominent */}
              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-6 w-6 text-primary" />
                    <div>
                      <p className="font-medium">Enviar para o cliente</p>
                      <p className="text-sm text-muted-foreground">
                        Envie o orçamento diretamente via WhatsApp
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

              <ScrollArea className="h-[50vh] mt-4">
                <div className="space-y-4 px-1">
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
                      <FileText className="h-6 w-6 text-primary" />
                      <span className="text-xl font-bold text-primary">
                        ORÇAMENTO Nº {quote.quote_number}
                      </span>
                      <Badge variant={statusConfig[quote.status]?.variant || 'secondary'}>
                        {statusConfig[quote.status]?.label || quote.status}
                      </Badge>
                    </div>
                  </div>

                  {/* === BARRA DE DATAS === */}
                  <div className="bg-muted/30 rounded-lg p-3 grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-xs text-muted-foreground">Criado em</span>
                        <p className="text-sm font-medium">
                          {quote.created_at 
                            ? format(new Date(quote.created_at), "dd/MM/yyyy", { locale: ptBR })
                            : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <span className="text-xs text-muted-foreground">Válido até</span>
                        <p className={`text-sm font-medium ${isExpired ? 'text-destructive' : ''}`}>
                          {quote.valid_until 
                            ? format(new Date(quote.valid_until), "dd/MM/yyyy", { locale: ptBR })
                            : 'Sem validade'}
                          {isExpired && ' (Expirado)'}
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
                      {quote.contact ? (
                        <div className="space-y-1">
                          <p className="font-semibold text-lg">{quote.contact.full_name}</p>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            {quote.contact.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {quote.contact.phone}
                              </span>
                            )}
                            {quote.contact.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {quote.contact.email}
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
                  {quote.notes && (
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Observações</p>
                      <p className="text-sm">{quote.notes}</p>
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
                          Nenhum item no orçamento
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
                          {quote.discount_amount ? `-${formatCurrency(quote.discount_amount)}` : '-'}
                        </div>
                        <div>{formatCurrency(quote.subtotal)}</div>
                        <div>{quote.shipping_cost ? formatCurrency(quote.shipping_cost) : '-'}</div>
                        <div className="font-bold text-primary">{formatCurrency(quote.total)}</div>
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
                        {quote.payment_method?.replace('_', ' ') || 'Não definido'}
                        {quote.installments && quote.installments > 1 && ` (${quote.installments}x)`}
                      </p>
                    </div>
                    <div className="bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Entrega</span>
                      </div>
                      <p className="text-sm font-medium capitalize">
                        {quote.shipping_method || 'Não definida'}
                      </p>
                      {quote.expected_delivery_date && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Previsão: {format(new Date(quote.expected_delivery_date), 'dd/MM/yyyy')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* === ALTERAR STATUS === */}
                  {quote.status !== 'converted' && (
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Alterar Status</p>
                      <Select value={selectedStatus} onValueChange={handleStatusChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Rascunho</SelectItem>
                          <SelectItem value="sent">Enviado</SelectItem>
                          <SelectItem value="approved">Aprovado</SelectItem>
                          <SelectItem value="rejected">Rejeitado</SelectItem>
                          <SelectItem value="expired">Expirado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </ScrollArea>

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
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                    Fechar
                  </Button>
                
                  {canConvert && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" className="gap-2">
                          <ArrowRight className="h-4 w-4" />
                          Converter em Pedido
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Converter Orçamento em Pedido?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação irá criar um novo pedido com base neste orçamento e gerar 
                            um lançamento financeiro. O orçamento será marcado como convertido.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={handleConvertToOrder}
                            disabled={convertToOrder.isPending}
                          >
                            {convertToOrder.isPending ? 'Convertendo...' : 'Confirmar Conversão'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Orçamento não encontrado</p>
            </div>
          )}
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
          documentId={quoteId || undefined}
        />
      )}
    </>
  );
}
