import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEffect } from 'react';

export type CallPermissionStatus = 'pending' | 'granted' | 'denied' | null;

interface UseCallPermissionOptions {
  contactId: string;
  contactPhone: string;
  conversationId?: string;
  channelId?: string;
}

export function useCallPermission({ 
  contactId, 
  contactPhone, 
  conversationId, 
  channelId 
}: UseCallPermissionOptions) {
  const queryClient = useQueryClient();

  // Query to get the current call permission status
  const { data: permissionData, isLoading, refetch } = useQuery({
    queryKey: ['call-permission', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('call_permission_status, call_permission_requested_at')
        .eq('id', contactId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching call permission status:', error);
        throw error;
      }

      return data;
    },
    enabled: !!contactId,
    staleTime: 30000, // 30 seconds
  });

  // Subscribe to realtime updates for this contact's permission status
  useEffect(() => {
    if (!contactId) return;

    const channel = supabase
      .channel(`call-permission-${contactId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contacts',
          filter: `id=eq.${contactId}`,
        },
        (payload) => {
          const newStatus = payload.new.call_permission_status;
          const oldStatus = payload.old?.call_permission_status;

          // Only show toast if status actually changed
          if (newStatus !== oldStatus) {
            if (newStatus === 'granted') {
              toast.success('Permissão de chamada concedida! Agora você pode ligar.');
            } else if (newStatus === 'denied') {
              toast.error('Permissão de chamada negada pelo contato.');
            }
          }

          // Invalidate query to refetch
          queryClient.invalidateQueries({ queryKey: ['call-permission', contactId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [contactId, queryClient]);

  // Mutation to request call permission
  const requestPermissionMutation = useMutation({
    mutationFn: async (customMessage?: string) => {
      if (!conversationId) {
        throw new Error('Conversation ID is required');
      }

      const { data, error } = await supabase.functions.invoke('cloudapi-send-call-permission-request', {
        body: {
          contactId,
          contactPhone,
          conversationId,
          channelId,
          customMessage,
        },
      });

      if (error) {
        console.error('Error requesting call permission:', error);
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (data) => {
      if (data.already_granted) {
        toast.success('Permissão já concedida anteriormente! Você pode ligar.');
      } else {
        toast.success('Solicitação de permissão enviada!');
      }
      queryClient.invalidateQueries({ queryKey: ['call-permission', contactId] });
    },
    onError: (error) => {
      console.error('Error requesting call permission:', error);
      toast.error(`Erro ao solicitar permissão: ${error.message}`);
    },
  });

  const status: CallPermissionStatus = permissionData?.call_permission_status as CallPermissionStatus;
  const requestedAt = permissionData?.call_permission_requested_at 
    ? new Date(permissionData.call_permission_requested_at) 
    : null;

  // Allow re-requesting: always when null/denied, or when pending (message may have failed)
  const canRequestAgain = !status || 
    status === 'denied' || 
    status === 'pending';

  return {
    status,
    requestedAt,
    isLoading,
    hasPermission: status === 'granted',
    isPending: status === 'pending',
    isDenied: status === 'denied',
    canRequestAgain,
    requestPermission: requestPermissionMutation.mutate,
    isRequesting: requestPermissionMutation.isPending,
    refetch,
  };
}
