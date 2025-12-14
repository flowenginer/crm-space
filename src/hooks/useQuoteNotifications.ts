import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface QuoteNotificationStatus {
  isPaused: boolean;
  isManuallyPaused: boolean;
  isAutoPaused: boolean;
  autoPauseReason: string | null;
  pausedAt: string | null;
  pausedByName: string | null;
}

interface ContactQuoteNotificationStatus {
  anyPaused: boolean;
  allPaused: boolean;
  quotes: Array<{
    quoteId: string;
    quoteNumber: string;
    status: QuoteNotificationStatus;
  }>;
}

export function useQuoteNotificationStatus(quoteId: string | null) {
  return useQuery({
    queryKey: ['quote-notification-status', quoteId],
    queryFn: async (): Promise<QuoteNotificationStatus | null> => {
      if (!quoteId) return null;

      const { data, error } = await supabase
        .from('quotes')
        .select(`
          notifications_paused,
          notifications_paused_at,
          notifications_paused_by,
          notifications_auto_paused,
          notifications_auto_pause_reason,
          paused_by_profile:profiles!quotes_notifications_paused_by_fkey(full_name)
        `)
        .eq('id', quoteId)
        .single();

      if (error) throw error;
      if (!data) return null;

      const pausedByProfile = data.paused_by_profile as any;

      return {
        isPaused: data.notifications_paused || data.notifications_auto_paused,
        isManuallyPaused: data.notifications_paused || false,
        isAutoPaused: data.notifications_auto_paused || false,
        autoPauseReason: data.notifications_auto_pause_reason,
        pausedAt: data.notifications_paused_at,
        pausedByName: pausedByProfile?.full_name || null,
      };
    },
    enabled: !!quoteId,
  });
}

export function useContactQuotesNotificationStatus(contactId: string | null) {
  return useQuery({
    queryKey: ['contact-quotes-notification-status', contactId],
    queryFn: async (): Promise<ContactQuoteNotificationStatus | null> => {
      if (!contactId) return null;

      const { data, error } = await supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          notifications_paused,
          notifications_paused_at,
          notifications_auto_paused,
          notifications_auto_pause_reason
        `)
        .eq('contact_id', contactId)
        .not('status', 'in', '(converted,rejected,cancelled)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return null;

      const quotes = data.map((q: any) => ({
        quoteId: q.id,
        quoteNumber: q.quote_number,
        status: {
          isPaused: q.notifications_paused || q.notifications_auto_paused,
          isManuallyPaused: q.notifications_paused || false,
          isAutoPaused: q.notifications_auto_paused || false,
          autoPauseReason: q.notifications_auto_pause_reason,
          pausedAt: q.notifications_paused_at,
          pausedByName: null,
        },
      }));

      return {
        anyPaused: quotes.some(q => q.status.isPaused),
        allPaused: quotes.every(q => q.status.isPaused),
        quotes,
      };
    },
    enabled: !!contactId,
  });
}

export function useToggleQuoteNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ quoteId, pause }: { quoteId: string; pause: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('quotes')
        .update({
          notifications_paused: pause,
          notifications_paused_at: pause ? new Date().toISOString() : null,
          notifications_paused_by: pause ? user.id : null,
          // If manually activating, also clear auto-pause
          ...(pause === false && {
            notifications_auto_paused: false,
            notifications_auto_pause_reason: null,
          }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      if (error) throw error;
    },
    onSuccess: (_, { quoteId, pause }) => {
      queryClient.invalidateQueries({ queryKey: ['quote-notification-status', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['contact-quotes-notification-status'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success(pause ? 'Notificações pausadas' : 'Notificações ativadas');
    },
    onError: () => {
      toast.error('Erro ao atualizar notificações');
    },
  });
}

export function useToggleContactQuotesNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, pause }: { contactId: string; pause: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get all active quotes for this contact
      const { data: quotes, error: fetchError } = await supabase
        .from('quotes')
        .select('id')
        .eq('contact_id', contactId)
        .not('status', 'in', '(converted,rejected,cancelled)');

      if (fetchError) throw fetchError;
      if (!quotes || quotes.length === 0) return;

      // Update all quotes
      const { error } = await supabase
        .from('quotes')
        .update({
          notifications_paused: pause,
          notifications_paused_at: pause ? new Date().toISOString() : null,
          notifications_paused_by: pause ? user.id : null,
          ...(pause === false && {
            notifications_auto_paused: false,
            notifications_auto_pause_reason: null,
          }),
          updated_at: new Date().toISOString(),
        })
        .eq('contact_id', contactId)
        .not('status', 'in', '(converted,rejected,cancelled)');

      if (error) throw error;
    },
    onSuccess: (_, { pause }) => {
      queryClient.invalidateQueries({ queryKey: ['contact-quotes-notification-status'] });
      queryClient.invalidateQueries({ queryKey: ['quote-notification-status'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success(pause ? 'Notificações pausadas para todos os orçamentos' : 'Notificações ativadas para todos os orçamentos');
    },
    onError: () => {
      toast.error('Erro ao atualizar notificações');
    },
  });
}

export function getAutoPauseReasonText(reason: string | null): string {
  switch (reason) {
    case 'client_responded':
      return 'cliente respondeu';
    case 'status_changed':
      return 'status alterado';
    case 'converted':
      return 'convertido em pedido';
    default:
      return '';
  }
}
