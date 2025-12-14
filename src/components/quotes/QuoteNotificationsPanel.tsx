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
  RefreshCw,
  X,
  MessageCircle,
  BellOff
} from 'lucide-react';
import { format, addDays, differenceInDays, parseISO, setHours, setMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useQuoteNotificationConfig, useUpdateQuoteNotificationConfig } from '@/hooks/useQuoteNotificationConfig';
import { useChannels } from '@/hooks/useChannels';
import { useQuotes } from '@/hooks/useQuotes';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentTenantId } from '@/hooks/useTenant';

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
  const { data: tenantId } = useCurrentTenantId();
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

  // Bulk selection for notifications
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

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
          quote:quotes(id, quote_number, total, valid_until, created_at, status, seller_id, notifications_paused, notifications_auto_paused, notifications_auto_pause_reason, seller:profiles!seller_id(id, full_name)),
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
    // Map database notifications by quote_id + days_before for quick lookup
    const dbNotificationsMap = new Map<string, typeof pendingNotifications[0]>();
    if (pendingNotifications) {
      pendingNotifications.forEach(notif => {
        const key = `${notif.quote_id}-${notif.days_before}`;
        dbNotificationsMap.set(key, notif);
      });
    }

    // Calculate all expected notifications from quotes
    let notificationIndex = 0;
    const allNotifications = quotes?.flatMap(quote => {
      if (!['sent', 'approved'].includes(quote.status)) return [];
      
      // Don't generate dynamic notifications for auto-paused quotes (client responded)
      if ((quote as any).notifications_auto_paused) return [];
      
      if (triggerType === 'before_expiry') {
        if (!quote.valid_until) return [];
        const validUntil = parseISO(quote.valid_until);
        const daysUntilExpiry = differenceInDays(validUntil, new Date());
        
        return expirationDays
          .filter(day => day <= daysUntilExpiry)
          .map(day => {
            const dbKey = `${quote.id}-${day}`;
            const dbNotif = dbNotificationsMap.get(dbKey);
            
            // If exists in database, use database version
            if (dbNotif) {
              dbNotificationsMap.delete(dbKey); // Mark as used
              return {
                id: dbNotif.id,
                quoteId: dbNotif.quote_id,
                quote_number: (dbNotif.quote as any)?.quote_number,
                contact: dbNotif.contact,
                seller: (dbNotif.quote as any)?.seller,
                valid_until: (dbNotif.quote as any)?.valid_until,
                created_at: (dbNotif.quote as any)?.created_at,
                triggerDay: dbNotif.days_before,
                scheduledDate: dbNotif.scheduled_for ? parseISO(dbNotif.scheduled_for) : null,
                notificationKey: dbNotif.id,
                paused: dbNotif.paused || false,
                fromDatabase: true,
                quoteNotificationsPaused: (dbNotif.quote as any)?.notifications_paused || false,
                quoteAutoNotificationsPaused: (dbNotif.quote as any)?.notifications_auto_paused || false,
                quoteAutoPauseReason: (dbNotif.quote as any)?.notifications_auto_pause_reason || null,
              };
            }
            
            // Otherwise, calculate dynamically
            const timeIndex = notificationIndex % sendTimes.length;
            const timeToUse = sendTimes[timeIndex] || '09:00';
            const [hours, minutes] = timeToUse.split(':').map(Number);
            notificationIndex++;
            
            const baseDate = addDays(new Date(), daysUntilExpiry - day);
            const scheduledDate = new Date(
              baseDate.getFullYear(),
              baseDate.getMonth(),
              baseDate.getDate(),
              hours,
              minutes,
              0
            );
            
            return {
              id: null as string | null,
              quoteId: quote.id,
              quote_number: quote.quote_number,
              contact: quote.contact,
              seller: quote.seller,
              valid_until: quote.valid_until,
              created_at: quote.created_at,
              triggerDay: day,
              scheduledDate,
              notificationKey: `${quote.id}-${day}`,
              paused: false,
              fromDatabase: false,
              quoteNotificationsPaused: (quote as any).notifications_paused || false,
              quoteAutoNotificationsPaused: (quote as any).notifications_auto_paused || false,
              quoteAutoPauseReason: (quote as any).notifications_auto_pause_reason || null,
            };
          });
      } else {
        if (!quote.created_at) return [];
        const sentDate = parseISO(quote.created_at);
        const daysSinceSent = differenceInDays(new Date(), sentDate);
        
        return daysAfterSent
          .filter(day => day > daysSinceSent)
          .map(day => {
            const dbKey = `${quote.id}-${day}`;
            const dbNotif = dbNotificationsMap.get(dbKey);
            
            // If exists in database, use database version
            if (dbNotif) {
              dbNotificationsMap.delete(dbKey); // Mark as used
              return {
                id: dbNotif.id,
                quoteId: dbNotif.quote_id,
                quote_number: (dbNotif.quote as any)?.quote_number,
                contact: dbNotif.contact,
                seller: (dbNotif.quote as any)?.seller,
                valid_until: (dbNotif.quote as any)?.valid_until,
                created_at: (dbNotif.quote as any)?.created_at,
                triggerDay: dbNotif.days_before,
                scheduledDate: dbNotif.scheduled_for ? parseISO(dbNotif.scheduled_for) : null,
                notificationKey: dbNotif.id,
                paused: dbNotif.paused || false,
                fromDatabase: true,
                quoteNotificationsPaused: (dbNotif.quote as any)?.notifications_paused || false,
                quoteAutoNotificationsPaused: (dbNotif.quote as any)?.notifications_auto_paused || false,
                quoteAutoPauseReason: (dbNotif.quote as any)?.notifications_auto_pause_reason || null,
              };
            }
            
            // Otherwise, calculate dynamically
            const timeIndex = notificationIndex % sendTimes.length;
            const timeToUse = sendTimes[timeIndex] || '09:00';
            const [hours, minutes] = timeToUse.split(':').map(Number);
            notificationIndex++;
            
            const baseDate = addDays(sentDate, day);
            const scheduledDate = new Date(
              baseDate.getFullYear(),
              baseDate.getMonth(),
              baseDate.getDate(),
              hours,
              minutes,
              0
            );
            
            return {
              id: null as string | null,
              quoteId: quote.id,
              quote_number: quote.quote_number,
              contact: quote.contact,
              seller: quote.seller,
              valid_until: quote.valid_until,
              created_at: quote.created_at,
              triggerDay: day,
              scheduledDate,
              notificationKey: `${quote.id}-${day}`,
              paused: false,
              fromDatabase: false,
              quoteNotificationsPaused: (quote as any).notifications_paused || false,
              quoteAutoNotificationsPaused: (quote as any).notifications_auto_paused || false,
              quoteAutoPauseReason: (quote as any).notifications_auto_pause_reason || null,
            };
          });
      }
    }) || [];

    return allNotifications.sort((a, b) => {
      if (!a.scheduledDate || !b.scheduledDate) return 0;
      return a.scheduledDate.getTime() - b.scheduledDate.getTime();
    });
  })();

  const connectedChannels = channels?.filter(c => c.status === 'connected') || [];

  // Helper function to get notification status badge
  const getNotificationStatusBadge = (item: typeof upcomingNotifications[0]) => {
    // Auto-paused because client responded
    if (item.quoteAutoNotificationsPaused) {
      if (item.quoteAutoPauseReason === 'client_responded') {
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700">
            <MessageCircle className="h-3 w-3 mr-1" />
            Cliente respondeu
          </Badge>
        );
      }
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600">
          <BellOff className="h-3 w-3 mr-1" />
          Auto-pausado
        </Badge>
      );
    }
    
    // Manually paused (at quote level or notification level)
    if (item.quoteNotificationsPaused || item.paused) {
      return (
        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700">
          <Pause className="h-3 w-3 mr-1" />
          Pausado
        </Badge>
      );
    }
    
    // Active
    return (
      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
        <Bell className="h-3 w-3 mr-1" />
        Ativo
      </Badge>
    );
  };

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
    mutationFn: async ({ quoteId, notificationId, item }: { 
      quoteId: string; 
      notificationId: string | null; 
      item: typeof upcomingNotifications[0] 
    }) => {
      // Enviar via edge function
      const response = await supabase.functions.invoke('check-expiring-quotes', {
        body: { manualQuoteId: quoteId }
      });
      if (response.error) throw response.error;

      // Cancel all pending followup notifications for this quote (manual send takes priority)
      await supabase
        .from('quote_expiration_notifications')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancel_reason: 'manual_sent'
        })
        .eq('quote_id', quoteId)
        .eq('status', 'pending');

      // Create a record for the manual send
      const quote = quotes?.find(q => q.id === quoteId);
      if (quote) {
        await supabase
          .from('quote_expiration_notifications')
          .insert({
            tenant_id: tenantId,
            quote_id: quoteId,
            contact_id: quote.contact_id,
            days_before: item?.triggerDay || 0,
            scheduled_for: new Date().toISOString(),
            status: 'sent',
            sent_at: new Date().toISOString(),
            notification_type: 'manual',
          });
      }
      
      return response.data;
    },
    onSuccess: () => {
      toast.success('Notificação enviada com sucesso!');
      refetchPending();
      queryClient.invalidateQueries({ queryKey: ['quote-notification-history'] });
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

  // Bulk selection handlers - use notificationKey for all items (works for both database and dynamic)
  const handleSelectAllNotifications = () => {
    if (selectedNotifications.length === upcomingNotifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(upcomingNotifications.map(n => n.notificationKey));
    }
  };

  const handleSelectOneNotification = (key: string) => {
    setSelectedNotifications(prev => 
      prev.includes(key) 
        ? prev.filter(x => x !== key) 
        : [...prev, key]
    );
  };

  const handleBulkDeleteNotifications = async () => {
    // Capture all notifications to delete BEFORE starting
    const notificationsToDelete = selectedNotifications
      .map(key => upcomingNotifications.find(n => n.notificationKey === key))
      .filter(Boolean);

    let deleted = 0;
    
    for (const notification of notificationsToDelete) {
      if (!notification) continue;
      
      try {
        if (notification.id) {
          // Notification exists in database - update status to cancelled
          await supabase
            .from('quote_expiration_notifications')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
              cancelled_by: user?.id,
              cancel_reason: 'bulk_delete',
            })
            .eq('id', notification.id);
          deleted++;
        } else {
          // Dynamic notification - create record as cancelled
          const quote = quotes?.find(q => q.id === notification.quoteId);
          if (quote) {
            await supabase
              .from('quote_expiration_notifications')
              .insert({
                quote_id: notification.quoteId,
                contact_id: quote.contact_id,
                channel_id: channelId || null,
                days_before: notification.triggerDay,
                scheduled_for: notification.scheduledDate?.toISOString(),
                message_template: template,
                notification_type: triggerType === 'before_expiry' ? 'before_expiry' : 'after_sent',
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancelled_by: user?.id,
                cancel_reason: 'bulk_delete',
              });
            deleted++;
          }
        }
      } catch (e) {
        console.error('Error deleting notification', notification.notificationKey, e);
      }
    }
    
    // Clear selection and update data ONLY at the end
    setSelectedNotifications([]);
    setShowBulkDeleteDialog(false);
    
    // Refetch only once after all deletions
    refetchPending();
    queryClient.invalidateQueries({ queryKey: ['quote-notification-history'] });
    
    toast.success(`${deleted} notificação(ões) excluída(s)`);
  };

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

      // Use first configured time or default to 09:00
      const timeToUse = sendTimes[0] || '09:00';
      const [hours, minutes] = timeToUse.split(':').map(Number);
      
      // Create date with explicit local time
      const scheduledDateTime = new Date(
        scheduledDate.getFullYear(),
        scheduledDate.getMonth(),
        scheduledDate.getDate(),
        hours,
        minutes,
        0
      );

      const { data, error } = await supabase
        .from('quote_expiration_notifications')
        .insert({
          tenant_id: tenantId,
          quote_id: quoteId,
          contact_id: quote.contact_id,
          days_before: triggerDay,
          scheduled_for: scheduledDateTime.toISOString(),
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
          let baseScheduledDate: Date;
          
          if (triggerType === 'before_expiry') {
            if (!quote.valid_until) continue;
            const validUntil = parseISO(quote.valid_until);
            const daysUntilExpiry = differenceInDays(validUntil, new Date());
            if (day > daysUntilExpiry) continue;
            baseScheduledDate = addDays(new Date(), daysUntilExpiry - day);
          } else {
            if (!quote.created_at) continue;
            const sentDate = parseISO(quote.created_at);
            const daysSinceSent = differenceInDays(new Date(), sentDate);
            if (day <= daysSinceSent) continue;
            baseScheduledDate = addDays(sentDate, day);
          }

          // Distribute times among configured send times
          const timeIndex = recordsToCreate.length % sendTimes.length;
          const timeToUse = sendTimes[timeIndex] || '09:00';
          const [hours, minutes] = timeToUse.split(':').map(Number);
          
          // Create date with explicit local time (avoiding timezone issues)
          const scheduledDateTime = new Date(
            baseScheduledDate.getFullYear(),
            baseScheduledDate.getMonth(),
            baseScheduledDate.getDate(),
            hours,
            minutes,
            0
          );

          recordsToCreate.push({
            quote_id: quote.id,
            contact_id: quote.contact_id,
            days_before: day,
            scheduled_for: scheduledDateTime.toISOString(),
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
              tenant_id: tenantId,
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
      case 'manual_sent': return 'Envio manual';
      case 'manual_override': return 'Substituído';
      default: return reason || 'Motivo não especificado';
    }
  };

  const getCancelReasonBadge = (reason: string | null | undefined) => {
    switch (reason) {
      case 'client_responded':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
            <MessageCircle className="h-3 w-3 mr-1" />
            Cliente respondeu
          </Badge>
        );
      case 'quote_converted':
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Convertido
          </Badge>
        );
      case 'quote_status_changed':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
            <RefreshCw className="h-3 w-3 mr-1" />
            Status alterado
          </Badge>
        );
      case 'manual':
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/50 dark:text-gray-300 dark:border-gray-700">
            <Pause className="h-3 w-3 mr-1" />
            Cancelamento manual
          </Badge>
        );
      case 'manual_sent':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
            <Send className="h-3 w-3 mr-1" />
            Envio manual
          </Badge>
        );
      case 'manual_override':
        return (
          <Badge className="bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700">
            <Ban className="h-3 w-3 mr-1" />
            Substituído
          </Badge>
        );
      default:
        return reason ? (
          <Badge variant="outline" className="text-xs">{reason}</Badge>
        ) : null;
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
                  <ScrollArea className="h-[450px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={upcomingNotifications.length > 0 && 
                                       selectedNotifications.length === upcomingNotifications.length}
                              onCheckedChange={handleSelectAllNotifications}
                            />
                          </TableHead>
                          <TableHead>Orçamento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Vendedor</TableHead>
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
                            className={item.paused || item.quoteAutoNotificationsPaused || item.quoteNotificationsPaused ? 'opacity-60' : ''}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedNotifications.includes(item.notificationKey)}
                                onCheckedChange={() => handleSelectOneNotification(item.notificationKey)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              ORC-{String(item.quote_number).padStart(3, '0')}
                            </TableCell>
                            <TableCell>
                              {getNotificationStatusBadge(item)}
                            </TableCell>
                            <TableCell>{item.contact?.full_name || 'N/A'}</TableCell>
                            <TableCell>
                              <span className="text-sm">{item.seller?.full_name || '—'}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm">{item.seller?.full_name || '—'}</span>
                            </TableCell>
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
                                      onClick={() => sendNowMutation.mutate({ 
                                        quoteId: item.quoteId, 
                                        notificationId: item.id, 
                                        item 
                                      })}
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
                              <div className="flex flex-col gap-1">
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
                                {notif.cancel_reason && getCancelReasonBadge(notif.cancel_reason)}
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
          </Tabs>
        </CardHeader>
      </Card>

      {/* Bulk Selection Bar for Notifications */}
      {selectedNotifications.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border shadow-lg rounded-lg px-4 py-3 flex items-center gap-4">
          <span className="text-sm font-medium">{selectedNotifications.length} selecionado(s)</span>
          <Button variant="ghost" size="sm" onClick={() => setSelectedNotifications([])}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
          <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir {selectedNotifications.length} notificação(ões)?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. As notificações selecionadas serão canceladas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBulkDeleteNotifications}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir Todos
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
