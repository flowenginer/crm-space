import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Loader2, 
  Copy, 
  Check, 
  Phone, 
  AlertCircle, 
  CheckCircle2,
  Shield,
  Zap,
  Facebook,
  ExternalLink,
  Trash2,
  Unlink,
} from 'lucide-react';
import { 
  useCloudAPIConfig, 
  useUpdateCloudAPIConfig,
} from '@/hooks/useCloudAPIConfig';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CloudAPIConnect } from '@/components/whatsapp/CloudAPIConnect';

interface CloudAPIConfigFormProps {
  onSuccess?: () => void;
}

export function CloudAPIConfigForm({ onSuccess }: CloudAPIConfigFormProps) {
  const queryClient = useQueryClient();
  const { data: existingConfig, isLoading } = useCloudAPIConfig();
  const updateConfig = useUpdateCloudAPIConfig();
  
  const [showConnect, setShowConnect] = useState(false);
  const [copied, setCopied] = useState<'url' | 'token' | null>(null);
  
  // Buscar dados do canal associado
  const { data: channelData } = useQuery({
    queryKey: ['cloudapi-channel', existingConfig?.channel_id],
    queryFn: async () => {
      if (!existingConfig?.channel_id) return null;
      const { data, error } = await supabase
        .from('whatsapp_channels')
        .select('id, name, phone, status')
        .eq('id', existingConfig.channel_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!existingConfig?.channel_id,
  });

  // Verificar status da Calling API no Meta
  const { data: callingStatus, isLoading: isLoadingCallingStatus, refetch: refetchCallingStatus } = useQuery({
    queryKey: ['cloudapi-calling-status'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('cloudapi-check-calling-status', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data;
    },
    enabled: !!existingConfig,
    refetchOnWindowFocus: false,
  });

  // Mutation para habilitar Calling API
  const enableCallingMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('cloudapi-enable-calling', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Calling API habilitada com sucesso!');
      refetchCallingStatus();
    },
    onError: (error: any) => {
      console.error('Error enabling calling:', error);
      toast.error(error.message || 'Erro ao habilitar Calling API');
    },
  });

  // Mutation para desconectar
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!existingConfig) throw new Error('No config to disconnect');
      
      // Desativar a config
      const { error: configError } = await supabase
        .from('cloudapi_configs')
        .update({ is_active: false })
        .eq('id', existingConfig.id);
      
      if (configError) throw configError;

      // Se tem canal associado, atualizar status
      if (existingConfig.channel_id) {
        await supabase
          .from('whatsapp_channels')
          .update({ status: 'disconnected' })
          .eq('id', existingConfig.channel_id);
      }
    },
    onSuccess: () => {
      toast.success('Cloud API desconectada!');
      queryClient.invalidateQueries({ queryKey: ['cloudapi-config'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      onSuccess?.();
    },
    onError: (error: any) => {
      console.error('Error disconnecting:', error);
      toast.error(error.message || 'Erro ao desconectar');
    },
  });

  const webhookUrl = 'https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/cloudapi-webhook';

  const handleCopy = async (type: 'url' | 'token', value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    toast.success('Copiado!');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleToggleCalling = async (enabled: boolean) => {
    if (!existingConfig) return;
    
    try {
      await updateConfig.mutateAsync({
        id: existingConfig.id,
        calling_enabled: enabled,
      });
    } catch (error) {
      console.error('Error toggling calling:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Se não tem configuração ativa, mostrar tela de conexão
  if (!existingConfig) {
    return (
      <>
        <div className="space-y-6">
          {/* Vantagens */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                Vantagens da API Oficial do WhatsApp
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                <span>Conexão permanente (sem QR Code)</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-green-500 shrink-0" />
                <span>Alta disponibilidade e estabilidade</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-green-500 shrink-0" />
                <span>Suporte a chamadas de voz (VoIP)</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500 shrink-0" />
                <span>Templates de mensagem aprovados pelo Meta</span>
              </div>
            </CardContent>
          </Card>

          {/* Aviso */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Você será redirecionado para o Facebook para autorizar o acesso à sua conta WhatsApp Business.
              O processo é rápido e seguro.
            </AlertDescription>
          </Alert>

          {/* Botão de Conectar */}
          <Button 
            onClick={() => setShowConnect(true)} 
            className="w-full gap-2 bg-[#1877F2] hover:bg-[#166FE5]"
            size="lg"
          >
            <Facebook className="h-5 w-5" />
            Conectar com Facebook
          </Button>

          {/* Link para documentação */}
          <div className="flex justify-center">
            <a 
              href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Documentação Cloud API
            </a>
          </div>
        </div>

        {/* Modal de Conexão */}
        <CloudAPIConnect
          open={showConnect}
          onClose={() => setShowConnect(false)}
          onSuccess={() => {
            setShowConnect(false);
            queryClient.invalidateQueries({ queryKey: ['cloudapi-config'] });
            onSuccess?.();
          }}
        />
      </>
    );
  }

  // Se tem configuração, mostrar dados em modo visualização
  return (
    <div className="space-y-6">
      {/* Status da Conexão */}
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-green-700 dark:text-green-400">
                WhatsApp Cloud API Conectada
              </p>
              <p className="text-sm text-muted-foreground">
                {channelData?.phone || 'Número conectado'}
                {channelData?.name && ` • ${channelData.name}`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações da Conexão */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Informações da Conexão</h3>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Phone Number ID</Label>
            <p className="font-mono text-xs bg-muted px-2 py-1 rounded">
              {existingConfig.phone_number_id}
            </p>
          </div>
          
          {existingConfig.waba_id && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">WABA ID</Label>
              <p className="font-mono text-xs bg-muted px-2 py-1 rounded">
                {existingConfig.waba_id}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Webhook */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-sm font-medium">Configuração do Webhook</h3>
        
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">URL do Webhook</Label>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="font-mono text-xs" />
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => handleCopy('url', webhookUrl)}
            >
              {copied === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Verify Token</Label>
          <div className="flex gap-2">
            <Input 
              value={existingConfig.verify_token} 
              readOnly 
              className="font-mono text-xs" 
            />
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => handleCopy('token', existingConfig.verify_token)}
            >
              {copied === 'token' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {existingConfig.webhook_configured ? (
          <Alert className="border-green-500/30 bg-green-500/5">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700 dark:text-green-400">
              Webhook configurado automaticamente
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Configure o webhook manualmente no painel do Meta Developers usando os dados acima.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Calling API */}
      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Phone className="h-4 w-4" />
              API de Ligações
            </h3>
            <p className="text-xs text-muted-foreground">
              Habilita chamadas de voz via WhatsApp
            </p>
          </div>
          <Switch
            checked={existingConfig.calling_enabled || false}
            onCheckedChange={handleToggleCalling}
            disabled={updateConfig.isPending}
          />
        </div>

        {existingConfig.calling_enabled && (
          <div className="space-y-3 pl-4 border-l-2 border-muted">
            {isLoadingCallingStatus ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verificando status...
              </div>
            ) : callingStatus?.meta_calling_enabled ? (
              <Alert className="border-green-500/50 bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-700 dark:text-green-400">
                  <strong>Calling API habilitada no Meta!</strong>
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                <Alert className="border-amber-500/50 bg-amber-500/10">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-amber-700 dark:text-amber-400">
                    <strong>Calling API não habilitada no Meta</strong>
                    <br />
                    <span className="text-xs">
                      {callingStatus?.is_eligible_for_calling === false ? (
                        <>É necessário Tier 2+ (2.000 msgs/dia) para habilitar.</>
                      ) : (
                        <>Clique abaixo para habilitar a Calling API.</>
                      )}
                    </span>
                  </AlertDescription>
                </Alert>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => enableCallingMutation.mutate()}
                  disabled={enableCallingMutation.isPending || callingStatus?.is_eligible_for_calling === false}
                >
                  {enableCallingMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Phone className="h-4 w-4 mr-2" />
                  )}
                  Habilitar Calling API no Meta
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Desconectar */}
      <div className="border-t pt-4">
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => {
            if (confirm('Tem certeza que deseja desconectar a Cloud API?')) {
              disconnectMutation.mutate();
            }
          }}
          disabled={disconnectMutation.isPending}
        >
          {disconnectMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Unlink className="h-4 w-4 mr-2" />
          )}
          Desconectar Cloud API
        </Button>
      </div>
    </div>
  );
}
