import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface WaitingConversation {
  conversation_id: string;
  contact_id: string;
  contact_name: string;
  contact_phone: string;
  contact_avatar: string | null;
  last_message_preview: string | null;
  waiting_since: string;
  waiting_minutes: number;
  assigned_to: string | null;
  department_id: string | null;
}

/**
 * Hook para buscar a contagem de conversas aguardando resposta do usuário logado.
 * Usa EXATAMENTE a mesma RPC que o Monitoramento de Vendedores.
 */
export function useMyWaitingCount() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['my-waiting-count'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      // Usa a mesma RPC que o WaitingConversationsModal
      const { data, error } = await supabase.rpc('get_agent_waiting_conversations', {
        p_agent_id: user.id,
      });
      
      if (error) throw error;
      return (data || []).length;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Real-time subscription - mesmo padrão do useAgentMonitorStatus
  useEffect(() => {
    let debounceTimeout: NodeJS.Timeout | null = null;
    const debouncedInvalidate = () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['my-waiting-count'] });
        queryClient.invalidateQueries({ queryKey: ['my-waiting-conversations'] });
      }, 500);
    };

    const channel = supabase
      .channel('my-waiting-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        debouncedInvalidate
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        debouncedInvalidate
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
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

/**
 * Hook para buscar as conversas aguardando resposta do usuário logado.
 * Usa EXATAMENTE a mesma RPC que o WaitingConversationsModal.
 */
export function useMyWaitingConversations(enabled: boolean = true) {
  return useQuery({
    queryKey: ['my-waiting-conversations'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase.rpc('get_agent_waiting_conversations', {
        p_agent_id: user.id,
      });
      
      if (error) throw error;
      return (data || []) as WaitingConversation[];
    },
    enabled,
    staleTime: 30000,
    refetchInterval: 30000,
  });
}

export type { WaitingConversation };
