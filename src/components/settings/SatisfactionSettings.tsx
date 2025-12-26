import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, MessageCircle, Star, ThumbsUp, Save, RefreshCw } from 'lucide-react';
import { useSatisfactionConfig, useUpdateSatisfactionConfig } from '@/hooks/useSatisfactionConfig';

const DEFAULT_NPS_MESSAGE = `Olá! 👋

Gostaríamos de saber sua opinião sobre o atendimento.

De 0 a 10, o quanto você recomendaria nosso atendimento a um amigo?

Responda apenas com o número. Sua opinião é muito importante para nós! 🙏`;

const DEFAULT_CSAT_MESSAGE = `Olá! 👋

Como foi seu atendimento hoje?

😊 Ótimo (responda 5)
😐 Regular (responda 3)
😞 Ruim (responda 1)

Responda com o número correspondente!`;

export function SatisfactionSettings() {
  const { data: config, isLoading } = useSatisfactionConfig();
  const updateConfig = useUpdateSatisfactionConfig();

  const [isActive, setIsActive] = useState(false);
  const [surveyType, setSurveyType] = useState<'nps' | 'csat'>('nps');
  const [delayMinutes, setDelayMinutes] = useState(5);
  const [messageNps, setMessageNps] = useState(DEFAULT_NPS_MESSAGE);
  const [messageCsat, setMessageCsat] = useState(DEFAULT_CSAT_MESSAGE);
  const [sendOnlyBusinessHours, setSendOnlyBusinessHours] = useState(false);
  const [autoCloseOnResponse, setAutoCloseOnResponse] = useState(true);

  useEffect(() => {
    if (config) {
      setIsActive(config.is_active);
      setSurveyType(config.survey_type);
      setDelayMinutes(config.delay_minutes);
      setMessageNps(config.message_nps);
      setMessageCsat(config.message_csat);
      setSendOnlyBusinessHours(config.send_only_business_hours);
      setAutoCloseOnResponse(config.auto_close_on_response);
    }
  }, [config]);

  const handleSave = () => {
    updateConfig.mutate({
      is_active: isActive,
      survey_type: surveyType,
      delay_minutes: delayMinutes,
      message_nps: messageNps,
      message_csat: messageCsat,
      send_only_business_hours: sendOnlyBusinessHours,
      auto_close_on_response: autoCloseOnResponse,
    });
  };

  const handleResetMessage = () => {
    if (surveyType === 'nps') {
      setMessageNps(DEFAULT_NPS_MESSAGE);
    } else {
      setMessageCsat(DEFAULT_CSAT_MESSAGE);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Pesquisa de Satisfação
              </CardTitle>
              <CardDescription>
                Configure o envio automático de pesquisas de satisfação após o encerramento de conversas
              </CardDescription>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tipo de Pesquisa */}
          <div className="space-y-3">
            <Label>Tipo de Pesquisa</Label>
            <RadioGroup
              value={surveyType}
              onValueChange={(v) => setSurveyType(v as 'nps' | 'csat')}
              className="grid grid-cols-2 gap-4"
            >
              <Label
                htmlFor="nps"
                className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer hover:bg-accent ${
                  surveyType === 'nps' ? 'border-primary' : 'border-muted'
                }`}
              >
                <RadioGroupItem value="nps" id="nps" className="sr-only" />
                <ThumbsUp className="mb-3 h-6 w-6" />
                <span className="font-medium">NPS</span>
                <span className="text-xs text-muted-foreground text-center">
                  Nota de 0 a 10
                </span>
              </Label>
              <Label
                htmlFor="csat"
                className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer hover:bg-accent ${
                  surveyType === 'csat' ? 'border-primary' : 'border-muted'
                }`}
              >
                <RadioGroupItem value="csat" id="csat" className="sr-only" />
                <Star className="mb-3 h-6 w-6" />
                <span className="font-medium">CSAT</span>
                <span className="text-xs text-muted-foreground text-center">
                  Satisfação (1-5)
                </span>
              </Label>
            </RadioGroup>
          </div>

          {/* Delay */}
          <div className="space-y-2">
            <Label htmlFor="delay">Tempo de espera após encerramento (minutos)</Label>
            <Input
              id="delay"
              type="number"
              min={1}
              max={1440}
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(Number(e.target.value))}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              A pesquisa será enviada {delayMinutes} minutos após o encerramento da conversa
            </p>
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Mensagem da Pesquisa ({surveyType.toUpperCase()})</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetMessage}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Restaurar padrão
              </Button>
            </div>
            <Textarea
              value={surveyType === 'nps' ? messageNps : messageCsat}
              onChange={(e) => 
                surveyType === 'nps' 
                  ? setMessageNps(e.target.value)
                  : setMessageCsat(e.target.value)
              }
              rows={8}
              className="font-mono text-sm"
            />
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview da mensagem</Label>
            <div className="bg-muted/50 rounded-lg p-4 border">
              <div className="flex items-start gap-3">
                <MessageCircle className="h-5 w-5 text-green-600 mt-1" />
                <div className="bg-green-100 dark:bg-green-900/30 rounded-lg px-3 py-2 max-w-sm">
                  <p className="text-sm whitespace-pre-wrap">
                    {surveyType === 'nps' ? messageNps : messageCsat}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Opções adicionais */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enviar apenas em horário comercial</Label>
                <p className="text-xs text-muted-foreground">
                  Pesquisas fora do horário serão enviadas no próximo dia útil
                </p>
              </div>
              <Switch
                checked={sendOnlyBusinessHours}
                onCheckedChange={setSendOnlyBusinessHours}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Não enviar nova pesquisa se já respondeu</Label>
                <p className="text-xs text-muted-foreground">
                  Evita enviar pesquisa se o contato já respondeu recentemente
                </p>
              </div>
              <Switch
                checked={autoCloseOnResponse}
                onCheckedChange={setAutoCloseOnResponse}
              />
            </div>
          </div>

          {/* Instruções */}
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              Como funciona?
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li>Quando uma conversa for encerrada, a pesquisa será agendada automaticamente</li>
              <li>Após o tempo de espera, a mensagem será enviada via WhatsApp</li>
              <li>
                {surveyType === 'nps' 
                  ? 'O cliente responde com um número de 0 a 10' 
                  : 'O cliente responde com 1, 3 ou 5'}
              </li>
              <li>A resposta é capturada automaticamente e exibida nos relatórios</li>
              {surveyType === 'nps' && (
                <li>NPS: 0-6 = Detrator, 7-8 = Passivo, 9-10 = Promotor</li>
              )}
            </ul>
          </div>

          {/* Botão Salvar */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSave}
              disabled={updateConfig.isPending}
            >
              {updateConfig.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
