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
  conversation_id: string | null;
  unread_count: number;
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
      // Obter tenant_id do usuário logado
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile?.tenant_id) {
        throw new Error('Tenant não encontrado');
      }

      const { data: result, error } = await supabase
        .from('lead_statuses')
        .insert({
          ...data,
          tenant_id: profile.tenant_id, // CRÍTICO: Incluir tenant_id
        })
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

// NEW: Optimized hook to fetch ALL kanban contacts at once
export function useAllKanbanContacts(limitPerStatus = 20) {
  return useQuery({
    queryKey: ['all-kanban-contacts', limitPerStatus],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.rpc('get_kanban_contacts_optimized', {
        _user_id: user?.id,
        _limit_per_status: limitPerStatus
      });
      
      if (error) throw error;
      
      // Group contacts by lead_status
      const grouped: Record<string, ContactForKanban[]> = {};
      
      (data || []).forEach((row: {
        contact_id: string;
        full_name: string;
        phone: string;
        email: string | null;
        avatar_url: string | null;
        lead_status: string;
        assigned_to: string | null;
        updated_at: string;
        negotiated_value: number | null;
        assignee_id: string | null;
        assignee_name: string | null;
        assignee_avatar: string | null;
        conversation_id: string | null;
        unread_count: number;
      }) => {
        const status = row.lead_status || '__no_status__';
        if (!grouped[status]) grouped[status] = [];
        
        grouped[status].push({
          id: row.contact_id,
          full_name: row.full_name,
          phone: row.phone,
          email: row.email,
          avatar_url: row.avatar_url,
          lead_status: row.lead_status === '__no_status__' ? null : row.lead_status,
          assigned_to: row.assigned_to,
          updated_at: row.updated_at,
          negotiated_value: row.negotiated_value,
          conversation_id: row.conversation_id,
          unread_count: row.unread_count || 0,
          assignee: row.assignee_id ? {
            id: row.assignee_id,
            full_name: row.assignee_name,
            avatar_url: row.assignee_avatar
          } : null
        });
      });
      
      return grouped;
    },
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
          lead_status: leadStatus || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-kanban-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['lead-status-summary'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-details'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
    },
  });
}
