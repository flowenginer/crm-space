import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useMemo } from 'react';

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
  // Filtro de última mensagem do cliente
  lastClientMessageDaysAgo?: number;
}

export interface ScheduleOverride {
  start: string;  // HH:mm
  end: string;    // HH:mm
  days: number[]; // 0=domingo, 1=segunda, ..., 6=sábado
  timezone: string;
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
  skipped_count: number;
  created_by: string | null;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  schedule_enabled: boolean;
  schedule_override: ScheduleOverride | null;
  campaign_type: 'followup' | 'marketing' | null;
  marketing_campaign_id: string | null;
  // Joined data
  template?: { id: string; title: string };
  channel?: { id: string; name: string };
  creator?: { id: string; full_name: string };
  marketing_campaign?: { id: string; title: string };
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
          creator:profiles!bulk_dispatches_created_by_fkey(id, full_name),
          marketing_campaign:marketing_campaigns(id, title)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        filters: (item.filters as BulkDispatchFilters) || {},
        schedule_override: (item.schedule_override as unknown as ScheduleOverride) || null,
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
          creator:profiles!bulk_dispatches_created_by_fkey(id, full_name),
          marketing_campaign:marketing_campaigns(id, title)
        `)
        .eq('id', id!)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        filters: (data.filters as BulkDispatchFilters) || {},
        schedule_override: (data.schedule_override as unknown as ScheduleOverride) || null,
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

// Helper: aplicar filtros base a uma query de contacts
async function applyBaseFilters(filters: BulkDispatchFilters) {
  // Se há filtro de leadStatusIds, primeiro buscar os nomes dos status
  let leadStatusNames: string[] = [];
  if (filters.leadStatusIds && filters.leadStatusIds.length > 0) {
    const { data: statusData } = await supabase
      .from('lead_statuses')
      .select('name')
      .in('id', filters.leadStatusIds);
    leadStatusNames = statusData?.map(s => s.name) || [];
  }
  
  return { leadStatusNames };
}

// Helper: construir query base com filtros
function buildContactsQuery(filters: BulkDispatchFilters, leadStatusNames: string[], selectFields: string) {
  let query = supabase
    .from('contacts')
    .select(selectFields)
    .order('full_name', { ascending: true });

  // Aplicar filtros
  if (filters.firstContactStart) {
    query = query.gte('first_contact_at', filters.firstContactStart);
  }
  if (filters.firstContactEnd) {
    query = query.lte('first_contact_at', filters.firstContactEnd + 'T23:59:59');
  }
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

  return query;
}

// Helper para preparar parâmetros da RPC
async function prepareRpcParams(filters: BulkDispatchFilters) {
  const { data: tenantId } = await supabase.rpc('get_user_tenant_id');
  const { leadStatusNames } = await applyBaseFilters(filters);
  
  return {
    p_tenant_id: tenantId,
    p_lead_status_names: leadStatusNames.length > 0 ? leadStatusNames : null,
    p_last_client_message_days_ago: filters.lastClientMessageDaysAgo || null,
    p_tag_ids: filters.tagIds?.length ? filters.tagIds : null,
    p_conversation_statuses: filters.conversationStatus?.length ? filters.conversationStatus : null,
    p_segment_id: filters.segmentId || null,
    p_origin: filters.origin || null,
    p_assigned_to: filters.assignedTo?.length ? filters.assignedTo : null,
    p_department_ids: filters.departmentIds?.length ? filters.departmentIds : null,
    p_contact_type: filters.contactType || null,
    p_include_blocked: filters.includeBlocked || false,
    p_first_contact_start: filters.firstContactStart || null,
    p_first_contact_end: filters.firstContactEnd ? filters.firstContactEnd + 'T23:59:59' : null,
  };
}

// Contagem EXATA de contatos via RPC (tudo server-side)
export function usePreviewContactsCount(filters: BulkDispatchFilters, enabled: boolean = true) {
  return useQuery({
    queryKey: ['bulk-dispatch-preview-count', filters],
    enabled,
    queryFn: async () => {
      const params = await prepareRpcParams(filters);
      
      const { data, error } = await supabase.rpc('get_bulk_dispatch_preview_count', params);
      
      if (error) throw error;
      return Number(data) || 0;
    },
  });
}

// Preview de contatos com SCROLL INFINITO (paginado via RPC)
const PREVIEW_PAGE_SIZE = 100;

export function useInfinitePreviewContacts(filters: BulkDispatchFilters, enabled: boolean = true) {
  return useInfiniteQuery({
    queryKey: ['bulk-dispatch-preview-infinite', filters],
    enabled,
    initialPageParam: 0,
    getNextPageParam: (lastPage: PreviewContact[], allPages) => {
      if (lastPage.length < PREVIEW_PAGE_SIZE) return undefined;
      return allPages.length * PREVIEW_PAGE_SIZE;
    },
    queryFn: async ({ pageParam = 0 }) => {
      const params = await prepareRpcParams(filters);
      
      const { data, error } = await supabase.rpc('get_bulk_dispatch_preview_contacts', {
        ...params,
        p_offset_val: pageParam,
        p_limit_val: PREVIEW_PAGE_SIZE,
      });
      
      if (error) throw error;
      return (data || []) as PreviewContact[];
    },
  });
}

// Hook de compatibilidade - retorna todos os contatos carregados do infinite query
export function usePreviewContacts(filters: BulkDispatchFilters, enabled: boolean = true) {
  const infiniteQuery = useInfinitePreviewContacts(filters, enabled);
  
  const allContacts = useMemo((): PreviewContact[] => {
    return (infiniteQuery.data?.pages.flat() || []) as PreviewContact[];
  }, [infiniteQuery.data]);

  return {
    ...infiniteQuery,
    data: allContacts,
    isLoading: infiniteQuery.isLoading,
  };
}

// Criar campanha - agora só envia filtros, backend gera os contatos
export function useCreateBulkDispatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      template_id: string | null;
      channel_id: string;
      filters: BulkDispatchFilters;
      interval_seconds: number;
      totalContacts: number; // Total exato vindo do COUNT
      schedule_enabled?: boolean;
      schedule_override?: ScheduleOverride | null;
      campaign_type?: 'followup' | 'marketing';
      marketing_campaign_id?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Criar a campanha com filtros - backend vai gerar os contatos
      const channelIdValue = data.channel_id === '__existing__' ? null : data.channel_id;
      
      const { data: dispatch, error: dispatchError } = await supabase
        .from('bulk_dispatches')
        .insert({
          name: data.name,
          template_id: data.campaign_type === 'marketing' ? null : data.template_id,
          channel_id: channelIdValue,
          filters: data.filters as any,
          interval_seconds: data.interval_seconds,
          total_contacts: data.totalContacts,
          created_by: user?.id,
          schedule_enabled: data.schedule_enabled ?? true,
          schedule_override: data.schedule_override as any,
          campaign_type: data.campaign_type || 'followup',
          marketing_campaign_id: data.marketing_campaign_id || null,
        })
        .select()
        .single();

      if (dispatchError) throw dispatchError;

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

// Excluir múltiplas campanhas
export function useDeleteBulkDispatches() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dispatchIds: string[]) => {
      // Deletar contatos de todos os dispatches
      const { error: contactsError } = await supabase
        .from('bulk_dispatch_contacts')
        .delete()
        .in('dispatch_id', dispatchIds);

      if (contactsError) throw contactsError;

      // Deletar os dispatches
      const { error } = await supabase
        .from('bulk_dispatches')
        .delete()
        .in('id', dispatchIds);

      if (error) throw error;
      return dispatchIds;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulk-dispatches'] });
    },
  });
}
// Excluir campanha única (apenas concluídas ou canceladas)
export function useDeleteBulkDispatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dispatchId: string) => {
      // Primeiro deletar os contatos associados
      const { error: contactsError } = await supabase
        .from('bulk_dispatch_contacts')
        .delete()
        .eq('dispatch_id', dispatchId);

      if (contactsError) throw contactsError;

      // Depois deletar o dispatch
      const { error } = await supabase
        .from('bulk_dispatches')
        .delete()
        .eq('id', dispatchId);

      if (error) throw error;
      return dispatchId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bulk-dispatches'] });
    },
  });
}

// Realtime subscription para métricas de um dispatch específico
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

// Realtime subscription para TODA a lista de dispatches (sem filtro de ID)
export function useBulkDispatchesRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('bulk-dispatches-all')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bulk_dispatches',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['bulk-dispatches'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
