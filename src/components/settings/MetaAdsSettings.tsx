import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  Facebook, 
  RefreshCw, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Loader2, 
  ExternalLink,
  Plus,
  Calendar,
  Globe,
  DollarSign
} from 'lucide-react';
import { MetaConnect } from '@/components/meta/MetaConnect';
import { format, formatDistanceToNow, isBefore, addDays } from 'date-fns';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface MetaAccount {
  id: string;
  account_id: string;
  account_name: string | null;
  access_token: string;
  token_expires_at: string | null;
  last_sync_at: string | null;
  is_active: boolean;
  currency: string | null;
  timezone: string | null;
  business_id: string | null;
  created_at: string;
}

type TokenStatus = 'valid' | 'expiring' | 'expired';

function getTokenStatus(expiresAt: string | null): TokenStatus {
  if (!expiresAt) return 'valid'; // Assume valid if no expiry
  
  const expiry = new Date(expiresAt);
  const now = new Date();
  const warningDate = addDays(now, 7);
  
  if (isBefore(expiry, now)) return 'expired';
  if (isBefore(expiry, warningDate)) return 'expiring';
  return 'valid';
}

function TokenStatusBadge({ status, expiresAt }: { status: TokenStatus; expiresAt: string | null }) {
  const config = {
    valid: {
      icon: CheckCircle,
      label: 'Token válido',
      className: 'bg-green-500/10 text-green-500',
    },
    expiring: {
      icon: Clock,
      label: 'Expirando em breve',
      className: 'bg-amber-500/10 text-amber-500',
    },
    expired: {
      icon: AlertCircle,
      label: 'Token expirado',
      className: 'bg-red-500/10 text-red-500',
    },
  };

  const { icon: Icon, label, className } = config[status];
  
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
      <Icon size={14} />
      <span>{label}</span>
      {expiresAt && status !== 'expired' && (
        <span className="text-[10px] opacity-70">
          ({formatDistanceToNow(new Date(expiresAt), { locale: ptBR, addSuffix: true })})
        </span>
      )}
    </div>
  );
}

