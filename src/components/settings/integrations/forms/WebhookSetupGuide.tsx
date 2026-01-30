import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';

interface WebhookSetupGuideProps {
  webhookUrl: string;
  verifyToken: string;
  isConfigured?: boolean;
  callingEnabled?: boolean;
}

export function WebhookSetupGuide({ webhookUrl, verifyToken, isConfigured, callingEnabled }: WebhookSetupGuideProps) {
  const [isOpen, setIsOpen] = useState(!isConfigured);
  const [copied, setCopied] = useState<'url' | 'token' | null>(null);

  const handleCopy = async (type: 'url' | 'token', value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    toast.success('Copiado!');
    setTimeout(() => setCopied(null), 2000);
  };

  const steps = [
    {
      number: 1,
      title: 'Acesse o Meta Business Suite',
      description: 'Entre no portal de desenvolvedores do Facebook.',
      action: (
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => window.open('https://developers.facebook.com/apps', '_blank')}
        >
          <ExternalLink className="h-4 w-4" />
          Abrir Meta Developers
        </Button>
      ),
    },
    {
      number: 2,
      title: 'Selecione seu Aplicativo',
      description: 'Clique no aplicativo que você criou para o WhatsApp Business API.',
    },
    {
      number: 3,
      title: 'Vá para WhatsApp > Configuração',
      description: 'No menu lateral, clique em "WhatsApp" e depois em "Configuração" ou "API Setup".',
    },
    {
      number: 4,
      title: 'Configure o Webhook',
      description: 'Clique em "Editar" ou "Configure" na seção Webhook e insira os dados abaixo:',
      content: (
        <div className="space-y-3 mt-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Callback URL</Label>
            <div className="flex gap-2">
              <Input 
                value={webhookUrl} 
                readOnly 
                className="font-mono text-xs h-9" 
              />
              <Button 
                variant="outline" 
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => handleCopy('url', webhookUrl)}
              >
                {copied === 'url' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Verify Token</Label>
            <div className="flex gap-2">
              <Input 
                value={verifyToken} 
                readOnly 
                className="font-mono text-xs h-9" 
              />
              <Button 
                variant="outline" 
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => handleCopy('token', verifyToken)}
              >
                {copied === 'token' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      ),
    },
    {
      number: 5,
      title: 'Assine os Campos de Webhook',
      description: 'Após verificar, marque os eventos que deseja receber:',
      content: (
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="font-medium">messages</span>
            <span className="text-xs text-muted-foreground">(obrigatório)</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="font-medium">message_template_status_updates</span>
            <span className="text-xs text-muted-foreground">(recomendado)</span>
          </div>
          {callingEnabled && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-primary" />
              <span className="font-medium">calls</span>
              <span className="text-xs text-muted-foreground">(obrigatório para ligações)</span>
            </div>
          )}
        </div>
      ),
    },
    {
      number: 6,
      title: 'Salve e Verifique',
      description: 'Clique em "Verificar e salvar". Se aparecer uma mensagem de sucesso, o webhook está configurado!',
      content: (
        <div className="mt-2 p-2 bg-green-500/10 border border-green-500/20 rounded-md text-xs text-green-700 dark:text-green-400">
          ✓ Após configurar, envie uma mensagem de teste para seu número e verifique se ela aparece no CRM.
        </div>
      ),
    },
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={isConfigured ? 'border-green-500/20' : 'border-amber-500/30'}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3 hover:bg-muted/50 transition-colors">
            <CardTitle className="text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isConfigured ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                )}
                <span>
                  {isConfigured 
                    ? 'Guia de Configuração do Webhook (configurado)' 
                    : 'Guia de Configuração do Webhook'}
                </span>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.number} className="flex gap-3">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                    {step.number}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-sm">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                    {step.action}
                    {step.content}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
