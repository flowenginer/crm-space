import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface ImportHistoryEntry {
  id: string;
  created_at: string;
  created_by: string | null;
  source_type: string;
  source_name: string;
  total_rows: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  tags_created: number;
  tags_assigned: number;
  status: string;
}

export interface SaveImportHistoryParams {
  source_type: 'file' | 'google_sheets';
  source_name: string;
  total_rows: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  tags_created: number;
  tags_assigned: number;
  status: 'completed' | 'partial' | 'failed';
  log?: Json;
}

export function useImportHistory() {
  const queryClient = useQueryClient();

  const { data: history, isLoading } = useQuery({
    queryKey: ['import-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('import_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data as ImportHistoryEntry[];
    },
    staleTime: 30000,
  });

  const saveHistory = useMutation({
    mutationFn: async (params: SaveImportHistoryParams) => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('import_history')
        .insert([{
          source_type: params.source_type,
          source_name: params.source_name,
          total_rows: params.total_rows,
          processed: params.processed,
          created: params.created,
          updated: params.updated,
          skipped: params.skipped,
          errors: params.errors,
          tags_created: params.tags_created,
          tags_assigned: params.tags_assigned,
          status: params.status,
          log: (params.log || []) as Json,
          created_by: user?.user?.id,
        } as any])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-history'] });
    },
  });

  return {
    history: history || [],
    isLoading,
    saveHistory: saveHistory.mutateAsync,
  };
}
