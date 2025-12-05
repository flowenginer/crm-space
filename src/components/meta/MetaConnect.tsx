import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Facebook, Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface AdAccount {
  id: string;
  account_id: string;
  name: string;
  currency?: string;
  timezone_name?: string;
  business?: {
    id: string;
    name: string;
  };
}

export function MetaConnect() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'initial' | 'select-account' | 'success'>('initial');
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      // Get login URL
      const session = await supabase.auth.getSession();
      const response = await fetch(
        `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/meta-oauth?action=get-login-url`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const { loginUrl } = await response.json();
      
      // Open popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        loginUrl,
        'meta-oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Listen for message from popup
      const handleMessage = async (event: MessageEvent) => {
        if (event.data.type === 'META_OAUTH_SUCCESS') {
          window.removeEventListener('message', handleMessage);
          
          setAccessToken(event.data.accessToken);
          setExpiresIn(event.data.expiresIn);
          setAdAccounts(event.data.adAccounts || []);
          
          if (event.data.adAccounts && event.data.adAccounts.length > 0) {
            setStep('select-account');
          } else {
            toast.error('Nenhuma conta de anúncio encontrada');
            setStep('initial');
          }
          
          setIsLoading(false);
        } else if (event.data.type === 'META_OAUTH_ERROR') {
          window.removeEventListener('message', handleMessage);
          toast.error('Erro na autenticação: ' + event.data.error);
          setIsLoading(false);
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if popup was closed
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          if (isLoading) {
            setIsLoading(false);
          }
        }
      }, 500);

    } catch (error: any) {
      console.error('Error starting OAuth:', error);
      toast.error('Erro ao iniciar conexão');
      setIsLoading(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!selectedAccount || !accessToken) return;

    setIsLoading(true);
    try {
      const account = adAccounts.find(a => a.id === selectedAccount);
      if (!account) throw new Error('Conta não encontrada');

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
            accountId: account.id,
            accountName: account.name,
            accessToken,
            expiresIn,
            businessId: account.business?.id,
            currency: account.currency,
            timezone: account.timezone_name
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
        setIsOpen(false);
        setStep('initial');
        setAdAccounts([]);
        setSelectedAccount(null);
        setAccessToken(null);
      }, 2000);

    } catch (error: any) {
      console.error('Error saving account:', error);
      toast.error(error.message || 'Erro ao salvar conta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Facebook className="h-4 w-4" />
          Conectar Meta Ads
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
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

            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-amber-800 dark:text-amber-200">
                Você precisará fazer login com uma conta que tenha acesso às contas de anúncio do Meta Business.
              </p>
            </div>

            <Button onClick={handleConnect} disabled={isLoading} className="w-full gap-2">
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                <>
                  <Facebook className="h-4 w-4" />
                  Continuar com Facebook
                </>
              )}
            </Button>
          </div>
        )}

        {step === 'select-account' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Selecione a conta de anúncios:</label>
              <Select value={selectedAccount || ''} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {adAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex flex-col">
                        <span>{account.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {account.account_id} • {account.currency}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setStep('initial')}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button 
                onClick={handleSaveAccount} 
                disabled={!selectedAccount || isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  'Conectar'
                )}
              </Button>
            </div>
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
