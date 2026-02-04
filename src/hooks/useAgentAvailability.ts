import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface AgentAvailabilityStatus {
  is_available: boolean;
  is_online: boolean;
  availability_locked_by: string | null;
  unavailable_until: string | null;
  unavailability_reason: string | null;
  locked_by_name?: string | null;
}

export interface ReleaseRequest {
  id: string;
  agent_id: string;
  locked_by: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  agent_name?: string;
}

export function useAgentAvailabilityStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['agent-availability-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          is_available,
          is_online,
          availability_locked_by,
          unavailable_until,
          unavailability_reason
        `)
        .eq('id', user.id)
        .single();

      if (error) throw error;

      // Get locker name if locked
      let lockedByName: string | null = null;
      if (data?.availability_locked_by) {
        const { data: lockerData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.availability_locked_by)
          .single();
        lockedByName = lockerData?.full_name || null;
      }

      return {
        ...data,
        locked_by_name: lockedByName,
      } as AgentAvailabilityStatus;
    },
    enabled: !!user?.id,
    staleTime: 60000, // 1 minuto - otimizado
    refetchInterval: 60000, // 1 minuto
    refetchOnWindowFocus: false,
  });
}

export function useToggleSelfAvailability() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      isAvailable,
      unavailableUntil,
      unavailabilityReason
    }: { 
      isAvailable: boolean;
      unavailableUntil?: string | null;
      unavailabilityReason?: string | null;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Check if currently locked by admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('availability_locked_by')
        .eq('id', user.id)
        .single();

      if (profile?.availability_locked_by && isAvailable) {
        throw new Error('Sua disponibilidade foi bloqueada por um administrador. Solicite liberação ou faça login novamente.');
      }

      const updateData: Record<string, unknown> = { 
        is_available: isAvailable,
        unavailable_until: isAvailable ? null : (unavailableUntil || null),
        unavailability_reason: isAvailable ? null : (unavailabilityReason || null),
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agent-availability-status'] });
      queryClient.invalidateQueries({ queryKey: ['agent-monitor-status'] });
      queryClient.invalidateQueries({ queryKey: ['team'] });
      
      if (variables.isAvailable) {
        toast.success('Você agora está recebendo leads');
      } else {
        toast.success('Você pausou o recebimento de leads');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useRequestRelease() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reason?: string) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Get current lock info
      const { data: profile } = await supabase
        .from('profiles')
        .select('availability_locked_by')
        .eq('id', user.id)
        .single();

      // Check if there's already a pending request
      const { data: existingRequest } = await supabase
        .from('availability_release_requests')
        .select('id')
        .eq('agent_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingRequest) {
        throw new Error('Você já possui uma solicitação pendente');
      }

      const { error } = await supabase
        .from('availability_release_requests')
        .insert({
          agent_id: user.id,
          locked_by: profile?.availability_locked_by || null,
          reason: reason || 'Solicito liberação para receber leads',
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['release-requests'] });
      toast.success('Solicitação enviada para os administradores');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function usePendingReleaseRequests() {
  return useQuery({
    queryKey: ['release-requests', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('availability_release_requests')
        .select(`
          id,
          agent_id,
          locked_by,
          reason,
          status,
          created_at,
          profiles!availability_release_requests_agent_id_fkey (
            full_name
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((req: any) => ({
        ...req,
        agent_name: req.profiles?.full_name || 'Desconhecido',
      })) as ReleaseRequest[];
    },
    staleTime: 60000, // 1 minuto - otimizado
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });
}

export function useRespondReleaseRequest() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      requestId, 
      approved,
      agentId
    }: { 
      requestId: string;
      approved: boolean;
      agentId: string;
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Update request status
      const { error: requestError } = await supabase
        .from('availability_release_requests')
        .update({
          status: approved ? 'approved' : 'rejected',
          responded_by: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (requestError) throw requestError;

      // If approved, unlock the agent
      if (approved) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            is_available: true,
            availability_locked_by: null,
            unavailable_until: null,
            unavailability_reason: null,
          })
          .eq('id', agentId);

        if (profileError) throw profileError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['release-requests'] });
      queryClient.invalidateQueries({ queryKey: ['agent-monitor-status'] });
      queryClient.invalidateQueries({ queryKey: ['agent-availability-status'] });
      
      toast.success(variables.approved ? 'Agente liberado' : 'Solicitação rejeitada');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

export function useMyPendingRequest() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-release-request', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('availability_release_requests')
        .select('id, status, created_at')
        .eq('agent_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 60000, // 1 minuto - otimizado
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });
}
