import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
  Ban,
  Pause,
  Play,
  Trash2,
  CalendarDays,
  RefreshCw
} from 'lucide-react';
import { format, addDays, differenceInDays, parseISO, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useQuoteNotificationConfig, useUpdateQuoteNotificationConfig } from '@/hooks/useQuoteNotificationConfig';
import { useChannels } from '@/hooks/useChannels';
import { useQuotes } from '@/hooks/useQuotes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: config, isLoading: configLoading } = useQuoteNotificationConfig();
  const { mutate: updateConfig, isPending: updating } = useUpdateQuoteNotificationConfig();
  const { data: channels } = useChannels();
  const { data: quotes } = useQuotes();
  
  // State for reschedule popover
  const [rescheduleOpen, setRescheduleOpen] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>();
  const [rescheduleTime, setRescheduleTime] = useState('09:00');

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

  // Fetch pending notifications from database
  const { data: pendingNotifications, isLoading: pendingLoading, refetch: refetchPending } = useQuery({
    queryKey: ['pending-quote-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_expiration_notifications')
        .select(`
          *,
          quote:quotes(id, quote_number, total, valid_until, created_at, status),
          contact:contacts(id, full_name, phone)
        `)
        .eq('status', 'pending')
        .order('scheduled_for', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Calculate upcoming notifications (dynamic + database)
  const configuredDays = triggerType === 'before_expiry' ? expirationDays : daysAfterSent;
  
  // Combine database pending notifications with dynamically calculated ones
  const upcomingNotifications = (() => {
    // If we have database notifications, show those
    if (pendingNotifications && pendingNotifications.length > 0) {
      return pendingNotifications.map(notif => ({
        id: notif.id,
        quoteId: notif.quote_id,
        quote_number: (notif.quote as any)?.quote_number,
        contact: notif.contact,
        valid_until: (notif.quote as any)?.valid_until,
        created_at: (notif.quote as any)?.created_at,
        triggerDay: notif.days_before,
        scheduledDate: notif.scheduled_for ? parseISO(notif.scheduled_for) : null,
        notificationKey: notif.id,
        paused: notif.paused || false,
        fromDatabase: true,
      }));
    }
    
    // Otherwise, calculate dynamically from quotes
    return quotes?.flatMap(quote => {
      if (!['sent', 'approved'].includes(quote.status)) return [];
      
      if (triggerType === 'before_expiry') {
        if (!quote.valid_until) return [];
        const validUntil = parseISO(quote.valid_until);
        const daysUntilExpiry = differenceInDays(validUntil, new Date());
        
        return expirationDays
          .filter(day => day <= daysUntilExpiry)
          .map(day => ({
            id: null as string | null,
            quoteId: quote.id,
            quote_number: quote.quote_number,
            contact: quote.contact,
            valid_until: quote.valid_until,
            created_at: quote.created_at,
            triggerDay: day,
            scheduledDate: addDays(new Date(), daysUntilExpiry - day),
            notificationKey: `${quote.id}-${day}`,
            paused: false,
            fromDatabase: false,
          }));
      } else {
        if (!quote.created_at) return [];
        const sentDate = parseISO(quote.created_at);
        const daysSinceSent = differenceInDays(new Date(), sentDate);
        
        return daysAfterSent
          .filter(day => day > daysSinceSent)
          .map(day => ({
            id: null as string | null,
            quoteId: quote.id,
            quote_number: quote.quote_number,
            contact: quote.contact,
            valid_until: quote.valid_until,
            created_at: quote.created_at,
            triggerDay: day,
            scheduledDate: addDays(sentDate, day),
            notificationKey: `${quote.id}-${day}`,
            paused: false,
            fromDatabase: false,
          }));
      }
    }).sort((a, b) => {
      if (!a.scheduledDate || !b.scheduledDate) return 0;
      return a.scheduledDate.getTime() - b.scheduledDate.getTime();
    }) || [];
  })();

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

  // Toggle pause mutation
  const togglePauseMutation = useMutation({
    mutationFn: async ({ notificationId, isPaused }: { notificationId: string; isPaused: boolean }) => {
      const { error } = await supabase
        .from('quote_expiration_notifications')
        .update({
          paused: !isPaused,
          paused_at: !isPaused ? new Date().toISOString() : null,
          paused_by: !isPaused ? user?.id : null,
        })
        .eq('id', notificationId);
      
      if (error) throw error;
    },
    onSuccess: (_, { isPaused }) => {
      toast.success(isPaused ? 'Notificação retomada!' : 'Notificação pausada!');
      refetchPending();
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar notificação: ' + (error.message || 'Erro desconhecido'));
    }
  });

  // Reschedule mutation
  const rescheduleMutation = useMutation({
    mutationFn: async ({ notificationId, newDate }: { notificationId: string; newDate: Date }) => {
      const { error } = await supabase
        .from('quote_expiration_notifications')
        .update({
          scheduled_for: newDate.toISOString(),
        })
        .eq('id', notificationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Data da notificação alterada!');
      setRescheduleOpen(null);
      setRescheduleDate(undefined);
      refetchPending();
    },
    onError: (error: any) => {
      toast.error('Erro ao reagendar: ' + (error.message || 'Erro desconhecido'));
    }
  });

  // Delete (cancel) mutation
  const deleteMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from('quote_expiration_notifications')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: user?.id,
          cancel_reason: 'manual',
        })
        .eq('id', notificationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Notificação excluída!');
      refetchPending();
      queryClient.invalidateQueries({ queryKey: ['quote-notification-history'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir: ' + (error.message || 'Erro desconhecido'));
    }
  });

  // Create database record for a notification that doesn't exist yet
  const createNotificationRecord = useMutation({
    mutationFn: async ({ quoteId, triggerDay, scheduledDate }: { quoteId: string; triggerDay: number; scheduledDate: Date }) => {
      // Check if record already exists
      const { data: existing } = await supabase
        .from('quote_expiration_notifications')
        .select('id')
        .eq('quote_id', quoteId)
        .eq('days_before', triggerDay)
        .eq('status', 'pending')
        .maybeSingle();
      
      if (existing) {
        return existing;
      }

      // Get quote and contact info
      const quote = quotes?.find(q => q.id === quoteId);
      if (!quote) throw new Error('Orçamento não encontrado');

      const { data, error } = await supabase
        .from('quote_expiration_notifications')
        .insert({
          quote_id: quoteId,
          contact_id: quote.contact_id,
          days_before: triggerDay,
          scheduled_for: scheduledDate.toISOString(),
          status: 'pending',
          paused: false,
          notification_type: triggerType === 'before_expiry' ? 'expiration' : 'followup',
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      refetchPending();
    },
    onError: (error: any) => {
      toast.error('Erro ao criar registro: ' + (error.message || 'Erro desconhecido'));
    }
  });

  // Sync all pending notifications - create database records for all calculated notifications
  const syncNotificationsMutation = useMutation({
    mutationFn: async () => {
      const sentQuotes = quotes?.filter(q => ['sent', 'approved'].includes(q.status)) || [];
      const recordsToCreate: Array<{ quote_id: string; contact_id: string; days_before: number; scheduled_for: string }> = [];
      
      for (const quote of sentQuotes) {
        const daysToUse = triggerType === 'before_expiry' ? expirationDays : daysAfterSent;
        
        for (const day of daysToUse) {
          let scheduledDate: Date;
          
          if (triggerType === 'before_expiry') {
            if (!quote.valid_until) continue;
            const validUntil = parseISO(quote.valid_until);
            const daysUntilExpiry = differenceInDays(validUntil, new Date());
            if (day > daysUntilExpiry) continue;
            scheduledDate = addDays(new Date(), daysUntilExpiry - day);
          } else {
            if (!quote.created_at) continue;
            const sentDate = parseISO(quote.created_at);
            const daysSinceSent = differenceInDays(new Date(), sentDate);
            if (day <= daysSinceSent) continue;
            scheduledDate = addDays(sentDate, day);
          }

          // Set default time
          const [hours, minutes] = (sendTimes[0] || '09:00').split(':').map(Number);
          scheduledDate = setMinutes(setHours(scheduledDate, hours), minutes);

          recordsToCreate.push({
            quote_id: quote.id,
            contact_id: quote.contact_id,
            days_before: day,
            scheduled_for: scheduledDate.toISOString(),
          });
        }
      }

      if (recordsToCreate.length === 0) {
        return { created: 0 };
      }

      // Upsert to avoid duplicates
      let created = 0;
      for (const record of recordsToCreate) {
        const { data: existing } = await supabase
          .from('quote_expiration_notifications')
          .select('id')
          .eq('quote_id', record.quote_id)
          .eq('days_before', record.days_before)
          .eq('status', 'pending')
          .maybeSingle();
        
        if (!existing) {
          const { error } = await supabase
            .from('quote_expiration_notifications')
            .insert({
              quote_id: record.quote_id,
              contact_id: record.contact_id,
              days_before: record.days_before,
              scheduled_for: record.scheduled_for,
              status: 'pending',
              paused: false,
              notification_type: triggerType === 'before_expiry' ? 'expiration' : 'followup',
            });
          
          if (!error) created++;
        }
      }

      return { created };
    },
    onSuccess: (data) => {
      if (data.created > 0) {
        toast.success(`${data.created} notificação(ões) sincronizada(s)!`);
      } else {
        toast.info('Todas as notificações já estão sincronizadas');
      }
      refetchPending();
    },
    onError: (error: any) => {
      toast.error('Erro ao sincronizar: ' + (error.message || 'Erro desconhecido'));
    }
  });

  // Ensure record exists and return its ID (for actions on non-database items)
  const ensureRecordExists = async (item: typeof upcomingNotifications[0]): Promise<string | null> => {
    if (item.fromDatabase && item.id) {
      return item.id;
    }

    if (!item.scheduledDate) return null;

    try {
      const result = await createNotificationRecord.mutateAsync({
        quoteId: item.quoteId,
        triggerDay: item.triggerDay,
        scheduledDate: item.scheduledDate,
      });
      return result?.id || null;
    } catch {
      return null;
    }
  };

  const handleReschedule = (notificationId: string) => {
    if (!rescheduleDate) return;
    
    const [hours, minutes] = rescheduleTime.split(':').map(Number);
    const newDate = setMinutes(setHours(rescheduleDate, hours), minutes);
    
    rescheduleMutation.mutate({ notificationId, newDate });
  };

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
      <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CollapsibleTrigger asChild>
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
        </Card>
      </Collapsible>

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
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => syncNotificationsMutation.mutate()}
                disabled={syncNotificationsMutation.isPending}
              >
                {syncNotificationsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sincronizar
              </Button>
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
                          <TableRow 
                            key={item.notificationKey}
                            className={item.paused ? 'opacity-50' : ''}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                ORC-{String(item.quote_number).padStart(3, '0')}
                                {item.paused && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Pause className="h-3 w-3 mr-1" />
                                    Pausado
                                  </Badge>
                                )}
                              </div>
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
                                  {format(item.scheduledDate, 'dd/MM HH:mm')}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {/* Alterar Data */}
                                <Popover 
                                  open={rescheduleOpen === item.notificationKey} 
                                  onOpenChange={async (open) => {
                                    if (open) {
                                      setRescheduleOpen(item.notificationKey);
                                      if (item.scheduledDate) {
                                        setRescheduleDate(item.scheduledDate);
                                        setRescheduleTime(format(item.scheduledDate, 'HH:mm'));
                                      }
                                    } else {
                                      setRescheduleOpen(null);
                                    }
                                  }}
                                >
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                          <CalendarDays className="h-4 w-4" />
                                        </Button>
                                      </PopoverTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Alterar data</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <PopoverContent className="w-auto p-0" align="end">
                                    <div className="p-3 space-y-3">
                                      <CalendarComponent
                                        mode="single"
                                        selected={rescheduleDate}
                                        onSelect={setRescheduleDate}
                                        locale={ptBR}
                                        disabled={(date) => date < new Date()}
                                      />
                                      <div className="flex items-center gap-2">
                                        <Label className="text-sm">Horário:</Label>
                                        <Select value={rescheduleTime} onValueChange={setRescheduleTime}>
                                          <SelectTrigger className="w-24">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {SEND_TIME_OPTIONS.map(time => (
                                              <SelectItem key={time} value={time}>{time}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <Button 
                                        className="w-full" 
                                        size="sm"
                                        onClick={async () => {
                                          const recordId = item.fromDatabase && item.id ? item.id : await ensureRecordExists(item);
                                          if (recordId) handleReschedule(recordId);
                                        }}
                                        disabled={!rescheduleDate || rescheduleMutation.isPending || createNotificationRecord.isPending}
                                      >
                                        {(rescheduleMutation.isPending || createNotificationRecord.isPending) ? (
                                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : null}
                                        Salvar
                                      </Button>
                                    </div>
                                  </PopoverContent>
                                </Popover>

                                {/* Pausar/Retomar */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={async () => {
                                        const recordId = item.fromDatabase && item.id ? item.id : await ensureRecordExists(item);
                                        if (recordId) {
                                          togglePauseMutation.mutate({ notificationId: recordId, isPaused: item.paused });
                                        }
                                      }}
                                      disabled={togglePauseMutation.isPending || createNotificationRecord.isPending}
                                      className="h-8 w-8"
                                    >
                                      {item.paused ? (
                                        <Play className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <Pause className="h-4 w-4 text-amber-500" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{item.paused ? 'Retomar' : 'Pausar'}</p>
                                  </TooltipContent>
                                </Tooltip>

                                {/* Excluir */}
                                <AlertDialog>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Excluir notificação</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir Notificação</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja excluir esta notificação agendada? Esta ação não pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={async () => {
                                          const recordId = item.fromDatabase && item.id ? item.id : await ensureRecordExists(item);
                                          if (recordId) deleteMutation.mutate(recordId);
                                        }}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>

                                {/* Enviar Agora */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => sendNowMutation.mutate(item.quoteId)}
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
                                    <p>Enviar agora</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
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
