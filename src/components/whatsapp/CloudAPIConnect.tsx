import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Facebook, 
  Loader2, 
  Check, 
  AlertCircle, 
  Building2,
  Phone,
  Shield,
  Zap,
  Copy,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useDepartments } from '@/hooks/useDepartments';

interface WABA {
  id: string;
  name: string;
  business_id: string;
  business_name: string;
  currency?: string;
  account_review_status?: string;
}

interface PhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating?: string;
  messaging_limit_tier?: string;
}

interface OAuthMessage {
  type: 'WHATSAPP_OAUTH_SUCCESS' | 'WHATSAPP_OAUTH_ERROR';
  wabas?: WABA[];
  state?: string;
  error?: string;
}

export interface CloudAPIConnectProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'initial' | 'loading' | 'select-waba' | 'select-phone' | 'configure' | 'saving' | 'success';

export function CloudAPIConnect({ open, onClose, onSuccess }: CloudAPIConnectProps) {
  const [step, setStep] = useState<Step>('initial');
  const [isLoading, setIsLoading] = useState(false);
  const [wabas, setWabas] = useState<WABA[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [selectedWabaId, setSelectedWabaId] = useState<string>('');
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>('');
  const [channelName, setChannelName] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [webhookInfo, setWebhookInfo] = useState<{ url: string; token: string } | null>(null);
  
  const queryClient = useQueryClient();
  const { data: departments = [] } = useDepartments();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const supabaseUrl = 'https://lkxrmjqrzhaivviuuamp.supabase.co';

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const handleClose = () => {
    stopPolling();
    setStep('initial');
    setWabas([]);
    setPhoneNumbers([]);
    setSelectedWabaId('');
    setSelectedPhoneId('');
    setChannelName('');
    setSelectedDepartmentId('');
    setWebhookInfo(null);
    setIsLoading(false);
    localStorage.removeItem('whatsapp_oauth_result');
    onClose();
  };

  const processOAuthData = useCallback((data: OAuthMessage) => {
    if (data.type === 'WHATSAPP_OAUTH_SUCCESS') {
      setIsLoading(false);
      stopPolling();
      
      if (data.wabas && data.wabas.length > 0) {
        setWabas(data.wabas);
        setSelectedWabaId(data.wabas[0].id);
        setStep('select-waba');
      } else {
        toast.error('Nenhuma conta WhatsApp Business encontrada.');
        setStep('initial');
      }
    } else if (data.type === 'WHATSAPP_OAUTH_ERROR') {
      setIsLoading(false);
      stopPolling();
      toast.error(`Erro na autenticação: ${data.error}`);
      setStep('initial');
    }
  }, [stopPolling]);

  const checkLocalStorage = useCallback(() => {
    try {
      const storedData = localStorage.getItem('whatsapp_oauth_result');
      if (storedData) {
        const data = JSON.parse(storedData) as OAuthMessage;
        localStorage.removeItem('whatsapp_oauth_result');
        processOAuthData(data);
        return true;
      }
    } catch (e) {
      console.error('[CloudAPIConnect] Error checking localStorage:', e);
      localStorage.removeItem('whatsapp_oauth_result');
    }
    return false;
  }, [processOAuthData]);

  const startPolling = useCallback((popup: Window) => {
    if (checkLocalStorage()) return;
    
    pollingIntervalRef.current = setInterval(() => {
      if (checkLocalStorage()) {
        stopPolling();
        return;
      }
      
      if (popup.closed) {
        setTimeout(() => {
          if (!checkLocalStorage()) {
            stopPolling();
            setIsLoading(false);
            toast.info('Popup fechado. Tente novamente se autorizou o acesso.');
          }
        }, 500);
        stopPolling();
      }
    }, 300);
  }, [checkLocalStorage, stopPolling]);

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const data = event.data as OAuthMessage;
      if (data.type?.startsWith('WHATSAPP_OAUTH_')) {
        processOAuthData(data);
      }
    };
    
    const storageHandler = (event: StorageEvent) => {
      if (event.key === 'whatsapp_oauth_result' && event.newValue) {
        try {
          const data = JSON.parse(event.newValue) as OAuthMessage;
          processOAuthData(data);
          localStorage.removeItem('whatsapp_oauth_result');
        } catch (e) {
          console.error('[CloudAPIConnect] Error parsing storage:', e);
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
    setStep('loading');
    localStorage.removeItem('whatsapp_oauth_result');
    stopPolling();

    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        toast.error('Você precisa estar logado');
        setIsLoading(false);
        setStep('initial');
        return;
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/whatsapp-embedded-signup?action=get-signup-url`,
        {
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
          },
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao iniciar autenticação');
      }

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        data.loginUrl,
        'whatsapp-oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      if (!popup) {
        toast.error('Popup bloqueado. Permita popups para este site.');
        setIsLoading(false);
        setStep('initial');
        return;
      }

      startPolling(popup);
    } catch (error: any) {
      console.error('[CloudAPIConnect] Error:', error);
      toast.error(error.message || 'Erro ao conectar');
      setIsLoading(false);
      setStep('initial');
    }
  };

  const handleSelectWaba = async () => {
    if (!selectedWabaId) return;
    
    setIsLoading(true);
    
    try {
      const session = await supabase.auth.getSession();
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/whatsapp-embedded-signup?action=get-phone-numbers`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ wabaId: selectedWabaId }),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao buscar números');
      }

      setPhoneNumbers(data.phoneNumbers || []);
      
      if (data.phoneNumbers?.length > 0) {
        setSelectedPhoneId(data.phoneNumbers[0].id);
        setChannelName(data.phoneNumbers[0].verified_name || 'WhatsApp Oficial');
        setStep('select-phone');
      } else {
        toast.error('Nenhum número de telefone encontrado nesta conta.');
      }
    } catch (error: any) {
      console.error('[CloudAPIConnect] Error fetching phones:', error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteSetup = async () => {
    if (!selectedWabaId || !selectedPhoneId || !channelName.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    setStep('saving');

    try {
      const session = await supabase.auth.getSession();
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/whatsapp-embedded-signup?action=complete-setup`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            wabaId: selectedWabaId,
            phoneNumberId: selectedPhoneId,
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

  const selectedWaba = wabas.find(w => w.id === selectedWabaId);
  const selectedPhone = phoneNumbers.find(p => p.id === selectedPhoneId);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Conectar WhatsApp Oficial (Cloud API)
          </DialogTitle>
          <DialogDescription>
            {step === 'initial' && 'Conecte seu número usando a API oficial do Meta.'}
            {step === 'loading' && 'Aguardando autorização...'}
            {step === 'select-waba' && 'Selecione a conta WhatsApp Business.'}
            {step === 'select-phone' && 'Selecione o número de telefone.'}
            {step === 'configure' && 'Configure o nome do canal.'}
            {step === 'saving' && 'Salvando configuração...'}
            {step === 'success' && 'Canal configurado com sucesso!'}
          </DialogDescription>
        </DialogHeader>

        {/* Initial Step */}
        {step === 'initial' && (
          <div className="space-y-4">
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
                Você será redirecionado para o Facebook para autorizar o acesso à sua conta WhatsApp Business.
              </p>
            </div>

            <Button 
              onClick={handleConnectWithFacebook} 
              disabled={isLoading} 
              className="w-full gap-2 bg-[#1877F2] hover:bg-[#166FE5]"
            >
              <Facebook className="h-4 w-4" />
              Conectar com Facebook
            </Button>
          </div>
        )}

        {/* Loading Step */}
        {step === 'loading' && (
          <div className="flex flex-col items-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Aguardando autorização no Facebook...</p>
          </div>
        )}

        {/* Select WABA Step */}
        {step === 'select-waba' && (
          <div className="space-y-4">
            <RadioGroup value={selectedWabaId} onValueChange={setSelectedWabaId} className="space-y-2">
              {wabas.map((waba) => (
                <div 
                  key={waba.id} 
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedWabaId === waba.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedWabaId(waba.id)}
                >
                  <RadioGroupItem value={waba.id} id={waba.id} />
                  <Label htmlFor={waba.id} className="flex-1 cursor-pointer">
                    <div className="font-medium">{waba.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {waba.business_name}
                      </span>
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
                onClick={handleSelectWaba} 
                disabled={!selectedWabaId || isLoading} 
                className="flex-1"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continuar'}
              </Button>
            </div>
          </div>
        )}

        {/* Select Phone Step */}
        {step === 'select-phone' && (
          <div className="space-y-4">
            <RadioGroup value={selectedPhoneId} onValueChange={(id) => {
              setSelectedPhoneId(id);
              const phone = phoneNumbers.find(p => p.id === id);
              if (phone?.verified_name) {
                setChannelName(phone.verified_name);
              }
            }} className="space-y-2">
              {phoneNumbers.map((phone) => (
                <div 
                  key={phone.id} 
                  className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                    selectedPhoneId === phone.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => {
                    setSelectedPhoneId(phone.id);
                    if (phone.verified_name) setChannelName(phone.verified_name);
                  }}
                >
                  <RadioGroupItem value={phone.id} id={phone.id} />
                  <Label htmlFor={phone.id} className="flex-1 cursor-pointer">
                    <div className="font-medium">{phone.display_phone_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {phone.verified_name}
                      {phone.messaging_limit_tier && (
                        <span className="ml-2 text-green-600">• Tier {phone.messaging_limit_tier}</span>
                      )}
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <div className="space-y-3 pt-2">
              <div>
                <Label htmlFor="channelName">Nome do canal *</Label>
                <Input
                  id="channelName"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="Ex: Atendimento Principal"
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Departamento (opcional)</Label>
                <Select value={selectedDepartmentId || "none"} onValueChange={(v) => setSelectedDepartmentId(v === "none" ? "" : v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep('select-waba')} className="flex-1">
                Voltar
              </Button>
              <Button 
                onClick={handleCompleteSetup} 
                disabled={!selectedPhoneId || !channelName.trim()} 
                className="flex-1"
              >
                Configurar Canal
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
              <div className="text-center">
                <h3 className="font-semibold">Canal configurado!</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedPhone?.display_phone_number} está pronto para receber mensagens.
                </p>
              </div>
            </div>

            {webhookInfo && !webhookInfo.token.includes('auto') && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Configuração do Webhook (se necessário)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-xs bg-background p-2 rounded border truncate">
                        {webhookInfo.url}
                      </code>
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(webhookInfo.url, 'URL')}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Verify Token</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="flex-1 text-xs bg-background p-2 rounded border truncate">
                        {webhookInfo.token}
                      </code>
                      <Button size="sm" variant="outline" onClick={() => copyToClipboard(webhookInfo.token, 'Token')}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Button variant="link" className="p-0 h-auto text-xs" asChild>
                    <a 
                      href="https://developers.facebook.com/apps" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Abrir Meta Developers
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                Concluir
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
