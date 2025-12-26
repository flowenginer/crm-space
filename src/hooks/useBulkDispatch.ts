import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface BulkDispatchFilters {
  firstContactStart?: string;
  firstContactEnd?: string;
  leadStatusIds?: string[];
  tagIds?: string[];
  segmentId?: string;
  origin?: string;
  conversationStatus?: ('open' | 'closed' | 'pending')[];
  assignedTo?: string[];
  departmentIds?: string[];
  contactType?: 'customer' | 'lead' | 'supplier';
  includeBlocked?: boolean;
}

export interface BulkDispatch {
  id: string;
  name: string;
  template_id: string;
  channel_id: string | null;
  filters: BulkDispatchFilters;
  interval_seconds: number;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  total_contacts: number;
  processed_count: number;
  sent_count: number;
  error_count: number;
  responded_count: number;
  created_by: string | null;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  template?: { id: string; title: string };
  channel?: { id: string; name: string };
  creator?: { id: string; full_name: string };
}

export interface BulkDispatchContact {
  id: string;
  dispatch_id: string;
  contact_id: string;
  conversation_id: string | null;
  active_rescue_id: string | null;
  status: 'pending' | 'sending' | 'sent' | 'responded' | 'error' | 'skipped';
  error_message: string | null;
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
  // Joined data
  contact?: {
    id: string;
    full_name: string;
    phone: string;
    avatar_url: string | null;
  };
}

export interface PreviewContact {
  id: string;
  full_name: string;
  phone: string;
  avatar_url: string | null;
  lead_status: string | null;
  last_interaction_at: string | null;
}

