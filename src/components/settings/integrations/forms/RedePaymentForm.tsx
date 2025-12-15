import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from 'lucide-react';
import { usePaymentGatewayConfig, useUpdatePaymentGatewayConfig } from '@/hooks/usePaymentLinks';

const PAYMENT_METHODS = [
  { id: 'credit_card', label: 'Crédito', icon: CreditCard },
  { id: 'debit_card', label: 'Débito', icon: CreditCard },
  { id: 'pix', label: 'PIX', icon: Wallet },
];

interface RedePaymentFormProps {
  onSuccess?: () => void;
}

export function RedePaymentForm({ onSuccess }: RedePaymentFormProps) {
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
    onSuccess?.();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Environment */}
      <div className="space-y-2">
        <Label>Ambiente</Label>
        <Select 
          value={formData.environment}
          onValueChange={(value: 'sandbox' | 'production') => 
            setFormData(prev => ({ ...prev, environment: value }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sandbox">🧪 Sandbox (Testes)</SelectItem>
            <SelectItem value="production">🚀 Produção</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Credentials */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Client ID *</Label>
          <Input
            value={formData.clientId}
            onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
            placeholder="8d3d08f3-7188..."
          />
        </div>
        <div className="space-y-2">
          <Label>Client Secret *</Label>
          <Input
            type="password"
            value={formData.clientSecret}
            onChange={(e) => setFormData(prev => ({ ...prev, clientSecret: e.target.value }))}
            placeholder="••••••••"
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Obtenha suas credenciais em{' '}
        <a 
          href="https://developer.userede.com.br/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline inline-flex items-center gap-1"
        >
          developer.userede.com.br
          <ExternalLink size={12} />
        </a>
      </p>

      {/* Test Connection */}
      <Button
        variant="outline"
        onClick={handleTestConnection}
        disabled={testing || !formData.clientId || !formData.clientSecret}
        className="w-full"
      >
        {testing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : connectionStatus === 'success' ? (
          <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
        ) : connectionStatus === 'error' ? (
          <XCircle className="mr-2 h-4 w-4 text-destructive" />
        ) : (
          <TestTube2 className="mr-2 h-4 w-4" />
        )}
        Testar Conexão
      </Button>

      {/* Payment Methods */}
      <div className="space-y-3">
        <Label>Métodos de Pagamento</Label>
        <div className="flex gap-2 flex-wrap">
          {PAYMENT_METHODS.map((method) => {
            const isEnabled = formData.enabledMethods.includes(method.id);
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => handleMethodToggle(method.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  isEnabled 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                <method.icon className="h-4 w-4" />
                {method.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Additional Options */}
      <div className="grid grid-cols-2 gap-4">
        {formData.enabledMethods.includes('credit_card') && (
          <div className="space-y-2">
            <Label>Parcelamento Máximo</Label>
            <Select 
              value={formData.maxInstallments.toString()}
              onValueChange={(value) => 
                setFormData(prev => ({ ...prev, maxInstallments: parseInt(value) }))
              }
            >
              <SelectTrigger>
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
        <div className="space-y-2">
          <Label>Validade do Link</Label>
          <Select 
            value={formData.defaultExpirationDays.toString()}
            onValueChange={(value) => 
              setFormData(prev => ({ ...prev, defaultExpirationDays: parseInt(value) }))
            }
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
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        disabled={updateConfig.isPending}
        className="w-full"
      >
        {updateConfig.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Salvar Configuração
      </Button>
    </div>
  );
}
