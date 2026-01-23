import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  MessageSquare,
  Loader2,
  Check,
  AlertCircle,
  Shield,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PhoneRegistrationModalProps {
  open: boolean;
  onClose: () => void;
  phoneNumberId: string;
  channelName?: string;
  onSuccess?: () => void;
}

type Step = 'status' | 'request_code' | 'verify_code' | 'register' | 'success';

interface PhoneStatus {
  id: string;
  displayPhoneNumber: string;
  verifiedName: string;
  codeVerificationStatus: string;
  qualityRating: string;
  messagingLimitTier: string;
  isOfficialBusinessAccount: boolean;
  accountMode: string;
  certificate: string;
  nameStatus: string;
}

export function PhoneRegistrationModal({
  open,
  onClose,
  phoneNumberId,
  channelName,
  onSuccess,
}: PhoneRegistrationModalProps) {
  const [step, setStep] = useState<Step>('status');
  const [isLoading, setIsLoading] = useState(false);
  const [phoneStatus, setPhoneStatus] = useState<PhoneStatus | null>(null);
  const [codeMethod, setCodeMethod] = useState<'SMS' | 'VOICE'>('SMS');
  const [verificationCode, setVerificationCode] = useState('');
  const [pin, setPin] = useState('');

  const supabaseUrl = 'https://lkxrmjqrzhaivviuuamp.supabase.co';

  useEffect(() => {
    if (open && phoneNumberId) {
      fetchPhoneStatus();
    }
  }, [open, phoneNumberId]);

  const handleClose = () => {
    setStep('status');
    setVerificationCode('');
    setPin('');
    setIsLoading(false);
    onClose();
  };

  const callApi = async (action: string, data: Record<string, any> = {}) => {
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      throw new Error('Voce precisa estar logado');
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/cloudapi-register-phone`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.data.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          phoneNumberId,
          ...data,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Erro na operacao');
    }

    return result;
  };

  const fetchPhoneStatus = async () => {
    setIsLoading(true);
    try {
      const result = await callApi('get_status');
      setPhoneStatus(result.phoneNumber);
    } catch (error: any) {
      console.error('Error fetching status:', error);
      toast.error(error.message || 'Erro ao buscar status do numero');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestCode = async () => {
    setIsLoading(true);
    try {
      await callApi('request_code', { codeMethod });
      toast.success(
        codeMethod === 'SMS'
          ? 'Codigo enviado via SMS!'
          : 'Voce recebera uma ligacao com o codigo!'
      );
      setStep('verify_code');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao solicitar codigo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('Digite o codigo de 6 digitos');
      return;
    }

    setIsLoading(true);
    try {
      await callApi('verify_code', { code: verificationCode });
      toast.success('Codigo verificado com sucesso!');
      setStep('register');
    } catch (error: any) {
      toast.error(error.message || 'Codigo invalido ou expirado');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    setIsLoading(true);
    try {
      await callApi('register', { pin: pin || undefined });
      toast.success('Numero registrado com sucesso!');
      setStep('success');
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao registrar numero');
    } finally {
      setIsLoading(false);
    }
  };

  const getQualityBadge = (quality: string) => {
    switch (quality?.toUpperCase()) {
      case 'GREEN':
        return <Badge className="bg-green-500">Alta</Badge>;
      case 'YELLOW':
        return <Badge className="bg-yellow-500">Media</Badge>;
      case 'RED':
        return <Badge className="bg-red-500">Baixa</Badge>;
      default:
        return <Badge variant="secondary">{quality || 'N/A'}</Badge>;
    }
  };

  const getVerificationBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'VERIFIED':
        return <Badge className="bg-green-500"><Check className="w-3 h-3 mr-1" />Verificado</Badge>;
      case 'NOT_VERIFIED':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Nao Verificado</Badge>;
      case 'EXPIRED':
        return <Badge variant="outline" className="text-amber-600"><AlertCircle className="w-3 h-3 mr-1" />Expirado</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Pendente'}</Badge>;
    }
  };

  const needsRegistration = phoneStatus?.codeVerificationStatus !== 'VERIFIED';

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-green-600" />
            Registro do Numero
          </DialogTitle>
          <DialogDescription>
            {channelName || 'WhatsApp Oficial'}
          </DialogDescription>
        </DialogHeader>

        {/* Status Step */}
        {step === 'status' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-2 text-sm text-muted-foreground">Carregando status...</p>
              </div>
            ) : phoneStatus ? (
              <>
                <Card>
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Numero:</span>
                      <span className="font-medium">{phoneStatus.displayPhoneNumber}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Nome Verificado:</span>
                      <span className="font-medium">{phoneStatus.verifiedName || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Status:</span>
                      {getVerificationBadge(phoneStatus.codeVerificationStatus)}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Qualidade:</span>
                      {getQualityBadge(phoneStatus.qualityRating)}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Tier de Mensagens:</span>
                      <Badge variant="outline">{phoneStatus.messagingLimitTier || 'N/A'}</Badge>
                    </div>
                    {phoneStatus.isOfficialBusinessAccount && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Shield className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-600 font-medium">Conta Oficial Verificada</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {needsRegistration ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-700 dark:text-amber-400">Numero precisa ser registrado</p>
                        <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                          Para enviar e receber mensagens, voce precisa verificar e registrar este numero.
                        </p>
                      </div>
                    </div>

                    <Button onClick={() => setStep('request_code')} className="w-full">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Iniciar Verificacao
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-green-700 dark:text-green-400">Numero registrado e pronto para uso!</span>
                  </div>
                )}

                <Button variant="outline" onClick={fetchPhoneStatus} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar Status
                </Button>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">Nao foi possivel carregar o status</p>
                <Button variant="outline" onClick={fetchPhoneStatus} className="mt-2">
                  Tentar novamente
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Request Code Step */}
        {step === 'request_code' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Como deseja receber o codigo?</Label>
              <Select value={codeMethod} onValueChange={(v) => setCodeMethod(v as 'SMS' | 'VOICE')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SMS">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      SMS
                    </div>
                  </SelectItem>
                  <SelectItem value="VOICE">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Ligacao
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg text-sm">
              <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
              <p className="text-muted-foreground">
                {codeMethod === 'SMS'
                  ? 'Um codigo de 6 digitos sera enviado para o numero via SMS.'
                  : 'Voce recebera uma ligacao automatica informando o codigo de 6 digitos.'}
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('status')} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleRequestCode} disabled={isLoading} className="flex-1">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Enviar Codigo</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Verify Code Step */}
        {step === 'verify_code' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-sm">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-green-700 dark:text-green-400">
                {codeMethod === 'SMS' ? 'Codigo enviado via SMS!' : 'Ligacao realizada!'}
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Codigo de Verificacao</Label>
              <Input
                id="code"
                placeholder="000000"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-widest font-mono"
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground text-center">
                Digite o codigo de 6 digitos
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('request_code')} className="flex-1">
                Reenviar
              </Button>
              <Button
                onClick={handleVerifyCode}
                disabled={isLoading || verificationCode.length !== 6}
                className="flex-1"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>Verificar</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Register Step */}
        {step === 'register' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-sm">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-green-700 dark:text-green-400">Codigo verificado com sucesso!</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin">PIN de Seguranca (opcional)</Label>
              <Input
                id="pin"
                type="password"
                placeholder="000000"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center tracking-widest font-mono"
                maxLength={6}
              />
              <p className="text-xs text-muted-foreground">
                PIN de 6 digitos para autenticacao de dois fatores (2FA). Deixe em branco para nao usar.
              </p>
            </div>

            <Button onClick={handleRegister} disabled={isLoading} className="w-full">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Registrar Numero
            </Button>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-6 space-y-3">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-center">Numero Registrado!</h3>
              <p className="text-sm text-muted-foreground text-center">
                Seu numero foi verificado e registrado com sucesso. Agora voce pode enviar e receber mensagens.
              </p>
            </div>

            <Button onClick={handleClose} className="w-full">
              Fechar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
