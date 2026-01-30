import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Loader2, 
  Phone, 
  Check,
  AlertCircle, 
  CheckCircle2,
  Shield,
  Zap,
  Facebook,
  ExternalLink,
  Unlink,
  RefreshCw,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { 
  useCloudAPIConfig, 
  useUpdateCloudAPIConfig,
} from '@/hooks/useCloudAPIConfig';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CloudAPIConnect } from '@/components/whatsapp/CloudAPIConnect';
import { WebhookHealthIndicator } from './WebhookHealthIndicator';
import { WebhookSetupGuide } from './WebhookSetupGuide';

interface CloudAPIConfigFormProps {
  onSuccess?: () => void;
}

export function CloudAPIConfigForm({ onSuccess }: CloudAPIConfigFormProps) {
  const queryClient = useQueryClient();
  const { data: existingConfig, isLoading } = useCloudAPIConfig();
  const updateConfig = useUpdateCloudAPIConfig();
  
  const [showConnect, setShowConnect] = useState(false);
  
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
    onSuccess: (data) => {
      if (data?.meta_calling_enabled) {
        toast.success('Calling API habilitada com sucesso!');
      } else {
        toast.info('Solicitação enviada. Verifique o status no Meta.');
      }
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

  const handleToggleCalling = async (enabled: boolean) => {
    if (!existingConfig) return;
    
    try {
      await updateConfig.mutateAsync({
        id: existingConfig.id,
        calling_enabled: enabled,
      });
      // Refetch calling status when enabling
      if (enabled) {
        refetchCallingStatus();
      }
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

  // Render tier badge with appropriate color
  const renderTierBadge = (tierNumber: number) => {
    if (tierNumber >= 2) {
      return <Badge variant="default" className="bg-green-500">{`Tier ${tierNumber}`}</Badge>;
    } else if (tierNumber === 1) {
      return <Badge variant="secondary" className="bg-amber-500 text-white">{`Tier ${tierNumber}`}</Badge>;
    }
    return <Badge variant="outline">Tier desconhecido</Badge>;
  };

  // Render calling status badge
  const renderCallingStatusBadge = (status: string) => {
    if (status === "ENABLED") {
      return <Badge variant="default" className="bg-green-500">ENABLED</Badge>;
    } else if (status === "DISABLED") {
      return <Badge variant="destructive">DISABLED</Badge>;
    }
    return <Badge variant="outline">{status || "desconhecido"}</Badge>;
  };

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

      {/* Webhook Status & Guide */}
      <div className="space-y-4 border-t pt-4">
        <WebhookHealthIndicator />
        
        <WebhookSetupGuide 
          webhookUrl={webhookUrl}
          verifyToken={existingConfig.verify_token}
          isConfigured={existingConfig.webhook_configured}
          callingEnabled={existingConfig.calling_enabled}
        />
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
          <div className="space-y-4 pl-4 border-l-2 border-muted">
            {/* Meta Diagnostics Card */}
            <Card className="bg-muted/50">
              <CardHeader className="py-3">
                <CardTitle className="text-xs flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5" />
                    Diagnóstico Meta
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => refetchCallingStatus()}
                    disabled={isLoadingCallingStatus}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingCallingStatus ? 'animate-spin' : ''}`} />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                {isLoadingCallingStatus ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Consultando Meta Graph API...
                  </div>
                ) : callingStatus?.error ? (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {callingStatus.error}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {/* Phone Info */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Número:</span>
                        <p className="font-medium">{callingStatus?.display_phone_number || '-'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Nome verificado:</span>
                        <p className="font-medium">{callingStatus?.verified_name || '-'}</p>
                      </div>
                    </div>

                    {/* Key Status Indicators */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Tier:</span>
                        <div className="mt-1">
                          {renderTierBadge(callingStatus?.tier_number || 0)}
                          {callingStatus?.tier_number < 2 && (
                            <p className="text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Mínimo Tier 2
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Calling Status:</span>
                        <div className="mt-1">
                          {renderCallingStatusBadge(callingStatus?.calling_status)}
                        </div>
                      </div>
                    </div>

                    {/* Health Status */}
                    {callingStatus?.health_status && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Health:</span>
                        <p className="font-mono text-xs bg-muted px-2 py-1 rounded mt-1">
                          {callingStatus.health_can_send_message === "AVAILABLE" ? (
                            <span className="text-green-600">✓ Pode enviar mensagens</span>
                          ) : callingStatus.health_can_send_message === "LIMITED" ? (
                            <span className="text-amber-600">⚠ Limitado</span>
                          ) : callingStatus.health_can_send_message === "BLOCKED" ? (
                            <span className="text-red-600">✗ Bloqueado</span>
                          ) : (
                            callingStatus.health_can_send_message || 'Desconhecido'
                          )}
                        </p>
                      </div>
                    )}

                    {/* API Version */}
                    <div className="text-xs text-muted-foreground">
                      API Version: {callingStatus?.api_version_used || 'N/A'}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status Alert */}
            {!isLoadingCallingStatus && (
              <>
                {callingStatus?.meta_calling_enabled ? (
                  <Alert className="border-green-500/50 bg-green-500/10">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <AlertDescription className="text-green-700 dark:text-green-400">
                      <strong>Calling API habilitada no Meta!</strong>
                      {callingStatus?.tier_number < 2 && (
                        <span className="block text-xs mt-1">
                          ⚠ Porém seu Tier ({callingStatus?.tier_number}) é menor que 2. Chamadas podem falhar.
                        </span>
                      )}
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
                          ) : callingStatus?.calling_status === "DISABLED" ? (
                            <>Status atual: DISABLED. Clique abaixo para habilitar.</>
                          ) : (
                            <>Status atual: {callingStatus?.calling_status || 'desconhecido'}. Clique abaixo para tentar habilitar.</>
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
              </>
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
