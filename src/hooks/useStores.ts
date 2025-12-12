import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from './useTenant';
import { toast } from 'sonner';

export interface Store {
  id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useStores() {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['stores', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Store[];
    },
    enabled: !!tenantId,
  });
}

export function useActiveStores() {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['stores-active', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Store[];
    },
    enabled: !!tenantId,
  });
}

export function useCreateStore() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useCurrentTenantId();

  return useMutation({
    mutationFn: async (data: { name: string; description?: string; color?: string }) => {
      const { error } = await supabase
        .from('stores')
        .insert({
          tenant_id: tenantId,
          name: data.name,
          description: data.description,
          color: data.color || '#8B5CF6',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Loja criada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar loja: ' + error.message);
    },
  });
}

export function useUpdateStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; color?: string; is_active?: boolean }) => {
      const { error } = await supabase
        .from('stores')
        .update(data)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Loja atualizada');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar loja: ' + error.message);
    },
  });
}

export function useDeleteStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Loja excluída');
    },
    onError: (error) => {
      toast.error('Erro ao excluir loja: ' + error.message);
    },
  });
}
