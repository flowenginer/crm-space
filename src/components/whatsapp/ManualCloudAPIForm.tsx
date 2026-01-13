import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Loader2, 
  Check, 
  AlertCircle, 
  Phone,
  Key,
  Building2,
  Copy,
  ExternalLink,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useDepartments } from '@/hooks/useDepartments';
import { useTestCloudAPIConnection } from '@/hooks/useCloudAPIConfig';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface ManualCloudAPIFormProps {
  onSuccess: () => void;
  onClose: () => void;
}

type FormStep = 'form' | 'testing' | 'saving' | 'success';

interface WebhookInfo {
  url: string;
  token: string;
}

export function ManualCloudAPIForm({ onSuccess, onClose }: ManualCloudAPIFormProps) {
  const [step, setStep] = useState<FormStep>('form');
  const [accessToken, setAccessToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [channelName, setChannelName] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [connectionTest, setConnectionTest] = useState<{
    tested: boolean;
    success: boolean;
    phoneNumber?: string;
    verifiedName?: string;
  }>({ tested: false, success: false });

  const queryClient = useQueryClient();
  const { data: departments = [] } = useDepartments();
  const testConnection = useTestCloudAPIConnection();
  const supabaseUrl = 'https://lkxrmjqrzhaivviuuamp.supabase.co';

  const handleTestConnection = async () => {
    if (!accessToken.trim() || !phoneNumberId.trim()) {
      toast.error('Preencha o Token e o Phone Number ID');
      return;
    }

    setStep('testing');

    try {
      const result = await testConnection.mutateAsync({
        phone_number_id: phoneNumberId.trim(),
        access_token: accessToken.trim(),
      });

      setConnectionTest({
        tested: true,
        success: true,
        phoneNumber: result.phone_number,
        verifiedName: result.verified_name,
      });

      if (!channelName) {
        setChannelName(result.verified_name || 'WhatsApp Oficial');
      }

      setStep('form');
    } catch (error) {
      setConnectionTest({ tested: true, success: false });
      setStep('form');
    }
  };

  const handleConnect = async () => {
    if (!accessToken.trim() || !phoneNumberId.trim() || !wabaId.trim() || !channelName.trim()) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (!connectionTest.success) {
      toast.error('Teste a conexão antes de continuar');
      return;
    }

    setStep('saving');

    try {
      const session = await supabase.auth.getSession();
      
      if (!session.data.session) {
        throw new Error('Você precisa estar logado');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/cloudapi-manual-connect`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken: accessToken.trim(),
            phoneNumberId: phoneNumberId.trim(),
            wabaId: wabaId.trim(),
            channelName: channelName.trim(),
            departmentId: selectedDepartmentId || null,
          }),
        }
      );

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao conectar canal');
      }

      setWebhookInfo({
        url: data.webhookUrl,
        token: data.verifyToken,
      });

      queryClient.invalidateQueries({ queryKey: ['channels'] });
      queryClient.invalidateQueries({ queryKey: ['cloudapi-configs'] });
      setStep('success');
      toast.success('Canal conectado com sucesso!');
      onSuccess();
    } catch (error: any) {
      console.error('[ManualCloudAPIForm] Error:', error);
      toast.error(error.message);
      setStep('form');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const isFormValid = accessToken.trim() && phoneNumberId.trim() && wabaId.trim() && channelName.trim() && connectionTest.success;

  if (step === 'testing') {
    return (
      <div className="flex flex-col items-center py-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Testando conexão com a API do Meta...</p>
      </div>
    );
  }

  if (step === 'saving') {
    return (
      <div className="flex flex-col items-center py-8 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Configurando canal...</p>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center py-4 space-y-3">
          <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Check className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-center font-medium">Canal conectado com sucesso!</p>
        </div>

        {webhookInfo && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                Configuração do Webhook no Meta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-muted-foreground text-xs">
                Configure o webhook no Meta Developers usando estas informações:
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

              <p className="text-muted-foreground text-xs">
                Inscreva os campos: <code className="bg-muted px-1 rounded">messages</code>, <code className="bg-muted px-1 rounded">message_template_status_update</code>
              </p>

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

        <Button onClick={onClose} className="w-full">
          Fechar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection Test Status */}
      {connectionTest.tested && (
        <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
          connectionTest.success 
            ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
        }`}>
          {connectionTest.success ? (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <div>
                <span className="font-medium">Conexão verificada!</span>
                {connectionTest.verifiedName && (
                  <span className="ml-2 text-xs opacity-80">
                    ({connectionTest.verifiedName} - {connectionTest.phoneNumber})
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4" />
              <span>Falha na conexão. Verifique os dados e tente novamente.</span>
            </>
          )}
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="accessToken" className="flex items-center gap-1">
            <Key className="h-3.5 w-3.5" />
            Token de Acesso Permanente *
          </Label>
          <Textarea
            id="accessToken"
            placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx..."
            value={accessToken}
            onChange={(e) => {
              setAccessToken(e.target.value);
              setConnectionTest({ tested: false, success: false });
            }}
            className="font-mono text-xs min-h-[60px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phoneNumberId" className="flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" />
            Phone Number ID *
          </Label>
          <Input
            id="phoneNumberId"
            placeholder="972828205910071"
            value={phoneNumberId}
            onChange={(e) => {
              setPhoneNumberId(e.target.value);
              setConnectionTest({ tested: false, success: false });
            }}
            className="font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="wabaId" className="flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" />
            WABA ID (WhatsApp Business Account) *
          </Label>
          <Input
            id="wabaId"
            placeholder="861391676804044"
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            className="font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="channelName">Nome do Canal *</Label>
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
      </div>

      {/* Help Accordion */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="help" className="border-none">
          <AccordionTrigger className="text-sm text-muted-foreground py-2 hover:no-underline">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Onde encontrar esses dados?
            </div>
          </AccordionTrigger>
          <AccordionContent className="text-xs text-muted-foreground space-y-3">
            <div>
              <p className="font-medium mb-1">Token de Acesso Permanente:</p>
              <ol className="list-decimal list-inside space-y-0.5 ml-1">
                <li>Acesse Meta Business Suite &gt; Configurações</li>
                <li>Vá em "Usuários do Sistema"</li>
                <li>Crie ou edite um usuário do sistema</li>
                <li>Gere um token com permissões:
                  <ul className="list-disc list-inside ml-4">
                    <li>whatsapp_business_management</li>
                    <li>whatsapp_business_messaging</li>
                  </ul>
                </li>
              </ol>
            </div>
            <div>
              <p className="font-medium mb-1">Phone Number ID e WABA ID:</p>
              <ol className="list-decimal list-inside space-y-0.5 ml-1">
                <li>Acesse Meta Developers</li>
                <li>Selecione seu app</li>
                <li>Vá em WhatsApp &gt; API Configuration</li>
                <li>Os IDs aparecem na seção principal</li>
              </ol>
            </div>
            <Button
              variant="link"
              size="sm"
              className="px-0 h-auto text-xs"
              onClick={() => window.open('https://developers.facebook.com/apps', '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Abrir Meta Developers
            </Button>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button 
          variant="outline" 
          onClick={handleTestConnection} 
          disabled={!accessToken.trim() || !phoneNumberId.trim()}
          className="flex-1"
        >
          Testar Conexão
        </Button>
        <Button 
          onClick={handleConnect} 
          disabled={!isFormValid}
          className="flex-1"
        >
          Conectar
        </Button>
      </div>
    </div>
  );
}
