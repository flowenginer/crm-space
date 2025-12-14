import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Bell, MessageSquare, Save, Info } from 'lucide-react';
import { useQuoteNotificationConfig, useUpdateQuoteNotificationConfig } from '@/hooks/useQuoteNotificationConfig';
import { useChannels } from '@/hooks/useChannels';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const AVAILABLE_DAYS = [
  { value: 3, label: '3 dias antes' },
  { value: 2, label: '2 dias antes' },
  { value: 1, label: '1 dia antes' },
  { value: 0, label: 'No dia do vencimento' },
];

const TEMPLATE_VARIABLES = [
  { var: '{cliente_nome}', desc: 'Nome do cliente' },
  { var: '{numero}', desc: 'Número do orçamento' },
  { var: '{valor}', desc: 'Valor total formatado' },
  { var: '{dias_restantes}', desc: '"3 dias", "1 dia", "hoje"' },
  { var: '{data_validade}', desc: 'Data de validade' },
];

export function QuoteNotificationSettings() {
  const { data: config, isLoading } = useQuoteNotificationConfig();
  const { data: channels = [] } = useChannels();
  const updateConfig = useUpdateQuoteNotificationConfig();

  const [enabled, setEnabled] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([3, 1]);
  const [template, setTemplate] = useState('');
  const [channelId, setChannelId] = useState<string>('');

  useEffect(() => {
    if (config) {
      setEnabled(config.quote_expiration_enabled);
      setSelectedDays(config.quote_expiration_days || [3, 1]);
      setTemplate(config.quote_expiration_template || '');
      setChannelId(config.notification_channel_id || '');
    }
  }, [config]);

  const connectedChannels = channels.filter(c => c.status === 'connected');

  const handleDayToggle = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort((a, b) => b - a)
    );
  };

  const handleSave = () => {
    updateConfig.mutate({
      quote_expiration_enabled: enabled,
      quote_expiration_days: selectedDays,
      quote_expiration_template: template,
      notification_channel_id: channelId || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Preview message
  const previewMessage = template
    .replace('{cliente_nome}', 'João Silva')
    .replace('{numero}', 'ORC-00123')
    .replace('{valor}', 'R$ 1.500,00')
    .replace('{dias_restantes}', '3 dias')
    .replace('{data_validade}', '20/12/2024');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações de Expiração de Orçamentos
          </CardTitle>
          <CardDescription>
            Configure lembretes automáticos via WhatsApp para orçamentos próximos de expirar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enabled">Ativar notificações automáticas</Label>
              <p className="text-sm text-muted-foreground">
                Enviar lembretes para clientes sobre orçamentos expirando
              </p>
            </div>
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              {/* Channel Selection */}
              <div className="space-y-2">
                <Label>Canal WhatsApp para envio</Label>
                <Select value={channelId} onValueChange={setChannelId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um canal" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedChannels.length === 0 ? (
                      <SelectItem value="" disabled>
                        Nenhum canal conectado
                      </SelectItem>
                    ) : (
                      connectedChannels.map(channel => (
                        <SelectItem key={channel.id} value={channel.id}>
                          {channel.name} ({channel.phone_number || 'Sem número'})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {connectedChannels.length === 0 && (
                  <p className="text-sm text-destructive">
                    Conecte um canal WhatsApp para habilitar as notificações
                  </p>
                )}
              </div>

              {/* Days Selection */}
              <div className="space-y-3">
                <Label>Quando notificar</Label>
                <div className="grid grid-cols-2 gap-3">
                  {AVAILABLE_DAYS.map(day => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={selectedDays.includes(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <Label 
                        htmlFor={`day-${day.value}`} 
                        className="text-sm font-normal cursor-pointer"
                      >
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Template */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label>Modelo da mensagem</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Use as variáveis abaixo para personalizar a mensagem</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                <div className="flex flex-wrap gap-1 mb-2">
                  {TEMPLATE_VARIABLES.map(v => (
                    <Badge 
                      key={v.var} 
                      variant="secondary" 
                      className="cursor-pointer text-xs"
                      onClick={() => setTemplate(prev => prev + v.var)}
                    >
                      {v.var}
                    </Badge>
                  ))}
                </div>

                <Textarea
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  rows={6}
                  placeholder="Digite o modelo da mensagem..."
                />
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Prévia da mensagem
                </Label>
                <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                  {previewMessage}
                </div>
              </div>
            </>
          )}

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSave} disabled={updateConfig.isPending}>
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
