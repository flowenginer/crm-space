import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AdMessagePattern {
  id: string;
  pattern: string;
  match_type: 'exact' | 'contains' | 'starts_with' | 'ends_with';
  source: 'meta_ads' | 'google_ads' | 'linktree' | 'site' | 'instagram' | 'facebook' | 'other';
  campaign_name: string | null;
  description: string | null;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export type CreateAdMessagePattern = Omit<AdMessagePattern, 'id' | 'created_at' | 'updated_at'>;
export type UpdateAdMessagePattern = Partial<CreateAdMessagePattern>;

export function useAdMessagePatterns() {
  return useQuery({
    queryKey: ['ad-message-patterns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ad_message_patterns')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as AdMessagePattern[];
    },
  });
}

export function useCreateAdMessagePattern() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pattern: CreateAdMessagePattern) => {
      const { data, error } = await supabase
        .from('ad_message_patterns')
        .insert(pattern as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-message-patterns'] });
      toast.success('Padrão de mensagem criado com sucesso');
    },
    onError: (error) => {
      console.error('Error creating pattern:', error);
      toast.error('Erro ao criar padrão de mensagem');
    },
  });
}

export function useUpdateAdMessagePattern() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateAdMessagePattern & { id: string }) => {
      const { data, error } = await supabase
        .from('ad_message_patterns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-message-patterns'] });
      toast.success('Padrão de mensagem atualizado');
    },
    onError: (error) => {
      console.error('Error updating pattern:', error);
      toast.error('Erro ao atualizar padrão');
    },
  });
}

export function useDeleteAdMessagePattern() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ad_message_patterns')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ad-message-patterns'] });
      toast.success('Padrão de mensagem removido');
    },
    onError: (error) => {
      console.error('Error deleting pattern:', error);
      toast.error('Erro ao remover padrão');
    },
  });
}

export function useDetectOriginByPattern() {
  return useMutation({
    mutationFn: async (message: string) => {
      const { data, error } = await supabase
        .rpc('detect_origin_by_message_pattern', { p_message: message });

      if (error) throw error;
      return data as { source: string; pattern_id: string; campaign_name: string | null }[] | null;
    },
  });
}