// Buscar todas as campanhas
export function useBulkDispatches() {
  return useQuery({
    queryKey: ['bulk-dispatches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bulk_dispatches')
        .select(`
          *,
          template:rescue_templates(id, title),
          channel:whatsapp_channels(id, name),
          creator:profiles!bulk_dispatches_created_by_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        filters: (item.filters as BulkDispatchFilters) || {},
      })) as BulkDispatch[];
    },
  });
}

// Buscar uma campanha específica
export function useBulkDispatch(id: string | null) {
  return useQuery({
    queryKey: ['bulk-dispatch', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bulk_dispatches')
        .select(`
          *,
          template:rescue_templates(id, title),
          channel:whatsapp_channels(id, name),
          creator:profiles!bulk_dispatches_created_by_fkey(id, full_name)
        `)
        .eq('id', id!)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        filters: (data.filters as BulkDispatchFilters) || {},
      } as BulkDispatch;
    },
  });
}

// Buscar contatos de uma campanha
export function useBulkDispatchContacts(dispatchId: string | null) {
  return useQuery({
    queryKey: ['bulk-dispatch-contacts', dispatchId],
    enabled: !!dispatchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bulk_dispatch_contacts')
        .select(`
          *,
          contact:contacts(id, full_name, phone, avatar_url)
        `)
        .eq('dispatch_id', dispatchId!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as BulkDispatchContact[];
    },
  });
}

// Preview de contatos baseado nos filtros
export function usePreviewContacts(filters: BulkDispatchFilters, enabled: boolean = true) {
  return useQuery({
    queryKey: ['bulk-dispatch-preview', filters],
    enabled,
    queryFn: async () => {
      // Se há filtro de leadStatusIds, primeiro buscar os nomes dos status
      let leadStatusNames: string[] = [];
      if (filters.leadStatusIds && filters.leadStatusIds.length > 0) {
        const { data: statusData } = await supabase
          .from('lead_statuses')
          .select('name')
          .in('id', filters.leadStatusIds);
        leadStatusNames = statusData?.map(s => s.name) || [];
      }

      let query = supabase
        .from('contacts')
        .select('id, full_name, phone, avatar_url, lead_status, last_interaction_at')
        .order('full_name', { ascending: true });

      // Aplicar filtros
      if (filters.firstContactStart) {
        query = query.gte('first_contact_at', filters.firstContactStart);
      }
      if (filters.firstContactEnd) {
        query = query.lte('first_contact_at', filters.firstContactEnd + 'T23:59:59');
      }
      // Filtrar por NOMES dos status (não IDs)
      if (leadStatusNames.length > 0) {
        query = query.in('lead_status', leadStatusNames);
      }
      if (filters.segmentId) {
        query = query.eq('segment_id', filters.segmentId);
      }
      if (filters.origin) {
        query = query.eq('origin', filters.origin);
      }
      if (filters.assignedTo && filters.assignedTo.length > 0) {
        query = query.in('assigned_to', filters.assignedTo);
      }
      if (filters.departmentIds && filters.departmentIds.length > 0) {
        query = query.in('department_id', filters.departmentIds);
      }
      if (filters.contactType) {
        query = query.eq('contact_type', filters.contactType);
      }
      if (!filters.includeBlocked) {
        query = query.eq('is_blocked', false);
      }

      // Buscar TODOS os contatos usando paginação automática (sem limite)
      const PAGE_SIZE = 1000;
      let allContacts: PreviewContact[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;

        if (data && data.length > 0) {
          allContacts = [...allContacts, ...data];
          offset += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      let contacts = allContacts as PreviewContact[];

      // Filtrar por tags (se especificado)
      if (filters.tagIds && filters.tagIds.length > 0) {
        const { data: taggedContacts } = await supabase
          .from('contact_tags')
          .select('contact_id')
          .in('tag_id', filters.tagIds);
        
        const taggedIds = new Set(taggedContacts?.map(tc => tc.contact_id) || []);
        contacts = contacts.filter(c => taggedIds.has(c.id));
      }

      // Filtrar por status de conversa (se especificado)
      if (filters.conversationStatus && filters.conversationStatus.length > 0) {
        const { data: conversations } = await supabase
          .from('conversations')
          .select('contact_id, status')
          .in('status', filters.conversationStatus);
        
        const contactsWithStatus = new Set(conversations?.map(c => c.contact_id) || []);
        contacts = contacts.filter(c => contactsWithStatus.has(c.id));
      }

      return contacts;
    },
  });
}

// Contar contatos para preview rápido
export function usePreviewContactsCount(filters: BulkDispatchFilters, enabled: boolean = true) {
  const { data: contacts, isLoading } = usePreviewContacts(filters, enabled);
  return {
    count: contacts?.length || 0,
    isLoading,
  };
}

// Criar campanha
export function useCreateBulkDispatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      template_id: string;
      channel_id: string;
      filters: BulkDispatchFilters;
      interval_seconds: number;
      contacts: PreviewContact[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Criar a campanha
      // Se channel_id for '__existing__', enviar null para indicar uso do canal existente
      const channelIdValue = data.channel_id === '__existing__' ? null : data.channel_id;
      
      const { data: dispatch, error: dispatchError } = await supabase
        .from('bulk_dispatches')
        .insert({
          name: data.name,
          template_id: data.template_id,
          channel_id: channelIdValue,
          filters: data.filters as any,
          interval_seconds: data.interval_seconds,
          total_contacts: data.contacts.length,
          created_by: user?.id,
        })
        .select()
        .single();

      if (dispatchError) throw dispatchError;

      // Inserir contatos
      if (data.contacts.length > 0) {
        const contactsToInsert = data.contacts.map(c => ({
          dispatch_id: dispatch.id,
          contact_id: c.id,
        }));

        const { error: contactsError } = await supabase
          .from('bulk_dispatch_contacts')
          .insert(contactsToInsert);

        if (contactsError) throw contactsError;
      }

      return dispatch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulk-dispatches'] });
    },
  });
}

// Iniciar campanha
export function useStartBulkDispatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dispatchId: string) => {
      // Atualizar status
      const { error } = await supabase
        .from('bulk_dispatches')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .eq('id', dispatchId);

      if (error) throw error;

      // Chamar edge function para processar
      await supabase.functions.invoke('process-bulk-dispatch', {
        body: { dispatchId },
      });

      return dispatchId;
    },
    onSuccess: (dispatchId) => {
      queryClient.invalidateQueries({ queryKey: ['bulk-dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['bulk-dispatch', dispatchId] });
    },
  });
}

// Pausar campanha
export function usePauseBulkDispatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dispatchId: string) => {
      const { error } = await supabase
        .from('bulk_dispatches')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
        })
        .eq('id', dispatchId);

      if (error) throw error;
      return dispatchId;
    },
    onSuccess: (dispatchId) => {
      queryClient.invalidateQueries({ queryKey: ['bulk-dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['bulk-dispatch', dispatchId] });
    },
  });
}

// Retomar campanha
export function useResumeBulkDispatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dispatchId: string) => {
      const { error } = await supabase
        .from('bulk_dispatches')
        .update({
          status: 'running',
          paused_at: null,
        })
        .eq('id', dispatchId);

      if (error) throw error;

      // Chamar edge function para continuar processando
      await supabase.functions.invoke('process-bulk-dispatch', {
        body: { dispatchId },
      });

      return dispatchId;
    },
    onSuccess: (dispatchId) => {
      queryClient.invalidateQueries({ queryKey: ['bulk-dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['bulk-dispatch', dispatchId] });
    },
  });
}

// Cancelar campanha
export function useCancelBulkDispatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dispatchId: string) => {
      const { error } = await supabase
        .from('bulk_dispatches')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        })
        .eq('id', dispatchId);

      if (error) throw error;
      return dispatchId;
    },
    onSuccess: (dispatchId) => {
      queryClient.invalidateQueries({ queryKey: ['bulk-dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['bulk-dispatch', dispatchId] });
    },
  });
}

// Realtime subscription para métricas
export function useBulkDispatchRealtime(dispatchId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!dispatchId) return;

    const channel = supabase
      .channel(`bulk-dispatch-${dispatchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bulk_dispatches',
          filter: `id=eq.${dispatchId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['bulk-dispatch', dispatchId] });
          queryClient.invalidateQueries({ queryKey: ['bulk-dispatches'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bulk_dispatch_contacts',
          filter: `dispatch_id=eq.${dispatchId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['bulk-dispatch-contacts', dispatchId] });
          queryClient.invalidateQueries({ queryKey: ['bulk-dispatch', dispatchId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dispatchId, queryClient]);
}
