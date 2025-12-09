import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LeadStatus {
  id: string;
  name: string;
  order_position: number;
  color: string | null;
  is_active: boolean | null;
  created_at: string;
}

export interface ContactForKanban {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  avatar_url: string | null;
  lead_status: string | null;
  assigned_to: string | null;
  updated_at: string;
  negotiated_value: number | null;
  assignee?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface LeadStatusSummary {
  lead_status: string;
  contact_count: number;
  total_value: number;
}

// Fetch all lead statuses
export function useLeadStatuses() {
  return useQuery({
    queryKey: ['lead-statuses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_statuses')
        .select('*')
        .eq('is_active', true)
        .order('order_position');

      if (error) throw error;
      return data as LeadStatus[];
    },
    staleTime: 60000,
  });
}

// Fetch aggregated counts and values per lead status (filtered by user permission)
export function useLeadStatusSummary() {
  return useQuery({
    queryKey: ['lead-status-summary'],
    queryFn: async () => {
      // Get current user ID
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      // Call RPC with user_id - the function handles permission check
      const { data, error } = await supabase.rpc('get_lead_status_summary', {
        _user_id: userId
      });
      if (error) throw error;
      
      // Transform to a map for easy lookup
      const summaryMap: Record<string, LeadStatusSummary> = {};
      (data as LeadStatusSummary[]).forEach(item => {
        summaryMap[item.lead_status] = {
          lead_status: item.lead_status,
          contact_count: Number(item.contact_count),
          total_value: Number(item.total_value),
        };
      });
      
      return summaryMap;
    },
    staleTime: 30000,
  });
}

// Create a new lead status
export function useCreateLeadStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; color: string; order_position: number }) => {
      const { data: result, error } = await supabase
        .from('lead_statuses')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['lead-status-summary'] });
    },
  });
}

// Update a lead status
export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; color?: string; order_position?: number; is_active?: boolean }) => {
      const { error } = await supabase
        .from('lead_statuses')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['lead-status-summary'] });
    },
  });
}

// Delete a lead status
export function useDeleteLeadStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('lead_statuses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-statuses'] });
      queryClient.invalidateQueries({ queryKey: ['lead-status-summary'] });
    },
  });
}

// Helper to check if user can view all data (admin/supervisor)
async function canViewAllData(): Promise<{ canViewAll: boolean; userId: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { canViewAll: false, userId: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const canViewAll = profile?.role === 'admin' || profile?.role === 'supervisor';
  return { canViewAll, userId: user.id };
}

// Fetch contacts for a specific lead status with limit (filtered by user permission)
// Somente retorna contatos que têm pelo menos uma conversa ativa (open/pending)
export function useContactsByLeadStatus(statusName?: string | null, limit = 20) {
  return useQuery({
    queryKey: ['contacts-for-kanban', statusName, limit],
    queryFn: async () => {
      const { canViewAll, userId } = await canViewAllData();

      // Primeiro buscar IDs de contatos com conversas ativas
      let conversationsQuery = supabase
        .from('conversations')
        .select('contact_id')
        .in('status', ['open', 'pending']);
      
      const { data: activeConversations, error: convError } = await conversationsQuery;
      if (convError) throw convError;
      
      // Extrair IDs únicos de contatos com conversas ativas
      const activeContactIds = [...new Set(activeConversations?.map(c => c.contact_id) || [])];
      
      // Se não há contatos com conversas ativas, retornar array vazio
      if (activeContactIds.length === 0) {
        return [] as ContactForKanban[];
      }

      let query = supabase
        .from('contacts')
        .select(`
          id,
          full_name,
          phone,
          email,
          avatar_url,
          lead_status,
          assigned_to,
          updated_at,
          negotiated_value,
          assignee:profiles!contacts_assigned_to_fkey(
            id,
            full_name,
            avatar_url
          )
        `)
        .in('id', activeContactIds) // Só contatos com conversas ativas
        .order('updated_at', { ascending: false })
        .limit(limit);

      // Filter by assigned_to for non-admin users
      if (!canViewAll && userId) {
        query = query.eq('assigned_to', userId);
      }

      // Handle the special "__no_status__" case
      if (statusName === '__no_status__') {
        query = query.is('lead_status', null);
      } else if (statusName) {
        query = query.eq('lead_status', statusName);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ContactForKanban[];
    },
    enabled: statusName !== undefined,
    staleTime: 30000,
  });
}

// Update contact lead status (move on kanban)
export function useUpdateContactLeadStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, leadStatus }: { contactId: string; leadStatus: string }) => {
      const { error } = await supabase
        .from('contacts')
        .update({ 
          lead_status: leadStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts-for-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['lead-status-summary'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-details'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
    },
  });
}
