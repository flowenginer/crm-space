import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

// Helper para obter usuário de forma robusta (getSession primeiro, depois getUser como fallback)
async function getAuthenticatedUser(): Promise<User | null> {
  // Primeiro tenta getSession (lê do localStorage, mais confiável e rápido)
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) {
    return sessionData.session.user;
  }
  
  // Fallback para getUser (verifica com servidor)
  const { data: userData } = await supabase.auth.getUser();
  if (userData.user) {
    return userData.user;
  }
  
  return null;
}

// Types
export interface EmailSharedBox {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  distribution_type: 'claim' | 'round_robin';
  current_position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  department?: {
    id: string;
    name: string;
    color: string;
  };
}

export interface SharedBoxMember {
  shared_box_id: string;
  user_id: string;
  is_active: boolean;
  order_position: number;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface EmailActivityLog {
  id: string;
  email_id: string;
  action: string;
  actor_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
  actor?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

// Hook para buscar caixas compartilhadas onde o usuário é membro (para sidebar)
export function useUserSharedBoxes() {
  return useQuery({
    queryKey: ['user-shared-boxes'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];

      // Primeiro busca as caixas onde o usuário é membro
      const { data: memberships, error: memberError } = await supabase
        .from('email_shared_box_members')
        .select('shared_box_id')
        .eq('user_id', userData.user.id)
        .eq('is_active', true);

      if (memberError) throw memberError;
      
      const memberBoxIds = memberships?.map(m => m.shared_box_id) || [];
      
      if (memberBoxIds.length === 0) return [];

      // Busca os detalhes das caixas
      const { data, error } = await supabase
        .from('email_shared_boxes')
        .select(`
          *,
          department:departments(id, name, color)
        `)
        .in('id', memberBoxIds)
        .eq('is_active', true);

      if (error) throw error;
      return data as EmailSharedBox[];
    }
  });
}

// Hook para buscar todas as caixas compartilhadas (para composição e administração)
export function useAllSharedBoxes() {
  return useQuery({
    queryKey: ['all-shared-boxes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_shared_boxes')
        .select(`
          *,
          department:departments(id, name, color)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as EmailSharedBox[];
    }
  });
}

// Hook para buscar caixas compartilhadas visíveis para o usuário atual (baseado nas regras de visibilidade)
export function useVisibleSharedBoxes() {
  return useQuery({
    queryKey: ['visible-shared-boxes'],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];

      // Busca o role do usuário atual
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userData.user.id)
        .single();

      const currentRole = profile?.role;
      const isAdminOrSupervisor = ['admin', 'supervisor'].includes(currentRole || '');

      // Busca todas as caixas compartilhadas
      const { data: boxes, error } = await supabase
        .from('email_shared_boxes')
        .select(`
          *,
          department:departments(id, name, color)
        `)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;

      // Admin/Supervisor vê todas
      if (isAdminOrSupervisor) {
        return boxes as EmailSharedBox[];
      }

      // Busca regras de visibilidade para caixas compartilhadas
      const { data: rules } = await supabase
        .from('email_visibility_rules')
        .select('target_shared_box_id')
        .eq('source_role', currentRole || '')
        .eq('is_allowed', true)
        .not('target_shared_box_id', 'is', null);

      const allowedBoxIds = rules?.map(r => r.target_shared_box_id) || [];

      // Filtra caixas baseado nas regras
      return (boxes as EmailSharedBox[]).filter(box => allowedBoxIds.includes(box.id));
    }
  });
}

// Hook para buscar membros de uma caixa compartilhada
export function useSharedBoxMembers(sharedBoxId: string | null) {
  return useQuery({
    queryKey: ['shared-box-members', sharedBoxId],
    queryFn: async () => {
      if (!sharedBoxId) return [];

      const { data, error } = await supabase
        .from('email_shared_box_members')
        .select(`
          *,
          user:profiles(id, full_name, avatar_url)
        `)
        .eq('shared_box_id', sharedBoxId)
        .eq('is_active', true)
        .order('order_position');

      if (error) throw error;
      return data as SharedBoxMember[];
    },
    enabled: !!sharedBoxId
  });
}

// Hook para buscar e-mails de uma caixa compartilhada
export function useSharedBoxEmails(sharedBoxId: string | null, statusFilter?: 'pending' | 'in_progress' | 'completed' | 'all') {
  return useQuery({
    queryKey: ['shared-box-emails', sharedBoxId, statusFilter],
    queryFn: async () => {
      if (!sharedBoxId) return [];

      let query = supabase
        .from('internal_emails')
        .select(`
          *,
          sender:profiles!internal_emails_sender_id_fkey(id, full_name, avatar_url),
          claimed_by_user:profiles!internal_emails_claimed_by_fkey(id, full_name, avatar_url)
        `)
        .eq('shared_box_id', sharedBoxId)
        .eq('status', 'sent')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('workflow_status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!sharedBoxId
  });
}

// Hook para contagem de e-mails pendentes por caixa compartilhada
export function useSharedBoxPendingCount(sharedBoxId: string | null) {
  return useQuery({
    queryKey: ['shared-box-pending-count', sharedBoxId],
    queryFn: async () => {
      if (!sharedBoxId) return 0;

      const { count, error } = await supabase
        .from('internal_emails')
        .select('*', { count: 'exact', head: true })
        .eq('shared_box_id', sharedBoxId)
        .eq('status', 'sent')
        .eq('workflow_status', 'pending')
        .is('claimed_by', null);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!sharedBoxId
  });
}

// Hook para contagens totais de todas as caixas compartilhadas do usuário
export function useAllSharedBoxesCounts() {
  const { data: sharedBoxes } = useUserSharedBoxes();

  return useQuery({
    queryKey: ['all-shared-boxes-counts', sharedBoxes?.map(sb => sb.id)],
    queryFn: async () => {
      if (!sharedBoxes || sharedBoxes.length === 0) return {};

      const counts: Record<string, { pending: number; in_progress: number; completed: number; total: number }> = {};

      for (const box of sharedBoxes) {
        const { count: pendingCount } = await supabase
          .from('internal_emails')
          .select('*', { count: 'exact', head: true })
          .eq('shared_box_id', box.id)
          .eq('status', 'sent')
          .eq('workflow_status', 'pending')
          .is('claimed_by', null);

        const { count: inProgressCount } = await supabase
          .from('internal_emails')
          .select('*', { count: 'exact', head: true })
          .eq('shared_box_id', box.id)
          .eq('status', 'sent')
          .eq('workflow_status', 'in_progress');

        const { count: completedCount } = await supabase
          .from('internal_emails')
          .select('*', { count: 'exact', head: true })
          .eq('shared_box_id', box.id)
          .eq('status', 'sent')
          .eq('workflow_status', 'completed');

        const { count: totalCount } = await supabase
          .from('internal_emails')
          .select('*', { count: 'exact', head: true })
          .eq('shared_box_id', box.id)
          .eq('status', 'sent');

        counts[box.id] = {
          pending: pendingCount || 0,
          in_progress: inProgressCount || 0,
          completed: completedCount || 0,
          total: totalCount || 0
        };
      }

      return counts;
    },
    enabled: !!sharedBoxes && sharedBoxes.length > 0
  });
}

// Hook para assumir um e-mail
export function useClaimEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (emailId: string) => {
      // Usar helper de autenticação robusta
      const user = await getAuthenticatedUser();
      if (!user) throw new Error('Sessão expirada. Por favor, recarregue a página.');

      // Verificar se já foi assumido
      const { data: email } = await supabase
        .from('internal_emails')
        .select('claimed_by')
        .eq('id', emailId)
        .single();

      if (email?.claimed_by) {
        throw new Error('Este e-mail já foi assumido por outro membro');
      }

      // Assumir o e-mail
      const { error } = await supabase
        .from('internal_emails')
        .update({
          claimed_by: user.id,
          claimed_at: new Date().toISOString(),
          workflow_status: 'in_progress'
        })
        .eq('id', emailId);

      if (error) throw error;

      return emailId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-box-emails'] });
      queryClient.invalidateQueries({ queryKey: ['shared-box-pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['all-shared-boxes-counts'] });
      queryClient.invalidateQueries({ queryKey: ['internal-email'] });
    }
  });
}

// Hook para liberar um e-mail (devolver para a fila)
export function useReleaseEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (emailId: string) => {
      // Usar helper de autenticação robusta
      const user = await getAuthenticatedUser();
      if (!user) throw new Error('Sessão expirada. Por favor, recarregue a página.');

      console.log('[ReleaseEmail] Liberando e-mail:', emailId);

      // Liberar o e-mail (o trigger log_email_activity já registra automaticamente)
      const { data, error } = await supabase
        .from('internal_emails')
        .update({
          claimed_by: null,
          claimed_at: null,
          workflow_status: 'pending'
        })
        .eq('id', emailId)
        .select();

      if (error) {
        console.error('[ReleaseEmail] Erro ao liberar:', error);
        throw new Error(`Erro ao devolver e-mail: ${error.message}`);
      }

      console.log('[ReleaseEmail] E-mail liberado com sucesso:', data);
      return emailId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-box-emails'] });
      queryClient.invalidateQueries({ queryKey: ['shared-box-pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['all-shared-boxes-counts'] });
      queryClient.invalidateQueries({ queryKey: ['internal-email'] });
    }
  });
}

// Hook para marcar como concluído
export function useCompleteEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (emailId: string) => {
      console.log('[CompleteEmail] Concluindo e-mail:', emailId);

      const { data, error } = await supabase
        .from('internal_emails')
        .update({
          workflow_status: 'completed'
        })
        .eq('id', emailId)
        .select();

      if (error) {
        console.error('[CompleteEmail] Erro ao concluir:', error);
        throw new Error(`Erro ao concluir e-mail: ${error.message}`);
      }

      console.log('[CompleteEmail] E-mail concluído com sucesso:', data);
      return emailId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-box-emails'] });
      queryClient.invalidateQueries({ queryKey: ['all-shared-boxes-counts'] });
      queryClient.invalidateQueries({ queryKey: ['internal-email'] });
    }
  });
}

// Hook para buscar histórico de atividades de um e-mail
export function useEmailActivityLog(emailId: string | null) {
  return useQuery({
    queryKey: ['email-activity-log', emailId],
    queryFn: async () => {
      if (!emailId) return [];

      const { data, error } = await supabase
        .from('email_activity_log')
        .select(`
          *,
          actor:profiles(id, full_name, avatar_url)
        `)
        .eq('email_id', emailId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as EmailActivityLog[];
    },
    enabled: !!emailId
  });
}

// Hook para adicionar membro a caixa compartilhada
export function useAddSharedBoxMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sharedBoxId, userId, orderPosition = 0 }: { sharedBoxId: string; userId: string; orderPosition?: number }) => {
      const { error } = await supabase
        .from('email_shared_box_members')
        .insert({
          shared_box_id: sharedBoxId,
          user_id: userId,
          order_position: orderPosition
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-box-members'] });
      queryClient.invalidateQueries({ queryKey: ['user-shared-boxes'] });
    }
  });
}

// Hook para remover membro de caixa compartilhada
export function useRemoveSharedBoxMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sharedBoxId, userId }: { sharedBoxId: string; userId: string }) => {
      const { error } = await supabase
        .from('email_shared_box_members')
        .delete()
        .eq('shared_box_id', sharedBoxId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-box-members'] });
      queryClient.invalidateQueries({ queryKey: ['user-shared-boxes'] });
    }
  });
}
