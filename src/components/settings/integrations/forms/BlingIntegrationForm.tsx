import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
  Clock,
  Users,
  Package,
  FileText,
  ShoppingCart,
  ArrowLeftRight
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  useBlingConfig, 
  useBlingConfigMutation, 
  useDisconnectBling,
  useBlingLogs,
  useTriggerBlingSync,
  useRefreshBlingToken
} from '@/hooks/useBlingIntegration';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BlingStatusMappingPanel } from './BlingStatusMappingPanel';

interface BlingIntegrationFormProps {
  onSuccess?: () => void;
}

export function BlingIntegrationForm({ onSuccess }: BlingIntegrationFormProps) {
  const { data: config, isLoading } = useBlingConfig();
  const { data: logs } = useBlingLogs(5);
  const updateConfig = useBlingConfigMutation();
  const disconnectBling = useDisconnectBling();
  const triggerSync = useTriggerBlingSync();
  const refreshToken = useRefreshBlingToken();

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // Sync toggles
  const [syncContacts, setSyncContacts] = useState(true);
  const [syncOrders, setSyncOrders] = useState(true);
  const [syncProducts, setSyncProducts] = useState(true);
  const [syncQuotes, setSyncQuotes] = useState(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [syncInterval, setSyncInterval] = useState('1');

  // Load config into form
  useEffect(() => {
    if (config) {
      setClientId(config.client_id || '');
      setSyncContacts(config.sync_contacts);
      setSyncOrders(config.sync_orders);
      setSyncProducts(config.sync_products);
      setSyncQuotes(config.sync_quotes);
      setAutoSyncEnabled(config.auto_sync_enabled);
      setSyncInterval(String(config.sync_interval_hours));
    }
  }, [config]);

  const isConnected = config?.is_active && config?.is_configured;
  const isTokenExpired = config?.token_expires_at 
    ? new Date(config.token_expires_at) < new Date() 
    : true;

  const handleSaveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error('Preencha o Client ID e Client Secret');
      return;
    }

    try {
      await updateConfig.mutateAsync({
        client_id: clientId,
        client_secret: clientSecret,
      });
      toast.success('Credenciais salvas! Agora clique em "Conectar com Bling"');
    } catch (error) {
      console.error('Error saving credentials:', error);
    }
  };

  const handleConnect = () => {
    if (!clientId.trim()) {
      toast.error('Configure as credenciais primeiro');
      return;
    }

    const tenantId = config?.tenant_id || '00000000-0000-0000-0000-000000000001';
    const redirectAfterAuth = `${window.location.origin}/settings?tab=integrations`;
    
    // Redirecionar para a edge function que gerencia o OAuth
    const authorizeUrl = new URL('https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/bling-auth/authorize');
    authorizeUrl.searchParams.set('tenant_id', tenantId);
    authorizeUrl.searchParams.set('redirect_uri', redirectAfterAuth);

    // Abrir em nova janela para evitar bloqueio de iframe
    window.open(authorizeUrl.toString(), '_blank', 'noopener,noreferrer');
    toast.info('Uma nova janela foi aberta para autorização no Bling. Após autorizar, retorne a esta página.');
  };

  const handleSaveSyncSettings = async () => {
    try {
      await updateConfig.mutateAsync({
        sync_contacts: syncContacts,
        sync_orders: syncOrders,
        sync_products: syncProducts,
        sync_quotes: syncQuotes,
        auto_sync_enabled: autoSyncEnabled,
        sync_interval_hours: parseInt(syncInterval),
      });
      toast.success('Configurações salvas');
    } catch (error) {
      console.error('Error saving sync settings:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectBling.mutateAsync();
      setShowDisconnectDialog(false);
      setClientSecret('');
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };

  const handleSync = async () => {
    await triggerSync.mutateAsync(undefined);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Section */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
        <div className="flex items-center gap-3">
          {isConnected && !isTokenExpired ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="font-medium text-foreground">Conectado</p>
                <p className="text-sm text-muted-foreground">
                  Integração ativa com o Bling ERP
                </p>
                {config?.token_expires_at && (
                  <p className="text-xs text-muted-foreground">
                    Token expira em: {format(new Date(config.token_expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            </>
          ) : isConnected && isTokenExpired ? (
            <>
              <AlertCircle className="h-5 w-5 text-amber-500" />
              <div>
                <p className="font-medium text-foreground">Token Expirado</p>
                <p className="text-sm text-muted-foreground">
                  Clique em "Renovar Token" para restaurar o acesso
                </p>
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-foreground">Não conectado</p>
                <p className="text-sm text-muted-foreground">
                  Configure suas credenciais para conectar
                </p>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isConnected && isTokenExpired && (
            <Button
              onClick={() => refreshToken.mutate()}
              disabled={refreshToken.isPending}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshToken.isPending ? 'animate-spin' : ''}`} />
              Renovar Token
            </Button>
          )}
          {isConnected && !isTokenExpired && (
            <Button
              onClick={() => refreshToken.mutate()}
              disabled={refreshToken.isPending}
              variant="ghost"
              size="sm"
              title="Renovar token antecipadamente"
            >
              <RefreshCw className={`h-4 w-4 ${refreshToken.isPending ? 'animate-spin' : ''}`} />
            </Button>
          )}
          {config?.last_sync_at && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Última sync: {format(new Date(config.last_sync_at), "dd/MM HH:mm", { locale: ptBR })}
            </Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* Credentials Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground">Credenciais OAuth</h3>
          <a
            href="https://developer.bling.com.br"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            Criar aplicativo no Bling
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="client-id">Client ID</Label>
            <Input
              id="client-id"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Cole o Client ID do seu aplicativo Bling"
              disabled={isConnected && !isTokenExpired}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-secret">Client Secret</Label>
            <div className="relative">
              <Input
                id="client-secret"
                type={showSecret ? 'text' : 'password'}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="Cole o Client Secret"
                disabled={isConnected && !isTokenExpired}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowSecret(!showSecret)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        {!isConnected && (
          <div className="flex gap-2">
            <Button
              onClick={handleSaveCredentials}
              disabled={!clientId || !clientSecret || updateConfig.isPending}
              variant="outline"
              className="flex-1"
            >
              {updateConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Credenciais
            </Button>
            <Button
              onClick={handleConnect}
              disabled={!config?.client_id}
              className="flex-1"
            >
              Conectar com Bling
            </Button>
          </div>
        )}
      </div>

      {/* Sync Settings - Only show when connected */}
      {isConnected && !isTokenExpired && (
        <>
          <Separator />

          {/* Webhook URL Section */}
          <div className="space-y-3">
            <h3 className="font-medium text-foreground">Webhook para Atualizações em Tempo Real</h3>
            <p className="text-sm text-muted-foreground">
              Configure esta URL no seu aplicativo Bling para receber atualizações automaticamente:
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={`https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/bling-webhook?tenant_id=${config?.tenant_id || ''}`}
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/bling-webhook?tenant_id=${config?.tenant_id || ''}`);
                  toast.success('URL copiada!');
                }}
              >
                Copiar
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="font-medium text-foreground">Configurações de Sincronização</h3>
            
            <div className="grid gap-3">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Contatos / Clientes</p>
                    <p className="text-xs text-muted-foreground">Sincronizar cadastros de clientes</p>
                  </div>
                </div>
                <Switch
                  checked={syncContacts}
                  onCheckedChange={setSyncContacts}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Pedidos</p>
                    <p className="text-xs text-muted-foreground">Sincronizar pedidos de venda</p>
                  </div>
                </div>
                <Switch
                  checked={syncOrders}
                  onCheckedChange={setSyncOrders}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Produtos</p>
                    <p className="text-xs text-muted-foreground">Sincronizar catálogo de produtos</p>
                  </div>
                </div>
                <Switch
                  checked={syncProducts}
                  onCheckedChange={setSyncProducts}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Orçamentos</p>
                    <p className="text-xs text-muted-foreground">Sincronizar propostas/orçamentos</p>
                  </div>
                </div>
                <Switch
                  checked={syncQuotes}
                  onCheckedChange={setSyncQuotes}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Status Mapping Panel */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-medium text-foreground">Mapeamento de Status</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure como os status do Bling correspondem aos status locais
            </p>
            <BlingStatusMappingPanel />
          </div>

          <Separator />

          {/* Auto Sync */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-foreground">Sincronização Automática</h3>
                <p className="text-sm text-muted-foreground">
                  Sincronizar automaticamente em intervalos regulares
                </p>
              </div>
              <Switch
                checked={autoSyncEnabled}
                onCheckedChange={setAutoSyncEnabled}
              />
            </div>

            {autoSyncEnabled && (
              <div className="space-y-2">
                <Label>Intervalo de sincronização</Label>
                <Select value={syncInterval} onValueChange={setSyncInterval}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">A cada 1 hora</SelectItem>
                    <SelectItem value="2">A cada 2 horas</SelectItem>
                    <SelectItem value="6">A cada 6 horas</SelectItem>
                    <SelectItem value="12">A cada 12 horas</SelectItem>
                    <SelectItem value="24">A cada 24 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              onClick={handleSaveSyncSettings}
              disabled={updateConfig.isPending}
              className="flex-1"
            >
              {updateConfig.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Configurações
            </Button>
            <Button
              onClick={handleSync}
              variant="outline"
              disabled={triggerSync.isPending}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${triggerSync.isPending ? 'animate-spin' : ''}`} />
              Sincronizar Agora
            </Button>
          </div>

          {/* Recent Logs */}
          {logs && logs.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="font-medium text-foreground">Últimas Sincronizações</h3>
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div 
                      key={log.id} 
                      className="flex items-center justify-between text-sm p-2 rounded bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={log.status === 'completed' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {log.status === 'completed' ? 'OK' : log.status === 'failed' ? 'Erro' : 'Em andamento'}
                        </Badge>
                        <span className="text-muted-foreground">{log.entity_type || 'Todas'}</span>
                      </div>
                      <span className="text-muted-foreground">
                        {format(new Date(log.started_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Disconnect Button */}
          <Button
            variant="destructive"
            onClick={() => setShowDisconnectDialog(true)}
            className="w-full"
          >
            Desconectar do Bling
          </Button>
        </>
      )}

      {/* Disconnect Confirmation Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar do Bling?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá remover a conexão com o Bling ERP. Os dados já sincronizados permanecerão, 
              mas novas sincronizações não ocorrerão até você reconectar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disconnectBling.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
