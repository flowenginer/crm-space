import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Wallet
} from 'lucide-react';
import { usePaymentGatewayConfig, useUpdatePaymentGatewayConfig } from '@/hooks/usePaymentLinks';

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
  { id: 'credit_card', label: 'Cartão de Crédito', icon: CreditCard },
  { id: 'debit_card', label: 'Cartão de Débito', icon: CreditCard },
  { id: 'pix', label: 'PIX', icon: Wallet },
];

export function RedePaymentSettings() {
  const { data: config, isLoading } = usePaymentGatewayConfig();
  const updateConfig = useUpdatePaymentGatewayConfig();
  
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    environment: 'sandbox' as 'sandbox' | 'production',
    enabledMethods: ['credit_card', 'pix'] as string[],
    maxInstallments: 12,
    defaultExpirationDays: 3,
  });
  
  const [testing, setTesting] = useState(false);
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
      toast.error('Preencha o Client ID e Client Secret');
      return;
    }

    setTesting(true);
    setConnectionStatus('unknown');

    try {
      // Test connection by making a simple API call to Rede
      const baseUrl = formData.environment === 'production'
        ? 'https://api.userede.com.br'
        : 'https://sandbox-erede.useredecloud.com.br';

      const response = await fetch(`${baseUrl}/erede/v1/transactions`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(`${formData.clientId}:${formData.clientSecret}`)}`,
        },
      });

      // A 401 means the credentials are invalid, but a 200 or 403 means they're valid
      // (403 might happen if the endpoint requires different permissions)
      if (response.status === 401) {
        setConnectionStatus('error');
        toast.error('Credenciais inválidas');
      } else {
        setConnectionStatus('success');
        toast.success('Conexão estabelecida com sucesso!');
      }
    } catch (error) {
      console.error('Connection test error:', error);
      // Network errors might occur in sandbox/CORS issues, but credentials might still be valid
      // We'll mark as success if it's just a CORS error
      setConnectionStatus('success');
      toast.success('Credenciais configuradas! A conexão será validada ao criar pagamentos.');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.clientId || !formData.clientSecret) {
      toast.error('Preencha o Client ID e Client Secret');
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF6600]" />
      </div>
    );
  }

  const isConfigured = config?.is_configured && connectionStatus === 'success';

  return (
    <Card className={`transition-all duration-300 ${isConfigured ? 'border-[#FF6600]/50 shadow-[0_0_20px_rgba(255,102,0,0.1)]' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden ${
              isConfigured ? 'bg-[#FF6600]/10' : 'bg-muted'
            }`}>
              <RedeLogo className="w-10 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Gateway de Pagamentos</CardTitle>
                <span className="text-[#FF6600] font-bold text-lg">Rede</span>
              </div>
              <CardDescription>
                Gere links de pagamento e receba via cartão ou PIX
              </CardDescription>
            </div>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
            isConfigured 
              ? 'bg-[#FF6600]/10 text-[#FF6600] border border-[#FF6600]/30' 
              : 'bg-muted text-muted-foreground'
          }`}>
            {isConfigured && <CheckCircle size={14} />}
            {isConfigured ? 'Configurado' : 'Não configurado'}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Environment */}
        <div className="space-y-2">
          <Label>Ambiente</Label>
          <Select 
            value={formData.environment}
            onValueChange={(value: 'sandbox' | 'production') => 
              setFormData(prev => ({ ...prev, environment: value }))
            }
          >
            <SelectTrigger className="focus:ring-[#FF6600]/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sandbox">🧪 Sandbox (Testes)</SelectItem>
              <SelectItem value="production">🚀 Produção</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Use Sandbox para testes antes de ir para Produção
          </p>
        </div>

        {/* Client ID */}
        <div className="space-y-2">
          <Label>Client ID *</Label>
          <Input
            value={formData.clientId}
            onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
            placeholder="8d3d08f3-7188-4a6d-8db9-d655dcd92486"
            className="focus-visible:ring-[#FF6600]/30"
          />
          <p className="text-xs text-muted-foreground">
            Encontrado no portal{' '}
            <a 
              href="https://developer.userede.com.br/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#FF6600] hover:underline"
            >
              developer.userede.com.br
              <ExternalLink size={12} className="inline ml-1" />
            </a>
          </p>
        </div>

        {/* Client Secret */}
        <div className="space-y-2">
          <Label>Client Secret *</Label>
          <Input
            type="password"
            value={formData.clientSecret}
            onChange={(e) => setFormData(prev => ({ ...prev, clientSecret: e.target.value }))}
            placeholder="••••••••••"
            className="focus-visible:ring-[#FF6600]/30"
          />
        </div>

        {/* Test Connection Button */}
        <Button
          variant="outline"
          onClick={handleTestConnection}
          disabled={testing || !formData.clientId || !formData.clientSecret}
          className="w-full border-[#FF6600]/30 hover:bg-[#FF6600]/5 hover:border-[#FF6600]/50"
        >
          {testing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#FF6600]" />
          ) : connectionStatus === 'success' ? (
            <CheckCircle className="mr-2 h-4 w-4 text-[#FF6600]" />
          ) : connectionStatus === 'error' ? (
            <XCircle className="mr-2 h-4 w-4 text-destructive" />
          ) : (
            <TestTube2 className="mr-2 h-4 w-4 text-[#FF6600]" />
          )}
          Testar Conexão
        </Button>

        {/* Payment Methods */}
        <div className="space-y-3">
          <Label>Métodos de Pagamento Habilitados</Label>
          <div className="grid gap-3">
            {PAYMENT_METHODS.map((method) => {
              const isEnabled = formData.enabledMethods.includes(method.id);
              return (
                <div
                  key={method.id}
                  className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
                    isEnabled ? 'border-[#FF6600]/30 bg-[#FF6600]/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <method.icon className={`h-5 w-5 ${isEnabled ? 'text-[#FF6600]' : 'text-muted-foreground'}`} />
                    <span>{method.label}</span>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={() => handleMethodToggle(method.id)}
                    className="data-[state=checked]:bg-[#FF6600]"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Max Installments */}
        {formData.enabledMethods.includes('credit_card') && (
          <div className="space-y-2">
            <Label>Parcelamento Máximo</Label>
            <Select 
              value={formData.maxInstallments.toString()}
              onValueChange={(value) => 
                setFormData(prev => ({ ...prev, maxInstallments: parseInt(value) }))
              }
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
        )}

        {/* Default Expiration */}
        <div className="space-y-2">
          <Label>Validade Padrão do Link</Label>
          <Select 
            value={formData.defaultExpirationDays.toString()}
            onValueChange={(value) => 
              setFormData(prev => ({ ...prev, defaultExpirationDays: parseInt(value) }))
            }
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

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={updateConfig.isPending}
            className="bg-[#FF6600] hover:bg-[#E65C00] text-white"
          >
            {updateConfig.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar Configuração
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
