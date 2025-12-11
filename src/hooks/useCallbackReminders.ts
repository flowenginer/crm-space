import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PendingCallback {
  id: string;
  call_date: string;
  call_time: string;
  followup_date: string;
  followup_message: string | null;
  notes: string | null;
  contact_id: string;
  user_id: string;
  contact?: {
    id: string;
    full_name: string;
    phone: string;
  } | null;
  user?: {
    id: string;
    full_name: string | null;
  } | null;
  result?: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
}

export function usePendingCallbacks(filters?: {
  statusFilter?: 'all' | 'pending' | 'overdue' | 'today';
  agentFilter?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['pending-callbacks', filters],
    queryFn: async () => {
      let query = supabase
        .from('call_logs')
        .select(`
          id,
          call_date,
          call_time,
          followup_date,
          followup_message,
          notes,
          contact_id,
          user_id,
          contact:contacts(id, full_name, phone),
          user:profiles!call_logs_user_id_fkey(id, full_name),
          result:call_results(id, name, color, icon)
        `)
        .eq('schedule_followup', true)
        .not('followup_date', 'is', null)
        .order('followup_date', { ascending: true });

      // Agent filter
      if (filters?.agentFilter && filters.agentFilter !== 'all') {
        query = query.eq('user_id', filters.agentFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      let callbacks = (data || []) as PendingCallback[];

      // Date filters
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (filters?.statusFilter === 'overdue') {
        callbacks = callbacks.filter(cb => new Date(cb.followup_date) < now);
      } else if (filters?.statusFilter === 'today') {
        callbacks = callbacks.filter(cb => {
          const cbDate = new Date(cb.followup_date);
          return cbDate >= today && cbDate < tomorrow;
        });
      } else if (filters?.statusFilter === 'pending') {
        callbacks = callbacks.filter(cb => new Date(cb.followup_date) >= now);
      }

      // Search filter
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        callbacks = callbacks.filter(cb =>
          cb.contact?.full_name?.toLowerCase().includes(searchLower) ||
          cb.contact?.phone?.includes(filters.search!) ||
          cb.notes?.toLowerCase().includes(searchLower) ||
          cb.followup_message?.toLowerCase().includes(searchLower)
        );
      }

      return callbacks;
    },
    refetchInterval: 30000
  });
}

export function usePendingCallbacksCount() {
  return useQuery({
    queryKey: ['pending-callbacks-count'],
    queryFn: async () => {
      const now = new Date();
      
      const { data, error } = await supabase
        .from('call_logs')
        .select('followup_date')
        .eq('schedule_followup', true)
        .not('followup_date', 'is', null);

      if (error) throw error;

      // Count pending (future) and overdue (past)
      const pending = (data || []).filter(cb => new Date(cb.followup_date!) >= now).length;
      const overdue = (data || []).filter(cb => new Date(cb.followup_date!) < now).length;

      return { pending, overdue, total: pending + overdue };
    },
    refetchInterval: 30000
  });
}

export function useMarkCallbackComplete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ callLogId, contactId }: { callLogId: string; contactId: string }) => {
      // Remove the followup scheduling from the original call log
      const { error } = await supabase
        .from('call_logs')
        .update({
          schedule_followup: false,
          followup_date: null,
          followup_message: null
        })
        .eq('id', callLogId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-callbacks'] });
      queryClient.invalidateQueries({ queryKey: ['pending-callbacks-count'] });
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
    }
  });
}

export function useDeleteCallback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callLogId: string) => {
      // Just remove the followup, don't delete the call log
      const { error } = await supabase
        .from('call_logs')
        .update({
          schedule_followup: false,
          followup_date: null,
          followup_message: null
        })
        .eq('id', callLogId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-callbacks'] });
      queryClient.invalidateQueries({ queryKey: ['pending-callbacks-count'] });
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
    }
  });
}

export function useUpdateCallback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ callLogId, followupDate, followupMessage }: { 
      callLogId: string; 
      followupDate: string;
      followupMessage?: string | null;
    }) => {
      const { error } = await supabase
        .from('call_logs')
        .update({
          followup_date: followupDate,
          followup_message: followupMessage
        })
        .eq('id', callLogId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-callbacks'] });
      queryClient.invalidateQueries({ queryKey: ['pending-callbacks-count'] });
      queryClient.invalidateQueries({ queryKey: ['call-logs'] });
    }
  });
}
