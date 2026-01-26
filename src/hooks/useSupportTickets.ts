import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  SupportTicket, 
  TicketComment, 
  CreateTicketData, 
  UpdateTicketData,
  SupportDashboardMetrics,
  TechnicianRanking,
  TicketsByTenant,
  TicketsEvolution,
  SupportTechnician,
  TicketStatus
} from '@/types/support';
import { useAuth } from '@/hooks/useAuth';

// Check if current user is a support technician
export function useIsSupportTechnician() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['support-technician-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .from('support_technicians')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) throw error;
      return !!data;
    },
    enabled: !!user?.id,
  });
}

// List support tickets
export function useSupportTickets(filters?: {
  status?: TicketStatus;
  tenantId?: string;
  assignedTo?: string;
}) {
  return useQuery({
    queryKey: ['support-tickets', filters],
    queryFn: async () => {
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          requester:profiles!support_tickets_requester_id_fkey(id, full_name, avatar_url),
          assignee:profiles!support_tickets_assigned_to_fkey(id, full_name, avatar_url),
          tenant:tenants(id, name)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.tenantId) {
        query = query.eq('tenant_id', filters.tenantId);
      }
      if (filters?.assignedTo) {
        query = query.eq('assigned_to', filters.assignedTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as SupportTicket[];
    },
  });
}

// Get single ticket
export function useSupportTicket(ticketId: string | null) {
  return useQuery({
    queryKey: ['support-ticket', ticketId],
    queryFn: async () => {
      if (!ticketId) return null;
      
      const { data, error } = await supabase
        .from('support_tickets')
        .select(`
          *,
          requester:profiles!support_tickets_requester_id_fkey(id, full_name, avatar_url),
          assignee:profiles!support_tickets_assigned_to_fkey(id, full_name, avatar_url),
          tenant:tenants(id, name)
        `)
        .eq('id', ticketId)
        .single();

      if (error) throw error;
      return data as unknown as SupportTicket;
    },
    enabled: !!ticketId,
  });
}

// Get ticket comments
export function useTicketComments(ticketId: string | null) {
  return useQuery({
    queryKey: ['ticket-comments', ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      
      const { data, error } = await supabase
        .from('ticket_comments')
        .select(`
          *,
          author:profiles!ticket_comments_author_id_fkey(id, full_name, avatar_url)
        `)
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as unknown as TicketComment[];
    },
    enabled: !!ticketId,
  });
}

// Create ticket
export function useCreateTicket() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();

  return useMutation({
    mutationFn: async (data: CreateTicketData) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const browserInfo = navigator.userAgent;
      
      const { data: result, error } = await supabase
        .from('support_tickets')
        .insert({
          ...data,
          requester_id: user.id,
          browser_info: browserInfo,
          requester_role: profile?.role || null,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      toast({
        title: 'Ticket criado',
        description: `Ticket #${data.ticket_number} criado com sucesso.`,
      });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao criar ticket',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update ticket
export function useUpdateTicket() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ticketId, data }: { ticketId: string; data: UpdateTicketData }) => {
      const { data: result, error } = await supabase
        .from('support_tickets')
        .update(data)
        .eq('id', ticketId)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      toast({
        title: 'Ticket atualizado',
        description: 'As alterações foram salvas.',
      });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['support-ticket'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar ticket',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Add comment
export function useAddComment() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ ticketId, content, isInternal = false }: { 
      ticketId: string; 
      content: string; 
      isInternal?: boolean 
    }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: ticketId,
          author_id: user.id,
          content,
          is_internal: isInternal,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Comentário adicionado',
      });
      queryClient.invalidateQueries({ queryKey: ['ticket-comments'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao adicionar comentário',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Dashboard metrics (technicians only)
export function useSupportDashboardMetrics(dateFrom?: Date, dateTo?: Date) {
  return useQuery({
    queryKey: ['support-dashboard-metrics', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_support_dashboard_metrics', {
        p_date_from: dateFrom?.toISOString() || null,
        p_date_to: dateTo?.toISOString() || null,
      }) as { data: SupportDashboardMetrics | null; error: Error | null };

      if (error) throw error;
      return data as SupportDashboardMetrics;
    },
  });
}

// Technician ranking (technicians only)
export function useTechnicianRanking(dateFrom?: Date, dateTo?: Date) {
  return useQuery({
    queryKey: ['technician-ranking', dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_technician_ranking', {
        p_date_from: dateFrom?.toISOString() || null,
        p_date_to: dateTo?.toISOString() || null,
      });

      if (error) throw error;
      return data as TechnicianRanking[];
    },
  });
}

// Tickets by tenant (technicians only)
export function useTicketsByTenant() {
  return useQuery({
    queryKey: ['tickets-by-tenant'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tickets_by_tenant');

      if (error) throw error;
      return data as TicketsByTenant[];
    },
  });
}

// Tickets evolution (technicians only)
export function useTicketsEvolution(months: number = 6) {
  return useQuery({
    queryKey: ['tickets-evolution', months],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_tickets_evolution', {
        p_months: months,
      });

      if (error) throw error;
      return data as TicketsEvolution[];
    },
  });
}

// List support technicians
export function useSupportTechnicians() {
  return useQuery({
    queryKey: ['support-technicians'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_technicians')
        .select(`
          *,
          profile:profiles!support_technicians_user_id_fkey(id, full_name, avatar_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as SupportTechnician[];
    },
  });
}

// Add technician (super admin only)
export function useAddTechnician() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, specialties }: { userId: string; specialties?: string[] }) => {
      const { data, error } = await supabase
        .from('support_technicians')
        .insert({
          user_id: userId,
          specialties,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Técnico adicionado',
        description: 'O usuário agora é um técnico de suporte.',
      });
      queryClient.invalidateQueries({ queryKey: ['support-technicians'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao adicionar técnico',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Remove technician (super admin only)
export function useRemoveTechnician() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (technicianId: string) => {
      const { error } = await supabase
        .from('support_technicians')
        .delete()
        .eq('id', technicianId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: 'Técnico removido',
      });
      queryClient.invalidateQueries({ queryKey: ['support-technicians'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao remover técnico',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
