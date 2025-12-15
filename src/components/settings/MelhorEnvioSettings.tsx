import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Truck, Check, X, ExternalLink, Package } from 'lucide-react';
import { useCompanySettings, useUpdateCompanySettings } from '@/hooks/useCompanySettings';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function MelhorEnvioSettings() {
  const { data: settings, isLoading } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [testCep, setTestCep] = useState('01310-100'); // CEP da Av. Paulista

  const handleTestConnection = async () => {
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
        },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        if (data.code === 'TOKEN_NOT_CONFIGURED') {
          toast.error('Token do Melhor Envio não configurado. Adicione o secret MELHOR_ENVIO_TOKEN.');
        } else {
          toast.error(data.error);
        }
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Melhor Envio</CardTitle>
            <CardDescription>
              Integração para cotação de frete com múltiplas transportadoras
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Status da Integração</p>
              <p className="text-xs text-muted-foreground">
                O token é armazenado de forma segura no Supabase
              </p>
            </div>
          </div>
          {testResult === 'success' ? (
            <Badge variant="default" className="bg-green-500">
              <Check className="h-3 w-3 mr-1" /> Conectado
            </Badge>
          ) : testResult === 'error' ? (
            <Badge variant="destructive">
              <X className="h-3 w-3 mr-1" /> Erro
            </Badge>
          ) : (
            <Badge variant="secondary">Não testado</Badge>
          )}
        </div>

        {/* Origin CEP */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">CEP de Origem</Label>
          <p className="text-sm text-muted-foreground">
            {settings?.zip_code || 'Não configurado'}
          </p>
          <p className="text-xs text-muted-foreground">
            Configure nas Configurações da Empresa
          </p>
        </div>

        {/* Test Connection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Testar Conexão</Label>
          <div className="flex gap-2">
            <Input
              value={testCep}
              onChange={(e) => setTestCep(e.target.value)}
              placeholder="CEP de destino para teste"
              className="flex-1"
            />
            <Button 
              onClick={handleTestConnection} 
              disabled={testing || !settings?.zip_code}
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

        {/* Instructions */}
        <div className="border-t pt-4 space-y-3">
          <h4 className="font-medium text-sm">Como configurar:</h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Crie uma conta no Melhor Envio (sandbox ou produção)</li>
            <li>Gere um token de acesso na área de desenvolvedor</li>
            <li>Adicione o token como secret <code className="bg-muted px-1 rounded">MELHOR_ENVIO_TOKEN</code> no Supabase</li>
            <li>Configure o CEP de origem nas Configurações da Empresa</li>
            <li>Teste a conexão acima</li>
          </ol>
          
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" asChild>
              <a 
                href="https://melhorenvio.com.br/painel/gerenciar/tokens" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Gerar Token (Produção)
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a 
                href="https://sandbox.melhorenvio.com.br/painel/gerenciar/tokens" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Gerar Token (Sandbox)
              </a>
            </Button>
          </div>
        </div>

        {/* Available Services Info */}
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
      </CardContent>
    </Card>
  );
}
