import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Invitation {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  department_id: string | null;
  invited_by: string | null;
  token: string;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
  updated_at: string;
  department?: { name: string } | null;
  inviter?: { full_name: string } | null;
}

interface CreateInvitationData {
  email: string;
  role: string;
  department_id?: string | null;
}

export function useInvitations() {
  const queryClient = useQueryClient();

  const { data: invitations = [], isLoading, error } = useQuery({
    queryKey: ['tenant-invitations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_invitations')
        .select(`
          *,
          department:departments(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get inviter names separately
      const inviterIds = [...new Set(data?.filter(d => d.invited_by).map(d => d.invited_by))] as string[];
      let invitersMap: Record<string, string> = {};
      
      if (inviterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', inviterIds);
        
        profiles?.forEach(p => {
          invitersMap[p.id] = p.full_name;
        });
      }
      
      return data.map(inv => ({
        ...inv,
        inviter: inv.invited_by ? { full_name: invitersMap[inv.invited_by] || 'Desconhecido' } : null,
      })) as Invitation[];
    },
  });

  const createInvitation = useMutation({
    mutationFn: async (data: CreateInvitationData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // Get user's tenant_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

      if (!profile?.tenant_id) throw new Error('Tenant não encontrado');

      const { data: invitation, error } = await supabase
        .from('tenant_invitations')
        .insert({
          tenant_id: profile.tenant_id,
          email: data.email.toLowerCase().trim(),
          role: data.role,
          department_id: data.department_id || null,
          invited_by: user.id,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe um convite pendente para este email');
        }
        throw error;
      }

      return invitation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-invitations'] });
      toast.success('Convite enviado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar convite');
    },
  });

  const cancelInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from('tenant_invitations')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-invitations'] });
      toast.success('Convite cancelado');
    },
    onError: () => {
      toast.error('Erro ao cancelar convite');
    },
  });

  const resendInvitation = useMutation({
    mutationFn: async (invitationId: string) => {
      // Generate new token and extend expiration
      const newToken = crypto.randomUUID() + crypto.randomUUID();
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + 7);

      const { error } = await supabase
        .from('tenant_invitations')
        .update({
          token: newToken,
          expires_at: newExpiry.toISOString(),
          status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-invitations'] });
      toast.success('Convite reenviado');
    },
    onError: () => {
      toast.error('Erro ao reenviar convite');
    },
  });

  return {
    invitations,
    isLoading,
    error,
    createInvitation,
    cancelInvitation,
    resendInvitation,
  };
}

export function useInvitationByToken(token: string | null) {
  return useQuery({
    queryKey: ['invitation', token],
    queryFn: async () => {
      if (!token) return null;

      const { data, error } = await supabase
        .from('tenant_invitations')
        .select(`
          *,
          tenant:tenants(name, slug)
        `)
        .eq('token', token)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!token,
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ token, userId }: { token: string; userId: string }) => {
      const { data, error } = await supabase.rpc('accept_invitation', {
        invitation_token: token,
        user_id: userId,
      });

      if (error) throw error;
      
      const result = data as { success: boolean; error?: string; tenant_id?: string; role?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao aceitar convite');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-tenant'] });
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      toast.success('Convite aceito com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao aceitar convite');
    },
  });
}
