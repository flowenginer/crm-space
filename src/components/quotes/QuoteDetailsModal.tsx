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
  Store,
  ShoppingCart,
  ArrowRight,
  Clock,
  ExternalLink
} from 'lucide-react';
import { Quote, useQuoteItems, useUpdateQuoteStatus, useConvertQuoteToOrder } from '@/hooks/useQuotes';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Rascunho', variant: 'secondary' },
  sent: { label: 'Enviado', variant: 'default' },
  approved: { label: 'Aprovado', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
  expired: { label: 'Expirado', variant: 'outline' },
  converted: { label: 'Convertido', variant: 'default' },
};

interface QuoteDetailsModalProps {
  quote: Quote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuoteDetailsModal({ quote, open, onOpenChange }: QuoteDetailsModalProps) {
  const navigate = useNavigate();
  const { data: items = [] } = useQuoteItems(quote?.id || null);
  const updateStatus = useUpdateQuoteStatus();
  const convertToOrder = useConvertQuoteToOrder();
  const [selectedStatus, setSelectedStatus] = useState(quote?.status || 'draft');

  if (!quote) return null;

  const formatCurrency = (value: number | null) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const handleStatusChange = async (newStatus: string) => {
    setSelectedStatus(newStatus);
    await updateStatus.mutateAsync({ quoteId: quote.id, status: newStatus });
  };

  const handleConvertToOrder = async () => {
    await convertToOrder.mutateAsync(quote.id);
    onOpenChange(false);
  };

  const goToOrder = () => {
    if (quote.converted_to_order_id) {
      onOpenChange(false);
      navigate('/orders');
    }
  };

  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date();
  const canConvert = quote.status === 'approved' && !isExpired;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Orçamento {quote.quote_number}
            </DialogTitle>
            <Badge variant={statusConfig[quote.status]?.variant || 'secondary'}>
              {statusConfig[quote.status]?.label || quote.status}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="items">Itens ({items.length})</TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[55vh] mt-4">
            <TabsContent value="details" className="space-y-6 pr-4">
              {/* Cliente */}
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Cliente
                </h4>
                {quote.contact ? (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="font-medium">{quote.contact.full_name}</p>
                    <p className="text-sm text-muted-foreground">{quote.contact.phone}</p>
                    {quote.contact.email && (
                      <p className="text-sm text-muted-foreground">{quote.contact.email}</p>
                    )}
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
                    <span>{formatCurrency(quote.subtotal)}</span>
                  </div>
                  {(quote.discount_amount || quote.discount_percent) && (
                    <div className="flex justify-between text-destructive">
                      <span>Desconto:</span>
                      <span>-{formatCurrency(quote.discount_amount || 0)}</span>
                    </div>
                  )}
                  {quote.shipping_cost && quote.shipping_cost > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frete:</span>
                      <span>+{formatCurrency(quote.shipping_cost)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span className="text-primary">{formatCurrency(quote.total)}</span>
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
                    {quote.created_at 
                      ? format(new Date(quote.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : '-'}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Validade
                  </h4>
                  <p className={`text-sm ${isExpired ? 'text-destructive' : ''}`}>
                    {quote.valid_until 
                      ? format(new Date(quote.valid_until), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      : 'Sem validade definida'}
                    {isExpired && ' (Expirado)'}
                  </p>
                </div>
              </div>

              <Separator />

              {/* Pagamento e Entrega */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Forma de Pagamento
                  </h4>
                  <p className="text-sm capitalize">
                    {quote.payment_method?.replace('_', ' ') || 'Não definida'}
                    {quote.installments && quote.installments > 1 && ` (${quote.installments}x)`}
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Entrega
                  </h4>
                  <p className="text-sm capitalize">
                    {quote.shipping_method || 'Não definida'}
                  </p>
                  {quote.expected_delivery_date && (
                    <p className="text-xs text-muted-foreground">
                      Previsão: {format(new Date(quote.expected_delivery_date), 'dd/MM/yyyy')}
                    </p>
                  )}
                </div>
              </div>

              {/* Notas */}
              {quote.notes && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium">Observações</h4>
                    <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      {quote.notes}
                    </p>
                  </div>
                </>
              )}

              {/* Status do orçamento */}
              {quote.status !== 'converted' && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="font-medium">Alterar Status</h4>
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
                </>
              )}

              {/* Link para pedido convertido */}
              {quote.status === 'converted' && quote.converted_to_order_id && (
                <>
                  <Separator />
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-green-600 dark:text-green-400">
                          Convertido em Pedido
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {quote.converted_at && format(new Date(quote.converted_at), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={goToOrder}>
                        Ver Pedido
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="items" className="space-y-4 pr-4">
              {items.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum item no orçamento
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
          </ScrollArea>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          
          {canConvert && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className="gap-2">
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
      </DialogContent>
    </Dialog>
  );
}
