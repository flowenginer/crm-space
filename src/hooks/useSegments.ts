import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export function useSegments() {
  return useQuery({
    queryKey: ['segments'],
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('segments')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Segment[];
    },
  });
}

export function useAllSegments() {
  return useQuery({
    queryKey: ['segments-all'],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('segments')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Segment[];
    },
  });
}

export function useSegmentCounts() {
  return useQuery({
    queryKey: ['segment-counts'],
    staleTime: 60 * 1000, // 1 minuto
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('segment_id')
        .not('segment_id', 'is', null);

      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(contact => {
        if (contact.segment_id) {
          counts[contact.segment_id] = (counts[contact.segment_id] || 0) + 1;
        }
      });
      
      return counts;
    },
  });
}

export function useCreateSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (segment: { 
      name: string; 
      description?: string | null; 
      color?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('segments')
        .insert({
          ...segment,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Segment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      queryClient.invalidateQueries({ queryKey: ['segments-all'] });
    },
  });
}

export function useUpdateSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...segment }: Partial<Segment> & { id: string }) => {
      const { error } = await supabase
        .from('segments')
        .update(segment)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      queryClient.invalidateQueries({ queryKey: ['segments-all'] });
    },
  });
}

export function useDeleteSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('segments')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      queryClient.invalidateQueries({ queryKey: ['segments-all'] });
      queryClient.invalidateQueries({ queryKey: ['segment-counts'] });
    },
  });
}

export function useUpdateContactSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, segmentId }: { contactId: string; segmentId: string | null }) => {
      const { error } = await supabase
        .from('contacts')
        .update({ 
          segment_id: segmentId,
          updated_at: new Date().toISOString()
        })
        .eq('id', contactId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversation-details'] });
      queryClient.invalidateQueries({ queryKey: ['conversations-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['segment-counts'] });
    },
  });
}