export function MetaAdsSettings() {
  const queryClient = useQueryClient();
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  // Fetch connected accounts
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['meta-accounts-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_ad_accounts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as MetaAccount[];
    },
  });

  // Sync account mutation
  const syncAccount = useMutation({
    mutationFn: async (accountId: string) => {
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/meta-sync`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ accountId })
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro na sincronização');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast.success('Sincronização concluída!');
      queryClient.invalidateQueries({ queryKey: ['meta-accounts-settings'] });
      queryClient.invalidateQueries({ queryKey: ['meta-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['meta-campaigns'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro na sincronização');
    },
  });

  // Refresh token mutation
  const refreshToken = useMutation({
    mutationFn: async (accountId: string) => {
      const account = accounts.find(a => a.id === accountId);
      if (!account) throw new Error('Conta não encontrada');
      
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/meta-oauth?action=refresh-token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            accountId,
            accessToken: account.access_token 
          })
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao renovar token');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast.success('Token renovado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['meta-accounts-settings'] });
      queryClient.invalidateQueries({ queryKey: ['meta-accounts'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao renovar token. Reconecte a conta.');
    },
  });

  // Delete account mutation
  const deleteAccount = useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from('meta_ad_accounts')
        .update({ is_active: false })
        .eq('id', accountId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Conta desconectada');
      queryClient.invalidateQueries({ queryKey: ['meta-accounts-settings'] });
      queryClient.invalidateQueries({ queryKey: ['meta-accounts'] });
    },
    onError: () => {
      toast.error('Erro ao desconectar conta');
    },
  });

  const handleSync = async (accountId: string) => {
    setSyncingId(accountId);
    try {
      await syncAccount.mutateAsync(accountId);
    } finally {
      setSyncingId(null);
    }
  };

  const handleRefreshToken = async (accountId: string) => {
    setRefreshingId(accountId);
    try {
      await refreshToken.mutateAsync(accountId);
    } finally {
      setRefreshingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Facebook size={20} className="text-blue-600" />
              </div>
              <div>
                <CardTitle>Meta Ads</CardTitle>
                <CardDescription>
                  Gerencie suas contas do Meta Business conectadas
                </CardDescription>
              </div>
            </div>
            <MetaConnect />
          </div>
        </CardHeader>
      </Card>

      {/* Connected Accounts */}
      {accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Facebook size={32} className="text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">Nenhuma conta conectada</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Conecte sua conta do Meta Business para sincronizar campanhas e acompanhar métricas de anúncios.
            </p>
            <MetaConnect />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => {
            const tokenStatus = getTokenStatus(account.token_expires_at);
            const isSyncing = syncingId === account.id;
            const isRefreshing = refreshingId === account.id;
            
            return (
              <Card key={account.id} className={tokenStatus === 'expired' ? 'border-red-500/50' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        tokenStatus === 'valid' ? 'bg-green-500/10' : 
                        tokenStatus === 'expiring' ? 'bg-amber-500/10' : 'bg-red-500/10'
                      }`}>
                        <Facebook size={20} className={
                          tokenStatus === 'valid' ? 'text-green-500' : 
                          tokenStatus === 'expiring' ? 'text-amber-500' : 'text-red-500'
                        } />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {account.account_name || 'Conta Meta'}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                          ID: {account.account_id}
                          {account.business_id && (
                            <span className="text-xs">• Business: {account.business_id}</span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                    <TokenStatusBadge status={tokenStatus} expiresAt={account.token_expires_at} />
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* Account Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign size={14} />
                      <span>Moeda: {account.currency || 'BRL'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe size={14} />
                      <span>Fuso: {account.timezone || 'America/Sao_Paulo'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar size={14} />
                      <span>
                        Conectado: {format(new Date(account.created_at), 'dd/MM/yyyy', { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <RefreshCw size={14} />
                      <span>
                        Sync: {account.last_sync_at 
                          ? formatDistanceToNow(new Date(account.last_sync_at), { locale: ptBR, addSuffix: true })
                          : 'Nunca'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(account.id)}
                      disabled={isSyncing || tokenStatus === 'expired'}
                    >
                      {isSyncing ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Sincronizar
                    </Button>

                    {(tokenStatus === 'expiring' || tokenStatus === 'expired') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRefreshToken(account.id)}
                        disabled={isRefreshing}
                        className={tokenStatus === 'expired' ? 'border-red-500 text-red-500 hover:bg-red-500/10' : ''}
                      >
                        {isRefreshing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        {tokenStatus === 'expired' ? 'Reconectar' : 'Renovar Token'}
                      </Button>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Desconectar
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Desconectar conta?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso irá remover a conexão com a conta "{account.account_name}". 
                            Os dados históricos serão mantidos, mas não haverá mais sincronização.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteAccount.mutate(account.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Desconectar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Documentation Card */}
      <Card className="bg-blue-500/5 border-blue-500/20">
        <CardHeader>
          <CardTitle className="text-sm text-blue-500 flex items-center gap-2">
            <ExternalLink size={16} />
            Documentação e Recursos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>
              • Meta Business Suite:{' '}
              <a 
                href="https://business.facebook.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                business.facebook.com
                <ExternalLink size={12} className="inline ml-1" />
              </a>
            </li>
            <li>
              • Gerenciador de Anúncios:{' '}
              <a 
                href="https://www.facebook.com/adsmanager" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                facebook.com/adsmanager
                <ExternalLink size={12} className="inline ml-1" />
              </a>
            </li>
            <li>
              • Meta for Developers:{' '}
              <a 
                href="https://developers.facebook.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                developers.facebook.com
                <ExternalLink size={12} className="inline ml-1" />
              </a>
            </li>
            <li>
              • Marketing API Docs:{' '}
              <a 
                href="https://developers.facebook.com/docs/marketing-apis" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Marketing API Documentation
                <ExternalLink size={12} className="inline ml-1" />
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
