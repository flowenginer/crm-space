import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bell, 
  Settings, 
  Clock, 
  Calendar, 
  Shield,
  AlertCircle,
  Loader2,
  Save,
  Info,
  Send,
  ChevronDown,
  ChevronUp,
  History,
  CheckCircle2,
  XCircle,
  Ban
} from 'lucide-react';
import { format, addDays, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useQuoteNotificationConfig, useUpdateQuoteNotificationConfig } from '@/hooks/useQuoteNotificationConfig';
import { useChannels } from '@/hooks/useChannels';
import { useQuotes } from '@/hooks/useQuotes';
import { supabase } from '@/integrations/supabase/client';

const SEND_TIME_OPTIONS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', 
  '14:00', '15:00', '16:00', '17:00', '18:00'
];

const DAYS_BEFORE_OPTIONS = [7, 5, 3, 2, 1, 0];
const DAYS_AFTER_OPTIONS = [1, 2, 3, 5, 7];

const DEFAULT_TEMPLATE = `Olá {cliente_nome}! 👋

Seu orçamento #{numero} no valor de {valor} expira em {dias_restantes}.

📅 Validade: {data_validade}

Posso te ajudar a finalizar?`;

export function QuoteNotificationsPanel() {
  const { data: config, isLoading: configLoading } = useQuoteNotificationConfig();
  const { mutate: updateConfig, isPending: updating } = useUpdateQuoteNotificationConfig();
  const { data: channels } = useChannels();
  const { data: quotes } = useQuotes();

  // Local state for form
  const [enabled, setEnabled] = useState(false);
  const [useClientChannel, setUseClientChannel] = useState(true);
  const [channelId, setChannelId] = useState('');
  const [sendTimes, setSendTimes] = useState<string[]>(['09:00']);
  const [triggerType, setTriggerType] = useState<'before_expiry' | 'after_sent'>('before_expiry');
  const [expirationDays, setExpirationDays] = useState<number[]>([3, 1]);
  const [daysAfterSent, setDaysAfterSent] = useState<number[]>([1, 3]);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [minIntervalHours, setMinIntervalHours] = useState(24);
  const [pauseOnWeekends, setPauseOnWeekends] = useState(false);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);

  // Collapsible state - collapsed by default
  const [configOpen, setConfigOpen] = useState(false);

  // Update local state when config loads
  useEffect(() => {
    if (config) {
      setEnabled(config.quote_expiration_enabled);
      setUseClientChannel(config.use_client_channel ?? true);
      setChannelId(config.notification_channel_id ?? '');
      setSendTimes(config.notification_send_times ?? ['09:00']);
      setTriggerType(config.notification_trigger_type ?? 'before_expiry');
      setExpirationDays(config.quote_expiration_days ?? [3, 1]);
      setDaysAfterSent(config.days_after_sent ?? [1, 3]);
      setDailyLimit(config.daily_limit ?? 50);
      setMinIntervalHours(config.min_interval_hours ?? 24);
      setPauseOnWeekends(config.pause_on_weekends ?? false);
      setTemplate(config.quote_expiration_template ?? DEFAULT_TEMPLATE);
    }
  }, [config]);

  const handleTimeToggle = (time: string) => {
    if (sendTimes.includes(time)) {
      if (sendTimes.length > 1) {
        setSendTimes(sendTimes.filter(t => t !== time));
      }
    } else {
      setSendTimes([...sendTimes, time].sort());
    }
  };

  const handleDayBeforeToggle = (day: number) => {
    if (expirationDays.includes(day)) {
      setExpirationDays(expirationDays.filter(d => d !== day));
    } else {
      setExpirationDays([...expirationDays, day].sort((a, b) => b - a));
    }
  };

  const handleDayAfterToggle = (day: number) => {
    if (daysAfterSent.includes(day)) {
      setDaysAfterSent(daysAfterSent.filter(d => d !== day));
    } else {
      setDaysAfterSent([...daysAfterSent, day].sort((a, b) => a - b));
    }
  };

  const handleSaveConfig = () => {
    updateConfig({
      quote_expiration_enabled: enabled,
      use_client_channel: useClientChannel,
      notification_channel_id: channelId || null,
      notification_send_times: sendTimes,
      notification_trigger_type: triggerType,
      quote_expiration_days: expirationDays,
      days_after_sent: daysAfterSent,
      daily_limit: dailyLimit,
      min_interval_hours: minIntervalHours,
      pause_on_weekends: pauseOnWeekends,
      quote_expiration_template: template,
    } as any);
  };

  // Calculate ALL upcoming notifications (one for each configured day)
  const configuredDays = triggerType === 'before_expiry' ? expirationDays : daysAfterSent;
  
  const upcomingNotifications = quotes?.flatMap(quote => {
    if (!['sent', 'approved'].includes(quote.status)) return [];
    
    if (triggerType === 'before_expiry') {
      if (!quote.valid_until) return [];
      const validUntil = parseISO(quote.valid_until);
      const daysUntilExpiry = differenceInDays(validUntil, new Date());
      
      // Return one entry for EACH configured day that hasn't passed yet
      return expirationDays
        .filter(day => day <= daysUntilExpiry)
        .map(day => ({
          ...quote,
          triggerDay: day,
          daysUntilExpiry,
          daysSinceSent: null as number | null,
          scheduledDate: addDays(new Date(), daysUntilExpiry - day),
          notificationKey: `${quote.id}-${day}`,
        }));
    } else {
      if (!quote.created_at) return [];
      const sentDate = parseISO(quote.created_at);
      const daysSinceSent = differenceInDays(new Date(), sentDate);
      
      // Return one entry for EACH configured day that hasn't passed yet
      return daysAfterSent
        .filter(day => day > daysSinceSent)
        .map(day => ({
          ...quote,
          triggerDay: day,
          daysUntilExpiry: null as number | null,
          daysSinceSent,
          scheduledDate: addDays(sentDate, day),
          notificationKey: `${quote.id}-${day}`,
        }));
    }
  }).sort((a, b) => {
    if (!a.scheduledDate || !b.scheduledDate) return 0;
    return a.scheduledDate.getTime() - b.scheduledDate.getTime();
  }) || [];

  const connectedChannels = channels?.filter(c => c.status === 'connected') || [];

  // Fetch notification history
  const { data: notificationHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['quote-notification-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_expiration_notifications')
        .select(`
          *,
          quote:quotes(id, quote_number, total),
          contact:contacts(id, full_name, phone)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
  });

  // Mutation para enviar notificação manual
  const sendNowMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const response = await supabase.functions.invoke('check-expiring-quotes', {
        body: { manualQuoteId: quoteId }
      });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      toast.success('Notificação enviada com sucesso!');
    },
    onError: (error: any) => {
      toast.error('Erro ao enviar notificação: ' + (error.message || 'Erro desconhecido'));
    }
  });

  const getStatusBadge = (status: string, cancelReason?: string | null) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Enviada</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      case 'cancelled':
        return (
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="secondary"><Ban className="h-3 w-3 mr-1" />Cancelada</Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{getCancelReasonText(cancelReason)}</p>
            </TooltipContent>
          </Tooltip>
        );
      case 'pending':
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCancelReasonText = (reason: string | null | undefined) => {
    switch (reason) {
      case 'client_responded': return 'Cliente respondeu';
      case 'quote_converted': return 'Orçamento convertido';
      case 'quote_status_changed': return 'Status do orçamento alterado';
      case 'manual': return 'Cancelamento manual';
      default: return reason || 'Motivo não especificado';
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Card - Collapsible */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CollapsibleTrigger asChild onClick={() => setConfigOpen(!configOpen)}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  {configOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configurações de Notificação
                </CardTitle>
                <CardDescription className="mt-1">
                  Configure como e quando os clientes serão notificados
                </CardDescription>
              </div>
            </div>
            {/* Switch ALWAYS visible */}
            <div className="flex items-center gap-3">
              <Label htmlFor="enable-notifications" className="text-sm text-muted-foreground">
                {enabled ? 'Ativado' : 'Desativado'}
              </Label>
              <Switch 
                id="enable-notifications"
                checked={enabled} 
                onCheckedChange={setEnabled} 
              />
            </div>
          </div>
        </CardHeader>
        
        <Collapsible open={configOpen}>
          <CollapsibleContent>
            <CardContent className="space-y-6 pt-0">
              {enabled && (
                <>
                  {/* Channel Settings */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <Label className="text-base font-medium">Canal de Envio</Label>
                    
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <Checkbox
                        id="useClientChannel"
                        checked={useClientChannel}
                        onCheckedChange={(checked) => setUseClientChannel(checked === true)}
                        className="mt-0.5"
                      />
                      <div className="space-y-1">
                        <Label htmlFor="useClientChannel" className="cursor-pointer font-medium">
                          Responder pelo mesmo canal do cliente
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          O sistema envia pelo canal da última conversa do cliente.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>{useClientChannel ? 'Canal de Fallback' : 'Canal WhatsApp'}</Label>
                      <Select value={channelId} onValueChange={setChannelId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um canal" />
                        </SelectTrigger>
                        <SelectContent>
                          {connectedChannels.map(channel => (
                            <SelectItem key={channel.id} value={channel.id}>
                              {channel.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Send Times - Multi Select */}
                  <div className="space-y-3 p-4 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-base font-medium">Horários de Envio</Label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SEND_TIME_OPTIONS.map(time => (
                        <div
                          key={time}
                          className={`flex items-center gap-2 px-3 py-1.5 border rounded-md cursor-pointer transition-colors text-sm ${
                            sendTimes.includes(time) 
                              ? 'bg-primary text-primary-foreground border-primary' 
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => handleTimeToggle(time)}
                        >
                          <Checkbox 
                            checked={sendTimes.includes(time)} 
                            onCheckedChange={() => handleTimeToggle(time)}
                            className="h-3.5 w-3.5"
                          />
                          <span>{time}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                      <span>As notificações serão distribuídas entre os horários selecionados</span>
                    </div>
                  </div>

                  {/* When to Notify - Trigger Type */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-base font-medium">Quando Notificar?</Label>
                    </div>

                    <RadioGroup 
                      value={triggerType} 
                      onValueChange={(v) => setTriggerType(v as 'before_expiry' | 'after_sent')}
                      className="space-y-4"
                    >
                      {/* Before Expiry Option */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="before_expiry" id="before_expiry" />
                          <Label htmlFor="before_expiry" className="font-medium cursor-pointer">
                            Dias ANTES do vencimento
                          </Label>
                        </div>
                        {triggerType === 'before_expiry' && (
                          <div className="flex flex-wrap gap-2 ml-6">
                            {DAYS_BEFORE_OPTIONS.map(day => (
                              <div
                                key={day}
                                className={`flex items-center gap-2 px-3 py-1.5 border rounded-md cursor-pointer transition-colors text-sm ${
                                  expirationDays.includes(day) 
                                    ? 'bg-primary text-primary-foreground border-primary' 
                                    : 'hover:bg-muted'
                                }`}
                                onClick={() => handleDayBeforeToggle(day)}
                              >
                                <Checkbox 
                                  checked={expirationDays.includes(day)} 
                                  onCheckedChange={() => handleDayBeforeToggle(day)}
                                  className="h-3.5 w-3.5"
                                />
                                <span>{day === 0 ? 'No dia' : `${day} dia${day > 1 ? 's' : ''}`}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* After Sent Option */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="after_sent" id="after_sent" />
                          <Label htmlFor="after_sent" className="font-medium cursor-pointer">
                            Dias APÓS o envio do orçamento (acompanhamento)
                          </Label>
                        </div>
                        {triggerType === 'after_sent' && (
                          <div className="flex flex-wrap gap-2 ml-6">
                            {DAYS_AFTER_OPTIONS.map(day => (
                              <div
                                key={day}
                                className={`flex items-center gap-2 px-3 py-1.5 border rounded-md cursor-pointer transition-colors text-sm ${
                                  daysAfterSent.includes(day) 
                                    ? 'bg-primary text-primary-foreground border-primary' 
                                    : 'hover:bg-muted'
                                }`}
                                onClick={() => handleDayAfterToggle(day)}
                              >
                                <Checkbox 
                                  checked={daysAfterSent.includes(day)} 
                                  onCheckedChange={() => handleDayAfterToggle(day)}
                                  className="h-3.5 w-3.5"
                                />
                                <span>{day} dia{day > 1 ? 's' : ''}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </RadioGroup>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Info className="h-3.5 w-3.5" />
                      <span>Escolha um tipo de gatilho para as notificações</span>
                    </div>
                  </div>

                  {/* Limits and Protections */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      <Label className="text-base font-medium">Limites e Proteções</Label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Limite Diário</Label>
                        <Input
                          type="number"
                          min={1}
                          max={500}
                          value={dailyLimit}
                          onChange={e => setDailyLimit(Number(e.target.value))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Intervalo Mínimo por Cliente</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={168}
                            value={minIntervalHours}
                            onChange={e => setMinIntervalHours(Number(e.target.value))}
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">horas</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="pauseWeekends"
                          checked={pauseOnWeekends}
                          onCheckedChange={(checked) => setPauseOnWeekends(checked === true)}
                        />
                        <Label htmlFor="pauseWeekends" className="cursor-pointer">
                          Pausar nos fins de semana
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Message Template */}
                  <div className="space-y-3 p-4 border rounded-lg">
                    <Label className="text-base font-medium">Modelo da Mensagem</Label>
                    <Textarea
                      rows={6}
                      value={template}
                      onChange={e => setTemplate(e.target.value)}
                      placeholder="Digite o modelo da mensagem..."
                    />
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">{'{cliente_nome}'}</Badge>
                      <Badge variant="outline">{'{numero}'}</Badge>
                      <Badge variant="outline">{'{valor}'}</Badge>
                      <Badge variant="outline">{'{dias_restantes}'}</Badge>
                      <Badge variant="outline">{'{data_validade}'}</Badge>
                    </div>

                    {/* Preview */}
                    <div className="p-3 bg-muted rounded-lg mt-2">
                      <Label className="text-xs text-muted-foreground mb-2 block">Prévia</Label>
                      <div className="bg-background p-3 rounded-lg border whitespace-pre-wrap text-sm">
                        {template
                          .replace('{cliente_nome}', 'João Silva')
                          .replace('{numero}', 'ORC-001')
                          .replace('{valor}', 'R$ 1.500,00')
                          .replace('{dias_restantes}', '3 dias')
                          .replace('{data_validade}', format(addDays(new Date(), 3), 'dd/MM/yyyy'))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Save Button */}
              <div className="flex justify-end">
                <Button onClick={handleSaveConfig} disabled={updating}>
                  {updating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Tabs for Upcoming and History */}
      <Card>
        <CardHeader>
          <Tabs defaultValue="upcoming" className="w-full">
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="upcoming" className="gap-2">
                  <Clock className="h-4 w-4" />
                  Próximas
                  <Badge variant="secondary" className="ml-1">{upcomingNotifications.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2">
                  <History className="h-4 w-4" />
                  Histórico
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="upcoming" className="mt-0">
              <CardContent className="p-0">
                {upcomingNotifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma notificação agendada</p>
                    <p className="text-sm">Orçamentos enviados aparecerão aqui quando estiverem próximos do vencimento</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Orçamento</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>{triggerType === 'before_expiry' ? 'Validade' : 'Data de Envio'}</TableHead>
                          <TableHead>Gatilho</TableHead>
                          <TableHead>Envio Agendado</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {upcomingNotifications.map(item => (
                          <TableRow key={item.notificationKey}>
                            <TableCell className="font-medium">
                              ORC-{String(item.quote_number).padStart(3, '0')}
                            </TableCell>
                            <TableCell>{item.contact?.full_name || 'N/A'}</TableCell>
                            <TableCell>
                              {triggerType === 'before_expiry' 
                                ? item.valid_until && format(parseISO(item.valid_until), 'dd/MM/yyyy')
                                : item.created_at && format(parseISO(item.created_at), 'dd/MM/yyyy')
                              }
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {triggerType === 'before_expiry' 
                                  ? `${item.triggerDay} dia${item.triggerDay !== 1 ? 's' : ''} antes`
                                  : `${item.triggerDay} dia${item.triggerDay !== 1 ? 's' : ''} após`
                                }
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {item.scheduledDate && (
                                <div className="flex items-center gap-1 text-sm">
                                  <Clock className="h-3 w-3" />
                                  {format(item.scheduledDate, 'dd/MM')} às {sendTimes[0] || '09:00'}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => sendNowMutation.mutate(item.id)}
                                    disabled={sendNowMutation.isPending}
                                    className="h-8 w-8 text-primary hover:bg-primary/10"
                                  >
                                    {sendNowMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Send className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Enviar notificação agora</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <CardContent className="p-0">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !notificationHistory?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma notificação no histórico</p>
                    <p className="text-sm">Notificações enviadas aparecerão aqui</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Orçamento</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Detalhes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notificationHistory.map(notif => (
                          <TableRow key={notif.id}>
                            <TableCell className="font-medium">
                              {notif.quote ? `ORC-${String((notif.quote as any).quote_number).padStart(3, '0')}` : '-'}
                            </TableCell>
                            <TableCell>
                              {notif.contact ? (notif.contact as any).full_name : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {notif.notification_type?.replace(/_/g, ' ') || 'N/A'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(notif.status || 'pending', notif.cancel_reason)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {notif.sent_at 
                                ? format(parseISO(notif.sent_at), 'dd/MM HH:mm')
                                : notif.cancelled_at
                                ? format(parseISO(notif.cancelled_at), 'dd/MM HH:mm')
                                : format(parseISO(notif.created_at || ''), 'dd/MM HH:mm')
                              }
                            </TableCell>
                            <TableCell className="text-sm">
                              {notif.error_message && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Badge variant="destructive" className="text-xs cursor-help">
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                      Erro
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <p>{notif.error_message}</p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                              {notif.cancel_reason && (
                                <span className="text-muted-foreground text-xs">
                                  {getCancelReasonText(notif.cancel_reason)}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </TabsContent>
          </Tabs>
        </CardHeader>
      </Card>
    </div>
  );
}
