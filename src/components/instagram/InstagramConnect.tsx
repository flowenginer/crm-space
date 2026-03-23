import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Instagram, Facebook, Loader2, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface InstagramAccount {
  page_id: string;
  page_name: string;
  page_access_token: string;
  instagram_account_id: string;
  instagram_username: string;
  instagram_name: string;
  profile_picture_url: string | null;
}

interface OAuthMessage {
  type: 'INSTAGRAM_OAUTH_SUCCESS' | 'INSTAGRAM_OAUTH_ERROR';
  accounts?: InstagramAccount[];
  error?: string;
}

interface InstagramConnectProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InstagramConnect({ open, onClose, onSuccess }: InstagramConnectProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'initial' | 'selecting' | 'saving' | 'success'>('initial');
  const [accounts, setAccounts] = useState<InstagramAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const queryClient = useQueryClient();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const processOAuthData = useCallback((data: OAuthMessage) => {
    if (data.type === 'INSTAGRAM_OAUTH_SUCCESS') {
      setIsLoading(false);
      stopPolling();
      if (data.accounts && data.accounts.length > 0) {
        setAccounts(data.accounts);
        setSelectedAccountId(data.accounts[0].instagram_account_id);
        setStep('selecting');
      } else {
        toast.error('Nenhuma conta Instagram Business encontrada. Verifique se sua página do Facebook tem um Instagram Business vinculado.');
      }
    } else if (data.type === 'INSTAGRAM_OAUTH_ERROR') {
      setIsLoading(false);
      stopPolling();
      toast.error(`Erro: ${data.error}`);
    }
  }, [stopPolling]);

  const checkLocalStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem('instagram_oauth_result');
      if (stored) {
        const data = JSON.parse(stored) as OAuthMessage;
        localStorage.removeItem('instagram_oauth_result');
        processOAuthData(data);
        return true;
      }
    } catch (e) {
      localStorage.removeItem('instagram_oauth_result');
    }
    return false;
  }, [processOAuthData]);

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const data = event.data as OAuthMessage;
      if (data.type === 'INSTAGRAM_OAUTH_SUCCESS' || data.type === 'INSTAGRAM_OAUTH_ERROR') {
        processOAuthData(data);
      }
    };

    const storageHandler = (event: StorageEvent) => {
      if (event.key === 'instagram_oauth_result' && event.newValue) {
        try {
          const data = JSON.parse(event.newValue) as OAuthMessage;
          processOAuthData(data);
          localStorage.removeItem('instagram_oauth_result');
        } catch (e) {}
      }
    };

    const focusHandler = () => {
      if (isLoading) checkLocalStorage();
    };

    window.addEventListener('message', messageHandler);
    window.addEventListener('storage', storageHandler);
    window.addEventListener('focus', focusHandler);

    return () => {
      window.removeEventListener('message', messageHandler);
      window.removeEventListener('storage', storageHandler);
      window.removeEventListener('focus', focusHandler);
      stopPolling();
    };
  }, [processOAuthData, stopPolling, isLoading, checkLocalStorage]);

  const handleConnectWithFacebook = async () => {
    setIsLoading(true);
    localStorage.removeItem('instagram_oauth_result');
    stopPolling();

    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        toast.error('Você precisa estar logado');
        setIsLoading(false);
        return;
      }

      const response = await fetch(
        `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/instagram-oauth?action=get-login-url`,
        {
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao iniciar autenticação');

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.loginUrl,
        'instagram-oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
      );

      if (!popup) {
        toast.error('Popup bloqueado. Permita popups para este site.');
        setIsLoading(false);
        return;
      }

      // Start polling
      pollingIntervalRef.current = setInterval(() => {
        if (checkLocalStorage()) {
          stopPolling();
          return;
        }
        if (popup.closed) {
          setTimeout(() => {
            if (checkLocalStorage()) { stopPolling(); return; }
            stopPolling();
            setIsLoading(false);
            toast.info('O popup foi fechado. Se autorizou, tente novamente.');
          }, 500);
          stopPolling();
        }
      }, 300);

    } catch (error: any) {
      toast.error(error.message || 'Erro ao conectar');
      setIsLoading(false);
    }
  };

  const handleSaveAccount = async () => {
    const selected = accounts.find(a => a.instagram_account_id === selectedAccountId);
    if (!selected) return;

    setStep('saving');

    try {
      const session = await supabase.auth.getSession();

      const response = await fetch(
        `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/instagram-oauth?action=save-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(selected),
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar');

      queryClient.invalidateQueries({ queryKey: ['whatsapp-channels'] });
      setStep('success');
      toast.success(`Instagram @${selected.instagram_username} conectado!`);

      setTimeout(() => {
        onSuccess();
        handleClose();
      }, 2000);

    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar conta');
      setStep('selecting');
    }
  };

  const handleClose = () => {
    setStep('initial');
    setAccounts([]);
    setSelectedAccountId('');
    setIsLoading(false);
    stopPolling();
    localStorage.removeItem('instagram_oauth_result');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-600" />
            Conectar Instagram Direct
          </DialogTitle>
          <DialogDescription>
            Conecte sua conta do Instagram Business para receber e enviar mensagens Direct.
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
                  <span>Receber mensagens do Instagram Direct</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Responder diretamente pelo CRM</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Atendimento unificado WhatsApp + Instagram</span>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                Você será redirecionado para o Facebook. Sua página precisa ter um Instagram Business vinculado.
              </p>
            </div>

            <Button
              onClick={handleConnectWithFacebook}
              disabled={isLoading}
              className="w-full gap-2"
              style={{ background: 'linear-gradient(135deg, #833AB4, #E1306C, #F77737)', border: 'none' }}
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
              Selecione a conta Instagram que deseja conectar:
            </div>

            <RadioGroup value={selectedAccountId} onValueChange={setSelectedAccountId} className="space-y-2">
              {accounts.map((account) => (
                <div
                  key={account.instagram_account_id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedAccountId === account.instagram_account_id
                      ? 'border-pink-500 bg-pink-500/5'
                      : 'border-border hover:border-pink-500/50'
                  }`}
                  onClick={() => setSelectedAccountId(account.instagram_account_id)}
                >
                  <RadioGroupItem value={account.instagram_account_id} id={account.instagram_account_id} />
                  <Label htmlFor={account.instagram_account_id} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-3">
                      {account.profile_picture_url && (
                        <img
                          src={account.profile_picture_url}
                          alt={account.instagram_username}
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <div>
                        <div className="font-medium">@{account.instagram_username}</div>
                        <div className="text-xs text-muted-foreground">
                          Página: {account.page_name}
                        </div>
                      </div>
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
                style={{ background: 'linear-gradient(135deg, #833AB4, #E1306C)', border: 'none' }}
              >
                <Check className="h-4 w-4" />
                Conectar
              </Button>
            </div>
          </div>
        )}

        {step === 'saving' && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
            <p className="text-sm text-muted-foreground">Salvando conta...</p>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center py-6 space-y-4">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <div className="text-center">
              <h3 className="font-semibold">Instagram conectado!</h3>
              <p className="text-sm text-muted-foreground">
                Sua conta foi vinculada com sucesso ao CRM.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
