import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check, X, ExternalLink, Package, Eye, EyeOff } from 'lucide-react';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useShippingConfig, ShippingConfig } from '@/hooks/useShippingConfig';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MelhorEnvioFormProps {
  onSuccess?: () => void;
}

export function MelhorEnvioForm({ onSuccess }: MelhorEnvioFormProps) {
  const { data: settings, isLoading: settingsLoading } = useCompanySettings();
  const { config, isLoading: configLoading, updateConfig } = useShippingConfig();
  
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testCep, setTestCep] = useState('01310-100');

  useEffect(() => {
    if (config) {
      setEnvironment(config.environment || 'sandbox');
      setToken(config.token || '');
    }
  }, [config]);

  const handleTestConnection = async () => {
    if (!token.trim()) {
      toast.error('Digite o token antes de testar');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const originCep = settings?.zip_code;
      if (!originCep) {
        toast.error('Configure o CEP de origem nas Configurações da Empresa');
        setTestResult('error');
        return;
      }

      const { data, error } = await supabase.functions.invoke('calculate-shipping', {
        body: {
          from_postal_code: originCep,
          to_postal_code: testCep,
          products: [{
            weight: 1,
            height: 10,
            width: 10,
            length: 10,
            quantity: 1,
            insurance_value: 100,
          }],
          // Pass token directly for testing before saving
          _test_token: token,
          _test_environment: environment,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        setTestResult('error');
        return;
      }

      if (data.options && data.options.length > 0) {
        toast.success(`Conexão OK! ${data.options.length} opções de frete encontradas.`);
        setTestResult('success');
      } else {
        toast.warning('Conexão OK, mas nenhuma opção de frete disponível para este CEP');
        setTestResult('success');
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      toast.error(error.message || 'Erro ao testar conexão');
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!token.trim()) {
      toast.error('Digite o token');
      return;
    }

    setSaving(true);
    try {
      const newConfig: ShippingConfig = {
        provider: 'melhor_envio',
        is_configured: true,
        environment,
        token,
      };

      await updateConfig.mutateAsync(newConfig);
      toast.success('Configuração salva com sucesso!');
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (settingsLoading || configLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Status da Integração</p>
            <p className="text-xs text-muted-foreground">
              {config?.is_configured ? 'Token configurado' : 'Aguardando configuração'}
            </p>
          </div>
        </div>
        {config?.is_configured ? (
          <Badge variant="default" className="bg-green-500">
            <Check className="h-3 w-3 mr-1" /> Configurado
          </Badge>
        ) : testResult === 'success' ? (
          <Badge variant="default" className="bg-green-500">
            <Check className="h-3 w-3 mr-1" /> Testado
          </Badge>
        ) : testResult === 'error' ? (
          <Badge variant="destructive">
            <X className="h-3 w-3 mr-1" /> Erro
          </Badge>
        ) : (
          <Badge variant="secondary">Não configurado</Badge>
        )}
      </div>

      {/* Environment */}
      <div className="space-y-2">
        <Label>Ambiente</Label>
        <Select value={environment} onValueChange={(v) => setEnvironment(v as 'sandbox' | 'production')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sandbox">🧪 Sandbox (Testes)</SelectItem>
            <SelectItem value="production">🚀 Produção</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Token Input */}
      <div className="space-y-2">
        <Label>Token de Acesso *</Label>
        <div className="relative">
          <Input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Cole aqui seu token do Melhor Envio"
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3"
            onClick={() => setShowToken(!showToken)}
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Obtenha seu token em{' '}
          <a
            href={environment === 'sandbox' 
              ? 'https://sandbox.melhorenvio.com.br/painel/gerenciar/tokens'
              : 'https://melhorenvio.com.br/painel/gerenciar/tokens'
            }
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            Melhor Envio <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>

      {/* Origin CEP */}
      <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
        <Label className="text-sm">CEP de Origem</Label>
        <p className="text-sm font-medium">
          {settings?.zip_code || <span className="text-destructive">Não configurado</span>}
        </p>
        {!settings?.zip_code && (
          <p className="text-xs text-muted-foreground">
            Configure nas Configurações da Empresa
          </p>
        )}
      </div>

      {/* Test Connection */}
      <div className="space-y-3">
        <Label>Testar Conexão</Label>
        <div className="flex gap-2">
          <Input
            value={testCep}
            onChange={(e) => setTestCep(e.target.value)}
            placeholder="CEP de destino para teste"
            className="flex-1"
          />
          <Button 
            onClick={handleTestConnection} 
            disabled={testing || !settings?.zip_code || !token.trim()}
            variant="outline"
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Testando...
              </>
            ) : (
              'Testar'
            )}
          </Button>
        </div>
      </div>

      {/* Save Button */}
      <Button 
        onClick={handleSave} 
        disabled={saving || !token.trim()}
        className="w-full"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Salvando...
          </>
        ) : (
          'Salvar Configuração'
        )}
      </Button>

      {/* Available Services */}
      <div className="border-t pt-4 space-y-3">
        <h4 className="font-medium text-sm">Transportadoras Disponíveis:</h4>
        <div className="flex flex-wrap gap-2">
          {['Correios', 'JadLog', 'Azul Cargo', 'Latam Cargo', 'Loggi', 'J&T'].map(carrier => (
            <Badge key={carrier} variant="outline" className="text-xs">
              {carrier}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          A disponibilidade depende da rota e do contrato ativo no Melhor Envio
        </p>
      </div>
    </div>
  );
}
