import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface InternalNote {
  id: string;
  conversation_id: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

export function useInternalNotes(conversationId: string | null) {
  return useQuery({
    queryKey: ['internal-notes', conversationId],
    staleTime: 60000, // OTIMIZAÇÃO: 1 minuto de cache
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!conversationId) return [];
      
      const { data, error } = await supabase
        .from('internal_notes')
        .select(`
          id,
          conversation_id,
          content,
          is_pinned,
          created_at,
          author:profiles!internal_notes_author_id_fkey(id, full_name, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as InternalNote[];
    },
    enabled: !!conversationId,
  });
}

export function useCreateInternalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('internal_notes')
        .insert({
          conversation_id: conversationId,
          content,
          author_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['internal-notes', variables.conversationId] });
      toast.success('Nota interna adicionada');
    },
    onError: () => {
      toast.error('Erro ao adicionar nota');
    },
  });
}

export function useUpdateInternalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, content, conversationId }: { noteId: string; content: string; conversationId: string }) => {
      const { data, error } = await supabase
        .from('internal_notes')
        .update({ content })
        .eq('id', noteId)
        .select()
        .single();

      if (error) throw error;
      return { data, conversationId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['internal-notes', result.conversationId] });
      toast.success('Nota atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar nota');
    },
  });
}

export function useDeleteInternalNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ noteId, conversationId }: { noteId: string; conversationId: string }) => {
      const { error } = await supabase
        .from('internal_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;
      return { conversationId };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['internal-notes', result.conversationId] });
      toast.success('Nota excluída');
    },
    onError: () => {
      toast.error('Erro ao excluir nota');
    },
  });
}
