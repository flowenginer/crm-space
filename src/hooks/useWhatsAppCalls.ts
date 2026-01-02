import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { 
  WhatsAppCallLog, 
  CallStats, 
  CallStatsFilters,
  CallType,
  CallDirection,
  SentimentLabel 
} from '@/types/cloudapi';

// Buscar chamadas WhatsApp com filtros
export function useWhatsAppCalls(filters?: {
  startDate?: string;
  endDate?: string;
  userId?: string;
  channelId?: string;
  callType?: CallType;
  direction?: CallDirection;
  sentimentLabel?: SentimentLabel;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['whatsapp-calls', filters],
    queryFn: async () => {
      let query = supabase
        .from('call_logs')
        .select(`
          *,
          result:call_results(*),
          user:profiles!call_logs_user_id_fkey(id, full_name, avatar_url),
          contact:contacts!call_logs_contact_id_fkey(id, full_name, phone),
          channel:whatsapp_channels!call_logs_channel_id_fkey(id, name, phone)
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filters?.startDate) {
        query = query.gte('call_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('call_date', filters.endDate);
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.channelId) {
        query = query.eq('channel_id', filters.channelId);
      }
      if (filters?.callType) {
        query = query.eq('call_type', filters.callType);
      }
      if (filters?.direction) {
        query = query.eq('direction', filters.direction);
      }
      if (filters?.sentimentLabel) {
        query = query.eq('sentiment_label', filters.sentimentLabel);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as WhatsAppCallLog[];
    },
  });
}

// Buscar estatísticas de chamadas
export function useCallStatistics(filters?: CallStatsFilters) {
  return useQuery({
    queryKey: ['call-statistics', filters],
    queryFn: async () => {
      let query = supabase
        .from('call_logs')
        .select('id, call_status, duration_seconds, sentiment_label, created_at, call_type');

      if (filters?.start_date) {
        query = query.gte('call_date', filters.start_date);
      }
      if (filters?.end_date) {
        query = query.lte('call_date', filters.end_date);
      }
      if (filters?.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters?.channel_id) {
        query = query.eq('channel_id', filters.channel_id);
      }
      if (filters?.call_type) {
        query = query.eq('call_type', filters.call_type);
      }
      if (filters?.direction) {
        query = query.eq('direction', filters.direction);
      }

      const { data, error } = await query;
      if (error) throw error;

      const calls = data || [];
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Calcular estatísticas
      const stats: CallStats = {
        total_calls: calls.length,
        answered_calls: calls.filter(c => c.call_status === 'completed' || c.call_status === 'accepted').length,
        missed_calls: calls.filter(c => c.call_status === 'missed' || c.call_status === 'rejected').length,
        average_duration_seconds: 0,
        total_duration_seconds: 0,
        answer_rate: 0,
        positive_calls: calls.filter(c => c.sentiment_label === 'positive').length,
        neutral_calls: calls.filter(c => c.sentiment_label === 'neutral').length,
        negative_calls: calls.filter(c => c.sentiment_label === 'negative').length,
        calls_today: 0,
        calls_this_week: 0,
        calls_this_month: 0,
      };

      // Calcular duração total e média
      const callsWithDuration = calls.filter(c => c.duration_seconds);
      stats.total_duration_seconds = callsWithDuration.reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
      stats.average_duration_seconds = callsWithDuration.length > 0 
        ? stats.total_duration_seconds / callsWithDuration.length 
        : 0;

      // Taxa de atendimento
      stats.answer_rate = stats.total_calls > 0 
        ? (stats.answered_calls / stats.total_calls) * 100 
        : 0;

      // Contagem por período
      calls.forEach(call => {
        const callDate = new Date(call.created_at);
        if (callDate >= todayStart) stats.calls_today++;
        if (callDate >= weekStart) stats.calls_this_week++;
        if (callDate >= monthStart) stats.calls_this_month++;
      });

      return stats;
    },
  });
}

// Iniciar chamada WhatsApp
export function useInitiateWhatsAppCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      channel_id: string;
      contact_id: string;
      phone: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('cloudapi-initiate-call', {
        body: payload,
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Falha ao iniciar chamada');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-calls'] });
      queryClient.invalidateQueries({ queryKey: ['call-statistics'] });
      toast.success('Chamada iniciada!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao iniciar chamada: ${error.message}`);
    },
  });
}

// Atualizar status da chamada
export function useUpdateCallStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      callId, 
      ...updates 
    }: {
      callId: string;
      call_status?: string;
      duration_seconds?: number;
      end_time?: string;
      error_code?: string;
    }) => {
      const { data, error } = await supabase
        .from('call_logs')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', callId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-calls'] });
      queryClient.invalidateQueries({ queryKey: ['call-statistics'] });
    },
  });
}

// Solicitar transcrição de chamada
export function useTranscribeCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callId: string) => {
      const { data, error } = await supabase.functions.invoke('transcribe-call', {
        body: { call_id: callId },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Falha ao transcrever chamada');
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-calls'] });
      toast.success('Transcrição iniciada! O processo pode levar alguns minutos.');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao transcrever: ${error.message}`);
    },
  });
}

// Buscar chamadas por contato
export function useContactCalls(contactId: string | null) {
  return useQuery({
    queryKey: ['contact-calls', contactId],
    queryFn: async () => {
      if (!contactId) return [];

      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          result:call_results(*),
          user:profiles!call_logs_user_id_fkey(id, full_name, avatar_url),
          channel:whatsapp_channels!call_logs_channel_id_fkey(id, name, phone)
        `)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as WhatsAppCallLog[];
    },
    enabled: !!contactId,
  });
}

// Buscar chamadas recentes com sentimento negativo (para alertas)
export function useNegativeSentimentCalls(limit = 10) {
  return useQuery({
    queryKey: ['negative-sentiment-calls', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          contact:contacts!call_logs_contact_id_fkey(id, full_name, phone),
          user:profiles!call_logs_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq('sentiment_label', 'negative')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as WhatsAppCallLog[];
    },
  });
}
