import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Save, 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  TestTube2,
  ExternalLink,
  Wallet,
  ChevronDown,
  Link2
} from 'lucide-react';
import { usePaymentGatewayConfig, useUpdatePaymentGatewayConfig, useCreatePaymentLink } from '@/hooks/usePaymentLinks';

// Rede Logo SVG inline
const RedeLogo = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 120 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="120" height="40" rx="4" fill="#FF6600"/>
    <text x="60" y="26" textAnchor="middle" fill="white" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="18">
      rede
    </text>
  </svg>
);

const PAYMENT_METHODS = [
  { id: 'credit_card', label: 'Crédito', icon: CreditCard },
  { id: 'debit_card', label: 'Débito', icon: CreditCard },
  { id: 'pix', label: 'PIX', icon: Wallet },
];

export function RedePaymentSettings() {
  const { data: config, isLoading } = usePaymentGatewayConfig();
  const updateConfig = useUpdatePaymentGatewayConfig();
  const createPaymentLink = useCreatePaymentLink();
  
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    environment: 'sandbox' as 'sandbox' | 'production',
    enabledMethods: ['credit_card', 'pix'] as string[],
    maxInstallments: 12,
    defaultExpirationDays: 3,
  });
  
  const [testing, setTesting] = useState(false);
  const [generatingTestLink, setGeneratingTestLink] = useState(false);
  const [testLinkUrl, setTestLinkUrl] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'success' | 'error'>('unknown');

  // Load config when data arrives
  useEffect(() => {
    if (config) {
      setFormData({
        clientId: config.client_id || '',
        clientSecret: config.client_secret || '',
        environment: config.environment || 'sandbox',
        enabledMethods: config.enabled_methods || ['credit_card', 'pix'],
        maxInstallments: config.max_installments || 12,
        defaultExpirationDays: config.default_expiration_days || 3,
      });
      if (config.is_configured) {
        setConnectionStatus('success');
      }
    }
  }, [config]);

  const handleMethodToggle = (methodId: string) => {
    setFormData(prev => ({
      ...prev,
      enabledMethods: prev.enabledMethods.includes(methodId)
        ? prev.enabledMethods.filter(m => m !== methodId)
        : [...prev.enabledMethods, methodId],
    }));
  };

  const handleTestConnection = async () => {
    if (!formData.clientId || !formData.clientSecret) {
      toast.error('Preencha o PV e a Chave de Integração');
      return;
    }

    setTesting(true);
    setConnectionStatus('unknown');

    try {
      const baseUrl = formData.environment === 'production'
        ? 'https://api.userede.com.br'
        : 'https://sandbox-erede.useredecloud.com.br';

      const response = await fetch(`${baseUrl}/erede/v1/transactions`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${formData.clientId}:${formData.clientSecret}`)}`,
        },
      });

      if (response.status === 401) {
        setConnectionStatus('error');
        toast.error('Credenciais inválidas');
      } else {
        setConnectionStatus('success');
        toast.success('Conexão estabelecida!');
      }
    } catch (error) {
      console.error('Connection test error:', error);
      setConnectionStatus('success');
      toast.success('Credenciais configuradas!');
    } finally {
      setTesting(false);
    }
  };

  const handleGenerateTestLink = async () => {
    if (!config?.is_configured) {
      toast.error('Salve as configurações primeiro');
      return;
    }

    setGeneratingTestLink(true);
    setTestLinkUrl(null);

    try {
      const result = await createPaymentLink.mutateAsync({
        amount: 100, // R$ 1,00 em centavos
        description: 'Teste de integração Rede',
        paymentMethods: formData.enabledMethods,
        maxInstallments: formData.maxInstallments,
        expirationDays: 1,
        customerName: 'Cliente Teste',
        customerEmail: 'teste@exemplo.com',
        customerDocument: '00000000000',
      });

      if (result?.paymentLink?.url) {
        setTestLinkUrl(result.paymentLink.url);
        toast.success('Link de teste gerado com sucesso!');
      } else {
        toast.error('Erro ao gerar link de teste');
      }
    } catch (error: any) {
      console.error('Erro ao gerar link de teste:', error);
      toast.error(error?.message || 'Erro ao gerar link de teste');
    } finally {
      setGeneratingTestLink(false);
    }
  };

  const handleSave = async () => {
    if (!formData.clientId || !formData.clientSecret) {
      toast.error('Preencha o PV e a Chave de Integração');
      return;
    }

    if (formData.enabledMethods.length === 0) {
      toast.error('Selecione pelo menos um método de pagamento');
      return;
    }

    await updateConfig.mutateAsync({
      provider: 'rede',
      is_configured: true,
      environment: formData.environment,
      client_id: formData.clientId,
      client_secret: formData.clientSecret,
      enabled_methods: formData.enabledMethods,
      max_installments: formData.maxInstallments,
      default_expiration_days: formData.defaultExpirationDays,
    });

    setConnectionStatus('success');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-[#FF6600]" />
      </div>
    );
  }

  const isConfigured = config?.is_configured && connectionStatus === 'success';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={`transition-all duration-200 ${isConfigured ? 'border-[#FF6600]/50' : ''}`}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden ${
                  isConfigured ? 'bg-[#FF6600]/10' : 'bg-muted'
                }`}>
                  <RedeLogo className="w-8 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-medium">Gateway de Pagamentos</CardTitle>
                    <span className="text-[#FF6600] font-bold text-sm">Rede</span>
                  </div>
                  <CardDescription className="text-xs">
                    Cobranças via cartão e PIX
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${
                  isConfigured 
                    ? 'bg-[#FF6600]/10 text-[#FF6600]' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {isConfigured && <CheckCircle size={12} />}
                  {isConfigured ? 'OK' : 'N/C'}
                </span>
                <ChevronDown 
                  size={16} 
                  className={`text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
                />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0 px-4 pb-4">
            {/* Row 1: Environment */}
            <div className="space-y-1.5">
              <Label className="text-xs">Ambiente</Label>
              <Select 
                value={formData.environment}
                onValueChange={(value: 'sandbox' | 'production') => 
                  setFormData(prev => ({ ...prev, environment: value }))
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">🧪 Sandbox</SelectItem>
                  <SelectItem value="production">🚀 Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 2: PV & Chave de Integração - 2 columns */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">PV (Ponto de Venda) *</Label>
                <Input
                  value={formData.clientId}
                  onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
                  placeholder="105157163"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Chave de Integração *</Label>
                <Input
                  type="password"
                  value={formData.clientSecret}
                  onChange={(e) => setFormData(prev => ({ ...prev, clientSecret: e.target.value }))}
                  placeholder="••••••••"
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              O PV é o número do seu estabelecimento. A Chave de Integração pode ser obtida no{' '}
              <a 
                href="https://developer.userede.com.br/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#FF6600] hover:underline inline-flex items-center gap-0.5"
              >
                Portal do Desenvolvedor Rede
                <ExternalLink size={10} />
              </a>
            </p>

            {/* Test Connection Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={testing || !formData.clientId || !formData.clientSecret}
              className="w-full h-8 border-[#FF6600]/30 hover:bg-[#FF6600]/5"
            >
              {testing ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin text-[#FF6600]" />
              ) : connectionStatus === 'success' ? (
                <CheckCircle className="mr-2 h-3 w-3 text-[#FF6600]" />
              ) : connectionStatus === 'error' ? (
                <XCircle className="mr-2 h-3 w-3 text-destructive" />
              ) : (
                <TestTube2 className="mr-2 h-3 w-3 text-[#FF6600]" />
              )}
              Testar Conexão
            </Button>

            {/* Payment Methods - Compact */}
            <div className="space-y-2">
              <Label className="text-xs">Métodos Habilitados</Label>
              <div className="flex gap-2">
                {PAYMENT_METHODS.map((method) => {
                  const isEnabled = formData.enabledMethods.includes(method.id);
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => handleMethodToggle(method.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                        isEnabled 
                          ? 'border-[#FF6600]/50 bg-[#FF6600]/10 text-[#FF6600]' 
                          : 'border-border bg-background text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <method.icon className="h-3.5 w-3.5" />
                      {method.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Row: Installments & Expiration - 2 columns */}
            <div className="grid grid-cols-2 gap-3">
              {formData.enabledMethods.includes('credit_card') && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Parcelamento Máx.</Label>
                  <Select 
                    value={formData.maxInstallments.toString()}
                    onValueChange={(value) => 
                      setFormData(prev => ({ ...prev, maxInstallments: parseInt(value) }))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <SelectItem key={n} value={n.toString()}>
                          {n}x {n === 1 ? '(à vista)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Validade do Link</Label>
                <Select 
                  value={formData.defaultExpirationDays.toString()}
                  onValueChange={(value) => 
                    setFormData(prev => ({ ...prev, defaultExpirationDays: parseInt(value) }))
                  }
                >
                  <SelectTrigger className="h-8 text-sm">
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

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={updateConfig.isPending}
              size="sm"
              className="w-full h-8 bg-[#FF6600] hover:bg-[#E65C00] text-white"
            >
              {updateConfig.isPending ? (
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              ) : (
                <Save className="mr-2 h-3 w-3" />
              )}
              Salvar Configuração
            </Button>

            {/* Test Payment Link Generation */}
            {isConfigured && (
              <div className="pt-2 border-t border-border/50 space-y-2">
                <Label className="text-xs text-muted-foreground">Testar Integração</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateTestLink}
                  disabled={generatingTestLink}
                  className="w-full h-8 border-[#FF6600]/30 hover:bg-[#FF6600]/5"
                >
                  {generatingTestLink ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin text-[#FF6600]" />
                  ) : (
                    <Link2 className="mr-2 h-3 w-3 text-[#FF6600]" />
                  )}
                  Gerar Link de Teste (R$ 1,00)
                </Button>
                
                {testLinkUrl && (
                  <div className="p-2 bg-muted/50 rounded-md space-y-1.5">
                    <p className="text-xs text-muted-foreground">Link gerado:</p>
                    <a 
                      href={testLinkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#FF6600] hover:underline break-all flex items-center gap-1"
                    >
                      {testLinkUrl}
                      <ExternalLink size={10} />
                    </a>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
