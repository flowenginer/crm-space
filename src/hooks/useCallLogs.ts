import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CallResult {
  id: string;
  name: string;
  color: string;
  icon: string;
  order_position: number;
  is_active: boolean;
}

export interface CallLog {
  id: string;
  contact_id: string;
  conversation_id: string | null;
  user_id: string;
  call_date: string;
  call_time: string;
  result_id: string | null;
  notes: string | null;
  schedule_followup: boolean;
  followup_date: string | null;
  followup_message: string | null;
  created_at: string;
  updated_at: string;
  result?: CallResult;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  contact?: {
    id: string;
    full_name: string;
    phone: string;
  };
}

// Fetch all call results (dropdown options)
export function useCallResults() {
  return useQuery({
    queryKey: ['call-results'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_results')
        .select('*')
        .eq('is_active', true)
        .order('order_position');

      if (error) throw error;
      return data as CallResult[];
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Fetch call logs for a specific contact
export function useCallLogs(contactId: string | null) {
  return useQuery({
    queryKey: ['call-logs', contactId],
    queryFn: async () => {
      if (!contactId) return [];

      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          result:call_results(*),
          user:profiles!call_logs_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq('contact_id', contactId)
        .order('call_date', { ascending: false })
        .order('call_time', { ascending: false });

      if (error) throw error;
      return data as CallLog[];
    },
    enabled: !!contactId,
  });
}

// Fetch all call logs for reports
export function useAllCallLogs(filters?: {
  startDate?: string;
  endDate?: string;
  userId?: string;
  resultId?: string;
}) {
  return useQuery({
    queryKey: ['all-call-logs', filters],
    queryFn: async () => {
      let query = supabase
        .from('call_logs')
        .select(`
          *,
          result:call_results(*),
          user:profiles!call_logs_user_id_fkey(id, full_name, avatar_url),
          contact:contacts!call_logs_contact_id_fkey(id, full_name, phone)
        `)
        .order('call_date', { ascending: false })
        .order('call_time', { ascending: false });

      if (filters?.startDate) {
        query = query.gte('call_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('call_date', filters.endDate);
      }
      if (filters?.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters?.resultId) {
        query = query.eq('result_id', filters.resultId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CallLog[];
    },
  });
}

// Create a new call log
export function useCreateCallLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      contact_id: string;
      conversation_id?: string | null;
      result_id?: string | null;
      notes?: string;
      schedule_followup?: boolean;
      followup_date?: string | null;
      followup_message?: string | null;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Usuário não autenticado');

      const now = new Date();
      const { data: result, error } = await supabase
        .from('call_logs')
        .insert({
          ...data,
          user_id: user.user.id,
          call_date: now.toISOString().split('T')[0],
          call_time: now.toTimeString().split(' ')[0],
        })
        .select(`
          *,
          result:call_results(*),
          user:profiles!call_logs_user_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['call-logs', variables.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['all-call-logs'] });
      toast.success('Ligação registrada com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao registrar ligação:', error);
      toast.error('Erro ao registrar ligação');
    },
  });
}

// Update a call log
export function useUpdateCallLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string;
      result_id?: string | null;
      notes?: string | null;
      schedule_followup?: boolean;
      followup_date?: string | null;
      followup_message?: string | null;
    }) => {
      const { data: result, error } = await supabase
        .from('call_logs')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select(`
          *,
          result:call_results(*),
          user:profiles!call_logs_user_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['call-logs', data.contact_id] });
      queryClient.invalidateQueries({ queryKey: ['all-call-logs'] });
      toast.success('Ligação atualizada!');
    },
    onError: (error) => {
      console.error('Erro ao atualizar ligação:', error);
      toast.error('Erro ao atualizar ligação');
    },
  });
}

// Delete a call log
export function useDeleteCallLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, contactId }: { id: string; contactId: string }) => {
      const { error } = await supabase
        .from('call_logs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, contactId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['call-logs', data.contactId] });
      queryClient.invalidateQueries({ queryKey: ['all-call-logs'] });
      toast.success('Registro de ligação excluído');
    },
    onError: (error) => {
      console.error('Erro ao excluir ligação:', error);
      toast.error('Erro ao excluir ligação');
    },
  });
}

// Get call stats for reports
export function useCallStats(filters?: {
  startDate?: string;
  endDate?: string;
}) {
  return useQuery({
    queryKey: ['call-stats', filters],
    queryFn: async () => {
      let query = supabase
        .from('call_logs')
        .select(`
          id,
          call_date,
          result_id,
          user_id,
          result:call_results(name, color)
        `);

      if (filters?.startDate) {
        query = query.gte('call_date', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('call_date', filters.endDate);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Calculate stats
      const total = data.length;
      const byResult: Record<string, { count: number; name: string; color: string }> = {};
      const byDate: Record<string, number> = {};
      const byUser: Record<string, number> = {};

      data.forEach((log: any) => {
        // By result
        const resultName = log.result?.name || 'Sem resultado';
        const resultColor = log.result?.color || '#6b7280';
        if (!byResult[resultName]) {
          byResult[resultName] = { count: 0, name: resultName, color: resultColor };
        }
        byResult[resultName].count++;

        // By date
        if (!byDate[log.call_date]) {
          byDate[log.call_date] = 0;
        }
        byDate[log.call_date]++;

        // By user
        if (!byUser[log.user_id]) {
          byUser[log.user_id] = 0;
        }
        byUser[log.user_id]++;
      });

      return {
        total,
        byResult: Object.values(byResult),
        byDate: Object.entries(byDate).map(([date, count]) => ({ date, count })),
        byUser,
      };
    },
  });
}
