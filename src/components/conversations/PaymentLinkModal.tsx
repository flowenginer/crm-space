import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  CreditCard, 
  Loader2, 
  Copy, 
  Send, 
  CheckCircle,
  Wallet,
  Link as LinkIcon,
  User,
  Calendar,
  DollarSign
} from 'lucide-react';
import { useCreatePaymentLink, usePaymentGatewayConfig } from '@/hooks/usePaymentLinks';
import { supabase } from '@/integrations/supabase/client';

interface PaymentLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: string | null;
  quoteId?: string | null;
  conversationId: string;
  contactId: string;
  channelId: string | null;
  contactPhone: string;
  defaultAmount: number;
  customerName: string;
  customerDocument?: string;
  customerEmail?: string;
  onSendMessage?: (message: string) => void;
}

export function PaymentLinkModal({
  open,
  onOpenChange,
  orderId,
  quoteId,
  conversationId,
  contactId,
  channelId,
  contactPhone,
  defaultAmount,
  customerName,
  customerDocument,
  customerEmail,
  onSendMessage,
}: PaymentLinkModalProps) {
  const { data: config, isLoading: isLoadingConfig } = usePaymentGatewayConfig();
  const createPaymentLink = useCreatePaymentLink();
  
  const [amount, setAmount] = useState(defaultAmount);
  const [description, setDescription] = useState('');
  const [enabledMethods, setEnabledMethods] = useState<string[]>(['credit_card', 'pix']);
  const [maxInstallments, setMaxInstallments] = useState(12);
  const [expirationDays, setExpirationDays] = useState(3);
  
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Initialize from config
  useEffect(() => {
    if (config) {
      setEnabledMethods(config.enabled_methods || ['credit_card', 'pix']);
      setMaxInstallments(config.max_installments || 12);
      setExpirationDays(config.default_expiration_days || 3);
    }
  }, [config]);

  // Reset when opening
  useEffect(() => {
    if (open) {
      setAmount(defaultAmount);
      setDescription(orderId ? `Pedido` : quoteId ? 'Orçamento' : 'Pagamento');
      setGeneratedLink(null);
      setCopied(false);
    }
  }, [open, defaultAmount, orderId, quoteId]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setAmount(Number(value) / 100);
  };

  const handleMethodToggle = (methodId: string) => {
    setEnabledMethods(prev => 
      prev.includes(methodId)
        ? prev.filter(m => m !== methodId)
        : [...prev, methodId]
    );
  };

  const handleGenerateLink = async () => {
    if (amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    if (enabledMethods.length === 0) {
      toast.error('Selecione pelo menos um método de pagamento');
      return;
    }

    try {
      const result = await createPaymentLink.mutateAsync({
        orderId: orderId || undefined,
        quoteId: quoteId || undefined,
        conversationId,
        contactId,
        amount,
        description,
        paymentMethods: enabledMethods,
        maxInstallments,
        expirationDays,
        customerName,
        customerDocument,
        customerEmail,
        customerPhone: contactPhone,
      });

      if (result.paymentLink?.url) {
        setGeneratedLink(result.paymentLink.url);
      }
    } catch (error) {
      console.error('Error generating payment link:', error);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;
    
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success('Link copiado!');
    
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendViaWhatsApp = async () => {
    if (!generatedLink || !channelId) return;

    const message = `💳 *Link de Pagamento*\n\n` +
      `Valor: *${formatCurrency(amount)}*\n` +
      (enabledMethods.includes('credit_card') ? `Parcelamento: até *${maxInstallments}x*\n` : '') +
      `\nClique no link abaixo para pagar:\n${generatedLink}`;

    if (onSendMessage) {
      onSendMessage(message);
      toast.success('Link enviado para o cliente!');
      onOpenChange(false);
    } else {
      // Fallback: copy message to clipboard
      await navigator.clipboard.writeText(message);
      toast.success('Mensagem copiada! Cole na conversa para enviar.');
    }
  };

  if (isLoadingConfig) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!config?.is_configured) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Gateway Não Configurado
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <p className="text-muted-foreground mb-4">
              Configure o gateway de pagamento Rede nas configurações de integrações para gerar links de pagamento.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Gerar Link de Pagamento
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 p-1">
            {/* Customer Info */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{customerName}</p>
                  <p className="text-sm text-muted-foreground">{contactPhone}</p>
                </div>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Valor da Cobrança
              </Label>
              <Input
                value={formatCurrency(amount)}
                onChange={handleAmountChange}
                placeholder="R$ 0,00"
                className="text-lg font-bold"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição do pagamento..."
                rows={2}
              />
            </div>

            {/* Payment Methods */}
            <div className="space-y-3">
              <Label>Formas de Pagamento</Label>
              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <span>Cartão de Crédito</span>
                  </div>
                  <Switch
                    checked={enabledMethods.includes('credit_card')}
                    onCheckedChange={() => handleMethodToggle('credit_card')}
                    disabled={!!generatedLink}
                  />
                </div>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-5 w-5 text-muted-foreground" />
                    <span>PIX</span>
                  </div>
                  <Switch
                    checked={enabledMethods.includes('pix')}
                    onCheckedChange={() => handleMethodToggle('pix')}
                    disabled={!!generatedLink}
                  />
                </div>
              </div>
            </div>

            {/* Installments (only if credit card is enabled) */}
            {enabledMethods.includes('credit_card') && (
              <div className="space-y-2">
                <Label>Parcelamento Máximo</Label>
                <Select 
                  value={maxInstallments.toString()}
                  onValueChange={(value) => setMaxInstallments(parseInt(value))}
                  disabled={!!generatedLink}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n}x {n === 1 ? '(à vista)' : 'sem juros'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Expiration */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Validade do Link
              </Label>
              <Select 
                value={expirationDays.toString()}
                onValueChange={(value) => setExpirationDays(parseInt(value))}
                disabled={!!generatedLink}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 dia</SelectItem>
                  <SelectItem value="3">3 dias</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="15">15 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Generated Link */}
            {generatedLink && (
              <div className="space-y-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Link gerado com sucesso!</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={generatedLink}
                    readOnly
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          {!generatedLink ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleGenerateLink}
                disabled={createPaymentLink.isPending || amount <= 0 || enabledMethods.length === 0}
              >
                {createPaymentLink.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LinkIcon className="mr-2 h-4 w-4" />
                )}
                Gerar Link
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button
                onClick={handleSendViaWhatsApp}
                disabled={!channelId}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Enviar via WhatsApp
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
