import { useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bell, 
  Settings, 
  Clock, 
  Calendar, 
  Send, 
  RefreshCw, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  MessageSquare,
  Loader2,
  Save
} from 'lucide-react';
import { format, addDays, differenceInDays, parseISO, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuoteNotificationConfig, useUpdateQuoteNotificationConfig } from '@/hooks/useQuoteNotificationConfig';
import { useChannels } from '@/hooks/useChannels';
import { useQuotes } from '@/hooks/useQuotes';
import { toast } from 'sonner';

const SEND_TIME_OPTIONS = [
  { value: '08:00', label: '08:00' },
  { value: '09:00', label: '09:00' },
  { value: '10:00', label: '10:00' },
  { value: '11:00', label: '11:00' },
  { value: '12:00', label: '12:00' },
  { value: '14:00', label: '14:00' },
  { value: '15:00', label: '15:00' },
  { value: '16:00', label: '16:00' },
  { value: '17:00', label: '17:00' },
  { value: '18:00', label: '18:00' },
];

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
  const [enabled, setEnabled] = useState(config?.quote_expiration_enabled ?? false);
  const [useClientChannel, setUseClientChannel] = useState((config as any)?.use_client_channel ?? true);
  const [channelId, setChannelId] = useState(config?.notification_channel_id ?? '');
  const [sendTime, setSendTime] = useState(config?.notification_send_time ?? '09:00');
  const [dailyLimit, setDailyLimit] = useState(config?.daily_limit ?? 50);
  const [minIntervalHours, setMinIntervalHours] = useState(config?.min_interval_hours ?? 24);
  const [pauseOnWeekends, setPauseOnWeekends] = useState(config?.pause_on_weekends ?? false);
  const [expirationDays, setExpirationDays] = useState<number[]>(config?.quote_expiration_days ?? [3, 1]);
  const [template, setTemplate] = useState(config?.quote_expiration_template ?? DEFAULT_TEMPLATE);

  // Update local state when config loads
  useState(() => {
    if (config) {
      setEnabled(config.quote_expiration_enabled);
      setUseClientChannel((config as any).use_client_channel ?? true);
      setChannelId(config.notification_channel_id ?? '');
      setSendTime((config as any).notification_send_time ?? '09:00');
      setDailyLimit((config as any).daily_limit ?? 50);
      setMinIntervalHours((config as any).min_interval_hours ?? 24);
      setPauseOnWeekends((config as any).pause_on_weekends ?? false);
      setExpirationDays(config.quote_expiration_days ?? [3, 1]);
      setTemplate(config.quote_expiration_template ?? DEFAULT_TEMPLATE);
    }
  });

  const handleDayToggle = (day: number) => {
    if (expirationDays.includes(day)) {
      setExpirationDays(expirationDays.filter(d => d !== day));
    } else {
      setExpirationDays([...expirationDays, day].sort((a, b) => b - a));
    }
  };

  const handleSaveConfig = () => {
    updateConfig({
      quote_expiration_enabled: enabled,
      use_client_channel: useClientChannel,
      notification_channel_id: channelId || null,
      notification_send_time: sendTime,
      daily_limit: dailyLimit,
      min_interval_hours: minIntervalHours,
      pause_on_weekends: pauseOnWeekends,
      quote_expiration_days: expirationDays,
      quote_expiration_template: template,
    } as any);
  };

  // Calculate upcoming notifications
  const upcomingNotifications = quotes?.filter(quote => {
    if (!['sent', 'approved'].includes(quote.status)) return false;
    if (!quote.valid_until) return false;
    
    const validUntil = parseISO(quote.valid_until);
    const daysUntilExpiry = differenceInDays(validUntil, new Date());
    
    return daysUntilExpiry >= 0 && daysUntilExpiry <= Math.max(...(expirationDays.length > 0 ? expirationDays : [3]));
  }).map(quote => {
    const validUntil = parseISO(quote.valid_until!);
    const daysUntilExpiry = differenceInDays(validUntil, new Date());
    const nextNotificationDay = expirationDays.find(d => d <= daysUntilExpiry);
    
    return {
      ...quote,
      daysUntilExpiry,
      nextNotificationDay,
      scheduledDate: nextNotificationDay !== undefined 
        ? addDays(new Date(), daysUntilExpiry - nextNotificationDay) 
        : null,
    };
  }).filter(q => q.nextNotificationDay !== undefined) || [];

  // Mock notification history (would come from useQuoteNotificationHistory)
  const notificationHistory = [
    {
      id: '1',
      created_at: new Date().toISOString(),
      quote_number: 'ORC-001',
      contact_name: 'João Silva',
      contact_phone: '5511999999999',
      days_before: 3,
      status: 'sent',
    },
    {
      id: '2',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      quote_number: 'ORC-002',
      contact_name: 'Maria Santos',
      contact_phone: '5511888888888',
      days_before: 1,
      status: 'failed',
      error_message: 'Número inválido',
    },
  ];

  const connectedChannels = channels?.filter(c => c.status === 'connected') || [];

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações de Notificação
          </CardTitle>
          <CardDescription>
            Configure como e quando os clientes serão notificados sobre orçamentos próximos do vencimento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Switch */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Ativar notificações automáticas</Label>
              <p className="text-sm text-muted-foreground">
                Enviar lembretes por WhatsApp quando orçamentos estiverem próximos do vencimento
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

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
                      O sistema identifica automaticamente o canal da última conversa do cliente e envia a notificação pelo mesmo canal.
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
                  <p className="text-xs text-muted-foreground">
                    {useClientChannel 
                      ? 'Usado apenas se o cliente não tiver conversa anterior' 
                      : 'Todas as notificações serão enviadas por este canal'}
                  </p>
                </div>
              </div>

              {/* Time and Limit Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Horário de Envio</Label>
                  <Select value={sendTime} onValueChange={setSendTime}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEND_TIME_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Limite Diário</Label>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={dailyLimit}
                    onChange={e => setDailyLimit(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Máximo de notificações enviadas por dia
                  </p>
                </div>
              </div>

              {/* Advanced Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Intervalo mínimo entre notificações (horas)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    value={minIntervalHours}
                    onChange={e => setMinIntervalHours(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Evita enviar múltiplas notificações em curto período
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label>Pausar nos fins de semana</Label>
                    <p className="text-xs text-muted-foreground">
                      Não enviar notificações aos sábados e domingos
                    </p>
                  </div>
                  <Switch
                    checked={pauseOnWeekends}
                    onCheckedChange={setPauseOnWeekends}
                  />
                </div>
              </div>

              {/* Notification Days */}
              <div className="space-y-3">
                <Label>Quando notificar (dias antes do vencimento)</Label>
                <div className="flex flex-wrap gap-2">
                  {[7, 5, 3, 2, 1, 0].map(day => (
                    <div
                      key={day}
                      className={`flex items-center gap-2 px-4 py-2 border rounded-lg cursor-pointer transition-colors ${
                        expirationDays.includes(day) 
                          ? 'bg-primary text-primary-foreground border-primary' 
                          : 'hover:bg-muted'
                      }`}
                      onClick={() => handleDayToggle(day)}
                    >
                      <Checkbox 
                        checked={expirationDays.includes(day)} 
                        onCheckedChange={() => handleDayToggle(day)}
                      />
                      <span>{day === 0 ? 'No dia' : `${day} dia${day > 1 ? 's' : ''}`}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Message Template */}
              <div className="space-y-3">
                <Label>Modelo da Mensagem</Label>
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
              </div>

              {/* Preview */}
              <div className="p-4 bg-muted rounded-lg">
                <Label className="text-sm text-muted-foreground mb-2 block">Prévia da mensagem</Label>
                <div className="bg-background p-3 rounded-lg border whitespace-pre-wrap text-sm">
                  {template
                    .replace('{cliente_nome}', 'João Silva')
                    .replace('{numero}', 'ORC-001')
                    .replace('{valor}', 'R$ 1.500,00')
                    .replace('{dias_restantes}', '3 dias')
                    .replace('{data_validade}', format(addDays(new Date(), 3), 'dd/MM/yyyy'))}
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
      </Card>

      {/* Upcoming Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Próximas Notificações
              </CardTitle>
              <CardDescription>
                Orçamentos que receberão notificação nos próximos dias
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-lg">
              {upcomingNotifications.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {upcomingNotifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma notificação agendada</p>
              <p className="text-sm">Orçamentos enviados aparecerão aqui quando estiverem próximos do vencimento</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Orçamento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Validade</TableHead>
                    <TableHead>Dias Restantes</TableHead>
                    <TableHead>Próximo Envio</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingNotifications.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        ORC-{String(item.quote_number).padStart(3, '0')}
                      </TableCell>
                      <TableCell>{item.contact?.full_name || 'N/A'}</TableCell>
                      <TableCell>
                        {item.valid_until && format(parseISO(item.valid_until), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.daysUntilExpiry <= 1 ? 'destructive' : 'secondary'}>
                          {item.daysUntilExpiry} dia{item.daysUntilExpiry !== 1 ? 's' : ''}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {item.scheduledDate && (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {format(item.scheduledDate, 'dd/MM')} {sendTime}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Agendado
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Notification History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Histórico de Notificações
              </CardTitle>
              <CardDescription>
                Registro de todas as notificações enviadas
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {notificationHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma notificação enviada ainda</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Orçamento</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notificationHistory.map(notification => (
                    <TableRow key={notification.id}>
                      <TableCell className="text-sm">
                        {format(parseISO(notification.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {notification.quote_number}
                      </TableCell>
                      <TableCell>{notification.contact_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {notification.contact_phone}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {notification.days_before === 0 
                            ? 'No dia' 
                            : `${notification.days_before} dia${notification.days_before > 1 ? 's' : ''} antes`}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {notification.status === 'sent' ? (
                          <Badge variant="default" className="bg-green-500 gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Enviado
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <XCircle className="h-3 w-3" />
                            Falhou
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {notification.status === 'failed' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8"
                              onClick={() => toast.info('Reenviando notificação...')}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
