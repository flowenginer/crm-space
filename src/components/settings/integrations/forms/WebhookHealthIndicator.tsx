import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Activity,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface WebhookHealthData {
  success: boolean;
  config?: {
    id: string;
    phone_number_id: string;
    waba_id: string;
    webhook_configured: boolean;
  };
  health?: {
    status: 'healthy' | 'warning' | 'error' | 'unknown';
    message: string;
    last_message_at: string | null;
    last_conversation_message_at: string | null;
  };
  recent_logs?: {
    count: number;
    logs: Array<{
      id: string;
      event_type: string;
      created_at: string;
    }>;
  };
  status?: string;
  message?: string;
  error?: string;
}

export function WebhookHealthIndicator() {
  const [isTesting, setIsTesting] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<WebhookHealthData>({
    queryKey: ['webhook-health'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('cloudapi-test-webhook', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (response.error) throw response.error;
      return response.data as WebhookHealthData;
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 2 * 60 * 1000,
  });

  const handleTestWebhook = async () => {
    setIsTesting(true);
    try {
      await refetch();
      toast.success('Verificação concluída!');
    } catch (err) {
      toast.error('Erro ao verificar webhook');
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verificando status do webhook...
      </div>
    );
  }

  if (error || !data?.success) {
    const errorMsg = data?.status === 'no_config' 
      ? data.message 
      : (error as Error)?.message || 'Erro ao verificar webhook';
    
    return (
      <Alert className="border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertDescription className="text-amber-700 dark:text-amber-400 flex items-center justify-between">
          <span className="text-sm">{errorMsg}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTestWebhook}
            disabled={isTesting}
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const health = data.health;
  if (!health) return null;

  const statusConfig = {
    healthy: {
      icon: CheckCircle2,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10 border-green-500/30',
      textColor: 'text-green-700 dark:text-green-400',
    },
    warning: {
      icon: AlertTriangle,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10 border-amber-500/30',
      textColor: 'text-amber-700 dark:text-amber-400',
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10 border-red-500/30',
      textColor: 'text-red-700 dark:text-red-400',
    },
    unknown: {
      icon: HelpCircle,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50 border-muted',
      textColor: 'text-muted-foreground',
    },
  };

  const config = statusConfig[health.status];
  const Icon = config.icon;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4" />
          Status do Webhook
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleTestWebhook}
          disabled={isTesting}
          className="h-8 px-2"
        >
          {isTesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-1 text-xs">Testar</span>
        </Button>
      </div>

      <Alert className={config.bgColor}>
        <Icon className={`h-4 w-4 ${config.color}`} />
        <AlertDescription className={`${config.textColor} text-sm`}>
          <div className="space-y-1">
            <p>{health.message}</p>
            {health.last_message_at && (
              <p className="text-xs opacity-80">
                Última mensagem: {formatDistanceToNow(new Date(health.last_message_at), { 
                  addSuffix: true, 
                  locale: ptBR 
                })}
              </p>
            )}
          </div>
        </AlertDescription>
      </Alert>

      {data.recent_logs && data.recent_logs.count > 0 && (
        <div className="text-xs text-muted-foreground">
          {data.recent_logs.count} eventos nas últimas 24h
        </div>
      )}
    </div>
  );
}
