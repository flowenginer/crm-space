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
  assignee?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
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
    },
  });
}

// Fetch contacts grouped by lead status for Kanban
export function useContactsByLeadStatus() {
  return useQuery({
    queryKey: ['contacts-for-kanban'],
    queryFn: async () => {
      const { data, error } = await supabase
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
          assignee:profiles!contacts_assigned_to_fkey(
            id,
            full_name,
            avatar_url
          )
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      return data as ContactForKanban[];
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
          lead_status: leadStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts-for-kanban'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-details'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
    },
  });
}
