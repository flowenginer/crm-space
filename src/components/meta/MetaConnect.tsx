import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Facebook, Loader2, Check, AlertCircle, ExternalLink, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function MetaConnect() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'initial' | 'success'>('initial');
  const [accessToken, setAccessToken] = useState('');
  const [accountId, setAccountId] = useState('');
  const queryClient = useQueryClient();

  const handleConnect = async () => {
    if (!accessToken.trim() || !accountId.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    // Normalize account ID (add act_ prefix if not present)
    const normalizedAccountId = accountId.startsWith('act_') ? accountId : `act_${accountId}`;

    setIsLoading(true);
    try {
      const session = await supabase.auth.getSession();
      
      const response = await fetch(
        `https://lkxrmjqrzhaivviuuamp.supabase.co/functions/v1/meta-oauth?action=manual-connect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            accessToken: accessToken.trim(),
            accountId: normalizedAccountId
          })
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao conectar conta');
      }

      queryClient.invalidateQueries({ queryKey: ['meta-accounts'] });
      setStep('success');
      toast.success('Conta conectada com sucesso!');

      // Close dialog after a moment
      setTimeout(() => {
        setIsOpen(false);
        setStep('initial');
        setAccessToken('');
        setAccountId('');
      }, 2000);

    } catch (error: any) {
      console.error('Error connecting account:', error);
      toast.error(error.message || 'Erro ao conectar conta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setStep('initial');
      setAccessToken('');
      setAccountId('');
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

            {/* Manual Connection Form */}
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="accessToken" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Access Token
                </Label>
                <Textarea
                  id="accessToken"
                  placeholder="Cole seu Access Token aqui..."
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  rows={3}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountId">
                  Account ID (ID da Conta de Anúncios)
                </Label>
                <Input
                  id="accountId"
                  placeholder="act_123456789 ou apenas 123456789"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            {/* Instructions */}
            <Card className="bg-muted/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Como obter suas credenciais:</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="space-y-1">
                  <p className="font-medium">1. Access Token:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2">
                    <li>Acesse o <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Graph API Explorer <ExternalLink className="h-3 w-3" /></a></li>
                    <li>Selecione seu app no dropdown</li>
                    <li>Adicione permissões: <code className="bg-muted px-1 rounded">ads_read</code>, <code className="bg-muted px-1 rounded">ads_management</code></li>
                    <li>Clique em "Generate Access Token"</li>
                  </ul>
                </div>
                
                <div className="space-y-1">
                  <p className="font-medium">2. Account ID:</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 pl-2">
                    <li>Acesse o <a href="https://business.facebook.com/settings/ad-accounts" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Business Settings <ExternalLink className="h-3 w-3" /></a></li>
                    <li>Vá em Contas → Contas de anúncios</li>
                    <li>Copie o ID da conta (ex: 123456789)</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-amber-800 dark:text-amber-200">
                O Access Token expira após 60 dias. Você precisará renová-lo periodicamente.
              </p>
            </div>

            <Button 
              onClick={handleConnect} 
              disabled={isLoading || !accessToken.trim() || !accountId.trim()} 
              className="w-full gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando e conectando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Verificar e Conectar
                </>
              )}
            </Button>
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
