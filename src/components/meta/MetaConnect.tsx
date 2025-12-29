import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Facebook, Loader2, Check, AlertCircle, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface AdAccount {
  id: string;
  name: string;
  account_id: string;
  currency?: string;
  timezone_name?: string;
  business?: {
    id: string;
    name: string;
  };
}

interface OAuthMessage {
  type: 'META_OAUTH_SUCCESS' | 'META_OAUTH_ERROR';
  accessToken?: string;
  expiresIn?: number;
  adAccounts?: AdAccount[];
  state?: string;
  error?: string;
}

export function MetaConnect() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'initial' | 'selecting' | 'saving' | 'success'>('initial');
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [oauthData, setOauthData] = useState<{ accessToken: string; expiresIn: number } | null>(null);
  const queryClient = useQueryClient();
  
  // Ref para controlar o intervalo de polling
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const popupWindowRef = useRef<Window | null>(null);

  // Cleanup do polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Processar dados OAuth
  const processOAuthData = useCallback((data: OAuthMessage) => {
    if (data.type === 'META_OAUTH_SUCCESS') {
      console.log('[MetaConnect] OAuth success, accounts:', data.adAccounts?.length);
      setIsLoading(false);
      stopPolling();
      
      if (data.adAccounts && data.adAccounts.length > 0) {
        setAdAccounts(data.adAccounts);
        setOauthData({
          accessToken: data.accessToken!,
          expiresIn: data.expiresIn || 5184000
        });
        setSelectedAccountId(data.adAccounts[0].id);
        setStep('selecting');
      } else {
        toast.error('Nenhuma conta de anúncios encontrada. Verifique suas permissões no Meta Business.');
      }
    } else if (data.type === 'META_OAUTH_ERROR') {
      console.error('[MetaConnect] OAuth error:', data.error);
      setIsLoading(false);
      stopPolling();
      toast.error(`Erro na autenticação: ${data.error}`);
    }
  }, [stopPolling]);

  // Verificar localStorage e processar dados
  const checkLocalStorageForOAuthData = useCallback(() => {
    try {
      const storedData = localStorage.getItem('meta_oauth_result');
      if (storedData) {
        const data = JSON.parse(storedData) as OAuthMessage;
        if (data.type === 'META_OAUTH_SUCCESS' || data.type === 'META_OAUTH_ERROR') {
          console.log('[MetaConnect] Found OAuth data in localStorage');
          localStorage.removeItem('meta_oauth_result');
          processOAuthData(data);
          return true;
        }
      }
    } catch (e) {
      console.error('[MetaConnect] Error checking localStorage:', e);
      localStorage.removeItem('meta_oauth_result');
    }
    return false;
  }, [processOAuthData]);

  // Iniciar polling do localStorage
  const startPolling = useCallback((popup: Window) => {
    popupWindowRef.current = popup;
    
    // Verificar imediatamente se há dados de tentativa anterior
    if (checkLocalStorageForOAuthData()) {
      return;
    }
    
    // Iniciar polling com verificação mais frequente
    pollingIntervalRef.current = setInterval(() => {
      // Verificar localStorage
      if (checkLocalStorageForOAuthData()) {
        stopPolling();
        return;
      }
      
      // Verificar se popup foi fechado
      if (popup.closed) {
        console.log('[MetaConnect] Popup closed, checking localStorage one more time...');
        
        // Dar um tempo extra para o localStorage ser preenchido antes de desistir
        setTimeout(() => {
          if (checkLocalStorageForOAuthData()) {
            stopPolling();
            return;
          }
          
          console.log('[MetaConnect] No OAuth data found after popup closed');
          stopPolling();
          setIsLoading(false);
          
          // Mostrar toast informativo
          toast.info('O popup foi fechado. Se você autorizou o acesso, tente novamente.');
        }, 500);
        
        stopPolling();
      }
    }, 300); // Polling mais frequente (300ms)
  }, [processOAuthData, stopPolling, checkLocalStorageForOAuthData]);

  // Listener para postMessage e storage events
  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const data = event.data as OAuthMessage;
      if (data.type === 'META_OAUTH_SUCCESS' || data.type === 'META_OAUTH_ERROR') {
        processOAuthData(data);
      }
    };
    
    const storageHandler = (event: StorageEvent) => {
      if (event.key === 'meta_oauth_result' && event.newValue) {
        try {
          const data = JSON.parse(event.newValue) as OAuthMessage;
          processOAuthData(data);
          localStorage.removeItem('meta_oauth_result');
        } catch (e) {
          console.error('[MetaConnect] Error parsing localStorage data:', e);
        }
      }
    };
    
    window.addEventListener('message', messageHandler);
    window.addEventListener('storage', storageHandler);
    
    return () => {
      window.removeEventListener('message', messageHandler);
      window.removeEventListener('storage', storageHandler);
      stopPolling();
    };
  }, [processOAuthData, stopPolling]);

  const handleConnectWithFacebook = async () => {
    setIsLoading(true);
    
    // Limpar dados anteriores
    localStorage.removeItem('meta_oauth_result');
    stopPolling();
    
    try {
      const session = await supabase.auth.getSession();
      
      if (!session.data.session) {
        toast.error('Você precisa estar logado para conectar uma conta');
        setIsLoading(false);
        return;
      }

      // Get OAuth login URL from edge function
      const response = await fetch(
        `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/meta-oauth?action=get-login-url`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao iniciar autenticação');
      }
      
      // Open popup for Facebook login
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        data.loginUrl,
        'meta-oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
      );

      if (!popup) {
        toast.error('Popup bloqueado. Por favor, permita popups para este site.');
        setIsLoading(false);
        return;
      }

      // Iniciar polling para resultado OAuth
      startPolling(popup);

    } catch (error: any) {
      console.error('[MetaConnect] Error:', error);
      toast.error(error.message || 'Erro ao conectar com o Facebook');
      setIsLoading(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!selectedAccountId || !oauthData) {
      toast.error('Selecione uma conta de anúncios');
      return;
    }

    const selectedAccount = adAccounts.find(acc => acc.id === selectedAccountId);
    if (!selectedAccount) return;

    setStep('saving');
    
    try {
      const session = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/meta-oauth?action=save-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            accountId: selectedAccount.id,
            accountName: selectedAccount.name,
            accessToken: oauthData.accessToken,
            expiresIn: oauthData.expiresIn,
            businessId: selectedAccount.business?.id,
            currency: selectedAccount.currency,
            timezone: selectedAccount.timezone_name
          })
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao salvar conta');
      }

      queryClient.invalidateQueries({ queryKey: ['meta-accounts'] });
      setStep('success');
      toast.success('Conta conectada com sucesso!');

      // Close dialog after a moment
      setTimeout(() => {
        handleClose();
      }, 2000);

    } catch (error: any) {
      console.error('[MetaConnect] Save error:', error);
      toast.error(error.message || 'Erro ao salvar conta');
      setStep('selecting');
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setStep('initial');
    setAdAccounts([]);
    setSelectedAccountId('');
    setOauthData(null);
    setIsLoading(false);
    stopPolling();
    localStorage.removeItem('meta_oauth_result');
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      handleClose();
    } else {
      setIsOpen(true);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Facebook className="h-4 w-4" />
          Conectar Meta Ads
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Facebook className="h-5 w-5 text-blue-600" />
            Conectar conta Meta Ads
          </DialogTitle>
          <DialogDescription>
            Conecte sua conta do Meta Business para sincronizar campanhas e métricas.
          </DialogDescription>
        </DialogHeader>

        {step === 'initial' && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">O que você terá acesso:</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Todas as campanhas e métricas</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Impressões, cliques, CTR, CPC</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Gastos e conversões por período</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Correlação com leads do WhatsApp</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                Você será redirecionado para o Facebook para autorizar o acesso às suas contas de anúncios.
              </p>
            </div>

            <Button 
              onClick={handleConnectWithFacebook} 
              disabled={isLoading} 
              className="w-full gap-2 bg-[#1877F2] hover:bg-[#166FE5]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aguardando autorização...
                </>
              ) : (
                <>
                  <Facebook className="h-4 w-4" />
                  Conectar com Facebook
                </>
              )}
            </Button>
          </div>
        )}

        {step === 'selecting' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Selecione a conta de anúncios que deseja conectar:
            </div>

            <RadioGroup value={selectedAccountId} onValueChange={setSelectedAccountId} className="space-y-2">
              {adAccounts.map((account) => (
                <div 
                  key={account.id} 
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedAccountId === account.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedAccountId(account.id)}
                >
                  <RadioGroupItem value={account.id} id={account.id} />
                  <Label htmlFor={account.id} className="flex-1 cursor-pointer">
                    <div className="font-medium">{account.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span>ID: {account.account_id}</span>
                      {account.business && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {account.business.name}
                          </span>
                        </>
                      )}
                      {account.currency && (
                        <>
                          <span>•</span>
                          <span>{account.currency}</span>
                        </>
                      )}
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep('initial')} className="flex-1">
                Voltar
              </Button>
              <Button 
                onClick={handleSaveAccount} 
                disabled={!selectedAccountId} 
                className="flex-1 gap-2"
              >
                <Check className="h-4 w-4" />
                Conectar Conta
              </Button>
            </div>
          </div>
        )}

        {step === 'saving' && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Salvando conta...</p>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center py-6 space-y-4">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">Conta conectada!</h3>
              <p className="text-sm text-muted-foreground">
                Sua conta Meta Ads foi conectada com sucesso.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
