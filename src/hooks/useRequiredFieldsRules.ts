import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RequiredFieldsRule {
  id: string;
  department_id: string | null;
  user_id: string | null;
  is_enabled: boolean;
  required_fields: string[];
  created_at: string;
  updated_at: string;
  created_by: string | null;
  // Joined data
  department?: { id: string; name: string } | null;
  user?: { id: string; full_name: string } | null;
}

export interface RequiredFieldsRuleInput {
  department_id?: string | null;
  user_id?: string | null;
  is_enabled?: boolean;
  required_fields?: string[];
}

export const AVAILABLE_FIELDS = [
  { key: 'negotiated_value', label: 'Valor Negociado', description: 'Valor monetário da negociação' },
  { key: 'lead_status', label: 'Status de Lead', description: 'Status atual do lead no funil' },
  { key: 'segment_id', label: 'Segmento', description: 'Segmento/categoria do contato' },
  { key: 'owner_agent', label: 'Atendente Responsável', description: 'Agente responsável pelo contato' },
] as const;

export type AvailableFieldKey = typeof AVAILABLE_FIELDS[number]['key'];

export function useRequiredFieldsRules() {
  return useQuery({
    queryKey: ['required-fields-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('required_fields_rules')
        .select(`
          *,
          department:departments(id, name),
          user:profiles!required_fields_rules_user_id_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as RequiredFieldsRule[];
    },
  });
}

export function useCreateRequiredFieldsRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: RequiredFieldsRuleInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('required_fields_rules')
        .insert({
          ...input,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['required-fields-rules'] });
      toast.success('Regra criada com sucesso');
    },
    onError: (error: any) => {
      if (error.code === '23505') {
        toast.error('Já existe uma regra para este departamento ou usuário');
      } else {
        toast.error('Erro ao criar regra: ' + error.message);
      }
    },
  });
}

export function useUpdateRequiredFieldsRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...input }: RequiredFieldsRuleInput & { id: string }) => {
      const { data, error } = await supabase
        .from('required_fields_rules')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['required-fields-rules'] });
      toast.success('Regra atualizada com sucesso');
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar regra: ' + error.message);
    },
  });
}

export function useDeleteRequiredFieldsRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('required_fields_rules')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['required-fields-rules'] });
      toast.success('Regra excluída com sucesso');
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir regra: ' + error.message);
    },
  });
}

export function useToggleRequiredFieldsRule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('required_fields_rules')
        .update({ is_enabled })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, { is_enabled }) => {
      queryClient.invalidateQueries({ queryKey: ['required-fields-rules'] });
      toast.success(is_enabled ? 'Regra ativada' : 'Regra desativada');
    },
    onError: (error: any) => {
      toast.error('Erro ao alterar status da regra: ' + error.message);
    },
  });
}
