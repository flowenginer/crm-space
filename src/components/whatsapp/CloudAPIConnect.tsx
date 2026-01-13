import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Facebook, 
  Loader2, 
  Check, 
  AlertCircle, 
  Phone,
  Shield,
  Zap,
  Copy,
  ExternalLink,
  MessageSquare,
  Settings,
  KeyRound,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useDepartments } from '@/hooks/useDepartments';
import { initFacebookSDK, launchWhatsAppSignup } from '@/lib/facebook-sdk';
import { ManualCloudAPIForm } from './ManualCloudAPIForm';

export interface CloudAPIConnectProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'initial' | 'loading' | 'configure' | 'saving' | 'success';

// WhatsApp Embedded Signup Configuration ID from Meta Developers
// This should be created in the Meta Developers Console under WhatsApp > Embedded Signup
const EMBEDDED_SIGNUP_CONFIG_ID = '651498887519322'; // Replace with actual config ID

export function CloudAPIConnect({ open, onClose, onSuccess }: CloudAPIConnectProps) {
  const [step, setStep] = useState<Step>('initial');
  const [isLoading, setIsLoading] = useState(false);
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [channelName, setChannelName] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [webhookInfo, setWebhookInfo] = useState<{ url: string; token: string } | null>(null);
  const [signupData, setSignupData] = useState<{
    code: string;
    wabaId?: string;
    phoneNumberId?: string;
  } | null>(null);
  
  const queryClient = useQueryClient();
  const { data: departments = [] } = useDepartments();
  const supabaseUrl = 'https://lkxrmjqrzhaivviuuamp.supabase.co';

  // Initialize Facebook SDK when dialog opens
  useEffect(() => {
    if (open && !isSdkReady) {
      console.log('[CloudAPIConnect] Initializing Facebook SDK...');
      initFacebookSDK()
        .then(() => {
          console.log('[CloudAPIConnect] Facebook SDK ready');
          setIsSdkReady(true);
        })
        .catch((error) => {
          console.error('[CloudAPIConnect] Failed to initialize Facebook SDK:', error);
          toast.error('Erro ao carregar Facebook SDK. Tente recarregar a página.');
        });
    }
  }, [open, isSdkReady]);

  const handleClose = () => {
    setStep('initial');
    setChannelName('');
    setSelectedDepartmentId('');
    setWebhookInfo(null);
    setSignupData(null);
    setIsLoading(false);
    onClose();
  };

  const handleConnectWithFacebook = async () => {
    if (!isSdkReady) {
      toast.error('Facebook SDK ainda não está pronto. Aguarde...');
      return;
    }

    setIsLoading(true);
    setStep('loading');

    try {
      console.log('[CloudAPIConnect] Starting WhatsApp Embedded Signup...');
      
      // Launch the WhatsApp Embedded Signup flow
      const result = await launchWhatsAppSignup(EMBEDDED_SIGNUP_CONFIG_ID);
      
      console.log('[CloudAPIConnect] Signup result:', result);

      if (!result.code) {
        throw new Error('Nenhum código de autorização recebido');
      }

      // Store the signup data
      setSignupData(result);
      
      // Set a default channel name
      setChannelName('WhatsApp Oficial');
      
      // Move to configure step
      setStep('configure');
      setIsLoading(false);

    } catch (error: any) {
      console.error('[CloudAPIConnect] Error:', error);
      toast.error(error.message || 'Erro ao conectar com Facebook');
      setIsLoading(false);
      setStep('initial');
    }
  };

  const handleCompleteSetup = async () => {
    if (!signupData?.code || !channelName.trim()) {
      toast.error('Preencha o nome do canal');
      return;
    }

    setStep('saving');

    try {
      const session = await supabase.auth.getSession();
      
      if (!session.data.session) {
        throw new Error('Você precisa estar logado');
      }

      console.log('[CloudAPIConnect] Completing setup with:', {
        hasCode: !!signupData.code,
        wabaId: signupData.wabaId,
        phoneNumberId: signupData.phoneNumberId,
        channelName,
      });

      // Call the edge function to exchange code and complete setup
      const response = await fetch(
        `${supabaseUrl}/functions/v1/whatsapp-embedded-signup?action=exchange-code`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: signupData.code,
            wabaId: signupData.wabaId,
            phoneNumberId: signupData.phoneNumberId,
            channelName: channelName.trim(),
            departmentId: selectedDepartmentId || null,
          }),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao configurar canal');
      }

      setWebhookInfo({
        url: data.config.webhookUrl,
        token: data.config.verifyToken,
      });

      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setStep('success');
      toast.success('Canal configurado com sucesso!');
      onSuccess?.();

    } catch (error: any) {
      console.error('[CloudAPIConnect] Setup error:', error);
      toast.error(error.message);
      setStep('configure');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const [connectionMode, setConnectionMode] = useState<'facebook' | 'manual'>('manual');

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Conectar WhatsApp Oficial (Cloud API)
          </DialogTitle>
          <DialogDescription>
            Conecte seu número usando a API oficial do Meta.
          </DialogDescription>
        </DialogHeader>

        {step === 'initial' && (
          <Tabs value={connectionMode} onValueChange={(v) => setConnectionMode(v as 'facebook' | 'manual')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual" className="gap-2">
                <KeyRound className="h-4 w-4" />
                Manual
              </TabsTrigger>
              <TabsTrigger value="facebook" className="gap-2">
                <Facebook className="h-4 w-4" />
                Via Facebook
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual" className="mt-4">
              <ManualCloudAPIForm 
                onSuccess={() => {
                  onSuccess?.();
                }}
                onClose={handleClose}
              />
            </TabsContent>

            <TabsContent value="facebook" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Vantagens da API Oficial:</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-500" />
                    <span>Conexão permanente (sem QR Code)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-green-500" />
                    <span>Alta disponibilidade e estabilidade</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-green-500" />
                    <span>Suporte a chamadas de voz</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Templates de mensagem aprovados</span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-muted-foreground">
                  Você poderá criar ou selecionar uma conta WhatsApp Business diretamente no popup do Facebook.
                </p>
              </div>

              <Button 
                onClick={handleConnectWithFacebook} 
                disabled={isLoading || !isSdkReady} 
                className="w-full gap-2 bg-[#1877F2] hover:bg-[#166FE5]"
              >
                {!isSdkReady ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <Facebook className="h-4 w-4" />
                    Conectar com Facebook
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {/* Loading Step */}
        {step === 'loading' && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Aguardando autorização no Facebook...</p>
              <p className="text-xs text-muted-foreground">
                Complete o processo no popup para continuar
              </p>
            </div>
          </div>
        )}

        {/* Configure Step */}
        {step === 'configure' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-sm text-green-700 dark:text-green-400">
              <Check className="h-4 w-4" />
              <span>Autorização concluída com sucesso!</span>
            </div>

            {signupData?.wabaId && (
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Settings className="h-4 w-4" />
                  <span>WABA ID: {signupData.wabaId}</span>
                </div>
                {signupData.phoneNumberId && (
                  <div className="flex items-center gap-2 text-muted-foreground mt-1">
                    <Phone className="h-4 w-4" />
                    <span>Phone ID: {signupData.phoneNumberId}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="channelName">Nome do Canal</Label>
              <Input
                id="channelName"
                placeholder="Ex: WhatsApp Vendas"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Departamento (opcional)</Label>
              <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep('initial')} className="flex-1">
                Voltar
              </Button>
              <Button 
                onClick={handleCompleteSetup} 
                disabled={!channelName.trim()} 
                className="flex-1"
              >
                Finalizar
              </Button>
            </div>
          </div>
        )}

        {/* Saving Step */}
        {step === 'saving' && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Configurando canal...</p>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-4 space-y-3">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-center font-medium">Canal configurado com sucesso!</p>
            </div>

            {webhookInfo && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Configuração do Webhook (se necessário)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground text-xs">
                    Se o webhook não foi configurado automaticamente, use estas informações no Meta Developers:
                  </p>
                  
                  <div className="space-y-2">
                    <Label className="text-xs">Callback URL</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={webhookInfo.url} 
                        readOnly 
                        className="text-xs font-mono"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => copyToClipboard(webhookInfo.url, 'URL')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Verify Token</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={webhookInfo.token} 
                        readOnly 
                        className="text-xs font-mono"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => copyToClipboard(webhookInfo.token, 'Token')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => window.open('https://developers.facebook.com/apps', '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir Meta Developers
                  </Button>
                </CardContent>
              </Card>
            )}

            <Button onClick={handleClose} className="w-full">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
