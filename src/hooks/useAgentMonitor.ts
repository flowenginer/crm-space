import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface AgentStatus {
  agent_id: string;
  agent_name: string;
  avatar_url: string | null;
  is_available: boolean;
  is_online: boolean;
  department_name: string | null;
  open_conversations: number;
  waiting_response: number;
  oldest_waiting_minutes: number;
  unavailable_until: string | null;
  unavailability_reason: string | null;
}

export interface AgentResponseHistory {
  agent_id: string;
  agent_name: string;
  report_date: string;
  total_conversations: number;
  avg_response_minutes: number | null;
}

export function useAgentMonitorStatus() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['agent-monitor-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_agents_response_status');
      if (error) throw error;
      return (data || []) as AgentStatus[];
    },
    staleTime: 60000, // 1 minuto - otimizado
    refetchInterval: 60000, // 1 minuto - reduz carga no banco
    refetchOnWindowFocus: false,
  });

  // Real-time subscription - OTIMIZADO
  // Antes: event: '*' em messages e conversations (muito broad, causava invalidações excessivas)
  // Agora: apenas eventos específicos que afetam o monitor
  useEffect(() => {
    // Debounce para evitar invalidações excessivas
    let debounceTimeout: NodeJS.Timeout | null = null;
    const debouncedInvalidate = () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['agent-monitor-status'] });
      }, 500);
    };

    const channel = supabase
      .channel('agent-monitor-realtime')
      // Conversas: apenas UPDATE (mudança de assigned_to, status)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        debouncedInvalidate
      )
      // Conversas: INSERT (nova conversa)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        debouncedInvalidate
      )
      // Profiles: apenas UPDATE (mudança de is_available)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        debouncedInvalidate
      )
      .subscribe();

    return () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useAgentResponseHistory(days: number = 7) {
  return useQuery({
    queryKey: ['agent-response-history', days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_agents_response_history', { p_days: days });
      if (error) throw error;
      return (data || []) as AgentResponseHistory[];
    },
    staleTime: 60000,
  });
}

export function useToggleAgentAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      agentId, 
      isAvailable,
      unavailableUntil,
      unavailabilityReason,
      lockedBy
    }: { 
      agentId: string; 
      isAvailable: boolean;
      unavailableUntil?: string | null;
      unavailabilityReason?: string | null;
      lockedBy?: string | null; // ID of admin who locked (null to unlock)
    }) => {
      const updateData: Record<string, unknown> = { 
        is_available: isAvailable,
        unavailable_until: isAvailable ? null : (unavailableUntil || null),
        unavailability_reason: isAvailable ? null : (unavailabilityReason || null),
      };

      // Handle admin lock/unlock
      if (lockedBy !== undefined) {
        updateData.availability_locked_by = lockedBy;
      } else if (isAvailable) {
        // When reactivating, always clear the lock
        updateData.availability_locked_by = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', agentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-monitor-status'] });
      queryClient.invalidateQueries({ queryKey: ['agent-availability-status'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });
}

export function useResponseAlertSettings() {
  return useQuery({
    queryKey: ['response-alert-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('response_alert_minutes')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.response_alert_minutes ?? 5;
    },
    staleTime: 60000,
  });
}

export function useUpdateResponseAlertSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (minutes: number) => {
      // Check if settings exist
      const { data: existing } = await supabase
        .from('company_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('company_settings')
          .update({ response_alert_minutes: minutes })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert({ response_alert_minutes: minutes });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['response-alert-settings'] });
      queryClient.invalidateQueries({ queryKey: ['company_settings'] });
    },
  });
}
