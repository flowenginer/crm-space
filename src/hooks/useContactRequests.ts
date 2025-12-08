import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ContactRequest {
  id: string;
  contact_id: string;
  conversation_id: string | null;
  requester_id: string;
  current_owner_id: string | null;
  request_type: 'owner' | 'attendant';
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  response_note: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  contact?: {
    id: string;
    full_name: string;
    phone: string;
  };
  requester?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  current_owner?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  responder?: {
    id: string;
    full_name: string;
  };
}

// Lista requisições (para admin/supervisor)
export function useContactRequests(status?: 'pending' | 'approved' | 'rejected') {
  return useQuery({
    queryKey: ['contact-requests', status],
    staleTime: 30000,
    queryFn: async () => {
      let query = supabase
        .from('contact_requests')
        .select(`
          *,
          contact:contacts(id, full_name, phone),
          requester:profiles!contact_requests_requester_id_fkey(id, full_name, avatar_url),
          current_owner:profiles!contact_requests_current_owner_id_fkey(id, full_name, avatar_url),
          responder:profiles!contact_requests_responded_by_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ContactRequest[];
    },
  });
}

// Lista minhas requisições
export function useMyContactRequests() {
  return useQuery({
    queryKey: ['my-contact-requests'],
    staleTime: 30000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('contact_requests')
        .select(`
          *,
          contact:contacts(id, full_name, phone),
          current_owner:profiles!contact_requests_current_owner_id_fkey(id, full_name, avatar_url)
        `)
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ContactRequest[];
    },
  });
}

// Conta requisições pendentes (para badge no menu)
export function usePendingRequestsCount() {
  return useQuery({
    queryKey: ['pending-requests-count'],
    staleTime: 30000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('contact_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      return count || 0;
    },
  });
}

// Verifica se já existe requisição pendente para um contato
export function useExistingRequest(contactId?: string) {
  return useQuery({
    queryKey: ['existing-request', contactId],
    enabled: !!contactId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('contact_requests')
        .select('*')
        .eq('contact_id', contactId!)
        .eq('requester_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

// Criar requisição
export function useCreateContactRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: {
      contact_id: string;
      conversation_id?: string | null;
      current_owner_id?: string | null;
      request_type: 'owner' | 'attendant';
      reason: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('contact_requests')
        .insert({
          ...request,
          requester_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-contact-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests-count'] });
      toast.success('Requisição enviada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao enviar requisição');
    },
  });
}

// Aprovar requisição
export function useApproveContactRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      requestId, 
      responseNote 
    }: { 
      requestId: string; 
      responseNote?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar a requisição
      const { data: request, error: fetchError } = await supabase
        .from('contact_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      // Atualizar status da requisição
      const { error: updateError } = await supabase
        .from('contact_requests')
        .update({
          status: 'approved',
          response_note: responseNote,
          responded_by: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // Se tipo = owner, transferir contato
      if (request.request_type === 'owner') {
        const { error: contactError } = await supabase
          .from('contacts')
          .update({ assigned_to: request.requester_id })
          .eq('id', request.contact_id);

        if (contactError) throw contactError;

        // Transferir conversa também, se houver
        if (request.conversation_id) {
          const { error: convError } = await supabase
            .from('conversations')
            .update({ 
              assigned_to: request.requester_id,
              transferred_at: new Date().toISOString(),
              transferred_from: request.current_owner_id,
              transfer_note: `Requisição aprovada: ${responseNote || 'Sem observação'}`
            })
            .eq('id', request.conversation_id);

          if (convError) throw convError;
        }
      } else {
        // Se tipo = attendant, apenas atribuir a conversa
        if (request.conversation_id) {
          const { error: convError } = await supabase
            .from('conversations')
            .update({ 
              assigned_to: request.requester_id,
              transferred_at: new Date().toISOString(),
              transferred_from: request.current_owner_id,
              transfer_note: `Atendimento temporário: ${responseNote || 'Sem observação'}`
            })
            .eq('id', request.conversation_id);

          if (convError) throw convError;
        }
      }

      return request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests-count'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Requisição aprovada');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao aprovar requisição');
    },
  });
}

// Rejeitar requisição
export function useRejectContactRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      requestId, 
      responseNote 
    }: { 
      requestId: string; 
      responseNote?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('contact_requests')
        .update({
          status: 'rejected',
          response_note: responseNote,
          responded_by: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact-requests'] });
      queryClient.invalidateQueries({ queryKey: ['pending-requests-count'] });
      toast.success('Requisição rejeitada');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao rejeitar requisição');
    },
  });
}
