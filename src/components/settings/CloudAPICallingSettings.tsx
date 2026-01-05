import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Phone, Info, ExternalLink, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CloudAPIConfig {
  id: string;
  channel_id: string;
  phone_number_id: string;
  calling_enabled: boolean;
  transcription_enabled: boolean;
  sentiment_analysis_enabled: boolean;
  is_active: boolean;
}

export function CloudAPICallingSettings() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all CloudAPI configs
  const { data: configs, isLoading } = useQuery({
    queryKey: ['cloudapi-configs-calling', profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];

      const { data, error } = await supabase
        .from('cloudapi_configs')
        .select(`
          id,
          channel_id,
          phone_number_id,
          calling_enabled,
          transcription_enabled,
          sentiment_analysis_enabled,
          is_active,
          whatsapp_channels!cloudapi_configs_channel_id_fkey (
            name,
            phone_number
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.tenant_id,
  });

  // Toggle calling mutation
  const toggleCallingMutation = useMutation({
    mutationFn: async ({ configId, enabled }: { configId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from('cloudapi_configs')
        .update({ calling_enabled: enabled })
        .eq('id', configId);

      if (error) throw error;
    },
    onSuccess: (_, { enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['cloudapi-configs-calling'] });
      toast.success(enabled ? 'Chamadas ativadas' : 'Chamadas desativadas');
    },
    onError: (error) => {
      console.error('Error toggling calling:', error);
      toast.error('Erro ao alterar configuração de chamadas');
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!configs || configs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Chamadas WhatsApp
          </CardTitle>
          <CardDescription>
            Configure chamadas de voz via WhatsApp Business API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Nenhuma configuração Cloud API encontrada. Configure um canal WhatsApp 
              via Cloud API para habilitar chamadas.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Chamadas WhatsApp
        </CardTitle>
        <CardDescription>
          Configure chamadas de voz via WhatsApp Business API (Cloud API)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            As chamadas WhatsApp usam a API oficial da Meta (Cloud API). 
            É necessário habilitar o recurso de chamadas no{' '}
            <a 
              href="https://business.facebook.com/latest/whatsapp_manager" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Meta Business Manager
              <ExternalLink className="h-3 w-3" />
            </a>
            {' '}antes de usar.
          </AlertDescription>
        </Alert>

        {/* Configs list */}
        <div className="space-y-4">
          {configs.map((config: any) => {
            const channel = config.whatsapp_channels;
            const channelName = channel?.name || 'Canal sem nome';
            const phoneNumber = channel?.phone_number || config.phone_number_id;

            return (
              <div 
                key={config.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${config.calling_enabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'}`}>
                    <Phone className={`h-4 w-4 ${config.calling_enabled ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="font-medium">{channelName}</p>
                    <p className="text-sm text-muted-foreground">{phoneNumber}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Badge variant={config.calling_enabled ? 'default' : 'secondary'}>
                    {config.calling_enabled ? (
                      <><CheckCircle2 className="h-3 w-3 mr-1" /> Ativo</>
                    ) : (
                      <><XCircle className="h-3 w-3 mr-1" /> Inativo</>
                    )}
                  </Badge>

                  <div className="flex items-center gap-2">
                    <Switch
                      id={`calling-${config.id}`}
                      checked={config.calling_enabled}
                      onCheckedChange={(checked) => {
                        toggleCallingMutation.mutate({ configId: config.id, enabled: checked });
                      }}
                      disabled={toggleCallingMutation.isPending}
                    />
                    <Label htmlFor={`calling-${config.id}`} className="text-sm">
                      Chamadas
                    </Label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Instructions */}
        <div className="pt-4 border-t space-y-3">
          <h4 className="text-sm font-medium">Como ativar chamadas no Meta:</h4>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Acesse o Meta Business Manager</li>
            <li>Vá para WhatsApp Manager → Configurações do número</li>
            <li>Em "Chamadas de voz e vídeo", ative o recurso</li>
            <li>Configure o webhook para receber eventos de chamada</li>
            <li>Ative a opção "Chamadas" acima para cada canal desejado</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
