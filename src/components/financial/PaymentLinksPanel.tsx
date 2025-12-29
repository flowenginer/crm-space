import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { 
  Plus, 
  Loader2, 
  Copy, 
  ExternalLink,
  CreditCard,
  Wallet,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Search,
  Link as LinkIcon,
  Trash2
} from 'lucide-react';
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
import { useAllPaymentLinks, useCreatePaymentLink, useDeletePaymentLink, useIsPaymentGatewayConfigured, PaymentLink } from '@/hooks/usePaymentLinks';

// Rede Logo SVG inline
const RedeLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="120" height="40" rx="4" fill="#FF6600"/>
    <text x="60" y="26" textAnchor="middle" fill="white" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="18">
      rede
    </text>
  </svg>
);

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Aguardando', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30', icon: Clock },
  paid: { label: 'Pago', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', icon: CheckCircle },
  expired: { label: 'Expirado', color: 'bg-rose-500/10 text-rose-600 border-rose-500/30', icon: XCircle },
  cancelled: { label: 'Cancelado', color: 'bg-muted text-muted-foreground border-border', icon: XCircle },
};

export function PaymentLinksPanel() {
  const { isConfigured, isLoading: configLoading, config } = useIsPaymentGatewayConfigured();
  const { data: paymentLinks = [], isLoading, refetch } = useAllPaymentLinks();
  const createPaymentLink = useCreatePaymentLink();
  const deletePaymentLink = useDeletePaymentLink();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerDocument: '',
    paymentMethods: ['credit_card', 'pix'] as string[],
    maxInstallments: config?.max_installments || 12,
    expirationDays: config?.default_expiration_days || 3,
  });

  const formatCurrency = (value: number | null | undefined) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  const handleMethodToggle = (methodId: string) => {
    setFormData(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.includes(methodId)
        ? prev.paymentMethods.filter(m => m !== methodId)
        : [...prev.paymentMethods, methodId],
    }));
  };

  const handleSubmit = async () => {
    const amount = parseFloat(formData.amount.replace(/[^\d,]/g, '').replace(',', '.'));
    
    if (!amount || amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    if (formData.paymentMethods.length === 0) {
      toast.error('Selecione pelo menos um método de pagamento');
      return;
    }

    try {
      await createPaymentLink.mutateAsync({
        conversationId: '', // Will be generated server-side or not linked
        contactId: '', // Will be generated server-side or not linked
        amount: amount * 100, // Convert to cents
        description: formData.description || 'Cobrança manual',
        paymentMethods: formData.paymentMethods,
        maxInstallments: formData.maxInstallments,
        expirationDays: formData.expirationDays,
        customerName: formData.customerName,
        customerDocument: formData.customerDocument,
        customerEmail: formData.customerEmail,
        customerPhone: formData.customerPhone,
      });

      // Reset form
      setFormData({
        amount: '',
        description: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        customerDocument: '',
        paymentMethods: ['credit_card', 'pix'],
        maxInstallments: config?.max_installments || 12,
        expirationDays: config?.default_expiration_days || 3,
      });
      setIsFormOpen(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const filteredLinks = paymentLinks.filter(link => {
    if (!searchTerm) return true;
    return (
      link.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      link.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF6600]" />
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-[#FF6600]/10 flex items-center justify-center mb-4">
            <CreditCard className="h-8 w-8 text-[#FF6600]" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Gateway não configurado</h3>
          <p className="text-muted-foreground mb-4 max-w-md">
            Configure o gateway de pagamentos Rede nas Configurações para começar a gerar cobranças.
          </p>
          <Button variant="outline" className="border-[#FF6600]/30 text-[#FF6600] hover:bg-[#FF6600]/5">
            Ir para Configurações
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RedeLogo className="h-8 w-20" />
          <div>
            <h2 className="text-xl font-semibold">Cobranças via Rede</h2>
            <p className="text-sm text-muted-foreground">Gere links de pagamento para seus clientes</p>
          </div>
        </div>
        <Button 
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="bg-[#FF6600] hover:bg-[#E65C00] text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Cobrança
        </Button>
      </div>

      {/* New Payment Form */}
      <Collapsible open={isFormOpen} onOpenChange={setIsFormOpen}>
        <CollapsibleContent>
          <Card className="border-[#FF6600]/20 shadow-[0_0_20px_rgba(255,102,0,0.05)]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <LinkIcon className="h-5 w-5 text-[#FF6600]" />
                    Gerar Nova Cobrança
                  </CardTitle>
                  <CardDescription>Preencha os dados para gerar o link de pagamento</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Valor */}
                <div className="space-y-2">
                  <Label>Valor *</Label>
                  <Input
                    value={formData.amount}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      const formatted = (parseInt(value || '0') / 100).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });
                      setFormData(prev => ({ ...prev, amount: formatted }));
                    }}
                    placeholder="0,00"
                    className="focus-visible:ring-[#FF6600]/30 text-lg font-semibold"
                  />
                </div>

                {/* Descrição */}
                <div className="space-y-2 lg:col-span-2">
                  <Label>Descrição / Referência</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Ex: Pedido #1234, Serviço de consultoria..."
                    className="focus-visible:ring-[#FF6600]/30"
                  />
                </div>

                {/* Cliente */}
                <div className="space-y-2">
                  <Label>Nome do Cliente</Label>
                  <Input
                    value={formData.customerName}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="João da Silva"
                    className="focus-visible:ring-[#FF6600]/30"
                  />
                </div>

                {/* Telefone */}
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.customerPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                    placeholder="(11) 99999-9999"
                    className="focus-visible:ring-[#FF6600]/30"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                    placeholder="cliente@email.com"
                    className="focus-visible:ring-[#FF6600]/30"
                  />
                </div>

                {/* CPF/CNPJ */}
                <div className="space-y-2">
                  <Label>CPF/CNPJ</Label>
                  <Input
                    value={formData.customerDocument}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerDocument: e.target.value }))}
                    placeholder="000.000.000-00"
                    className="focus-visible:ring-[#FF6600]/30"
                  />
                </div>

                {/* Parcelamento */}
                <div className="space-y-2">
                  <Label>Parcelamento Máximo</Label>
                  <Select 
                    value={formData.maxInstallments.toString()}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, maxInstallments: parseInt(value) }))}
                  >
                    <SelectTrigger className="focus:ring-[#FF6600]/30">
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

                {/* Validade */}
                <div className="space-y-2">
                  <Label>Validade do Link</Label>
                  <Select 
                    value={formData.expirationDays.toString()}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, expirationDays: parseInt(value) }))}
                  >
                    <SelectTrigger className="focus:ring-[#FF6600]/30">
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
              </div>

              {/* Payment Methods */}
              <div className="space-y-3">
                <Label>Métodos de Pagamento</Label>
                <div className="flex gap-4">
                  <div
                    onClick={() => handleMethodToggle('credit_card')}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${
                      formData.paymentMethods.includes('credit_card') 
                        ? 'border-[#FF6600]/50 bg-[#FF6600]/5 text-[#FF6600]' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <CreditCard className="h-4 w-4" />
                    <span className="text-sm font-medium">Cartão de Crédito</span>
                    {formData.paymentMethods.includes('credit_card') && (
                      <CheckCircle className="h-4 w-4 ml-1" />
                    )}
                  </div>
                  <div
                    onClick={() => handleMethodToggle('pix')}
                    className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${
                      formData.paymentMethods.includes('pix') 
                        ? 'border-[#FF6600]/50 bg-[#FF6600]/5 text-[#FF6600]' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <Wallet className="h-4 w-4" />
                    <span className="text-sm font-medium">PIX</span>
                    {formData.paymentMethods.includes('pix') && (
                      <CheckCircle className="h-4 w-4 ml-1" />
                    )}
                  </div>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={createPaymentLink.isPending}
                  className="bg-[#FF6600] hover:bg-[#E65C00] text-white"
                >
                  {createPaymentLink.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <LinkIcon className="mr-2 h-4 w-4" />
                  )}
                  Gerar Link de Pagamento
                </Button>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Payment Links Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Cobranças Geradas</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#FF6600]" />
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <LinkIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>Nenhuma cobrança encontrada</p>
              <p className="text-sm">Clique em "Nova Cobrança" para criar seu primeiro link</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLinks.map((link) => {
                  const StatusIcon = statusConfig[link.status]?.icon || Clock;
                  return (
                    <TableRow key={link.id}>
                      <TableCell className="text-sm">
                        {format(new Date(link.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{link.customer_name || '-'}</div>
                        {link.customer_phone && (
                          <div className="text-xs text-muted-foreground">{link.customer_phone}</div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {link.description || '-'}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(link.amount / 100)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={`${statusConfig[link.status]?.color || ''} flex items-center gap-1 w-fit`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {statusConfig[link.status]?.label || link.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {link.expires_at 
                          ? format(new Date(link.expires_at), "dd/MM/yyyy", { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {link.payment_url && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyToClipboard(link.payment_url!)}
                                title="Copiar link"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(link.payment_url!, '_blank')}
                                title="Abrir link"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Excluir link"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir link de pagamento?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Esta ação não pode ser desfeita. O link será removido permanentemente.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deletePaymentLink.mutate(link.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {deletePaymentLink.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                  ) : null}
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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
    </div>
  );
}
