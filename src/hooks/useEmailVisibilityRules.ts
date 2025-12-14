import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmailVisibilityRule {
  id: string;
  source_role: string;
  target_role: string | null;
  target_shared_box_id: string | null;
  is_allowed: boolean;
  created_at: string;
  updated_at: string;
}

// Buscar todas as regras de visibilidade
export function useEmailVisibilityRules() {
  return useQuery({
    queryKey: ['email-visibility-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_visibility_rules')
        .select('*')
        .order('source_role');

      if (error) throw error;
      return data as EmailVisibilityRule[];
    }
  });
}

// Buscar regras por role específico
export function useEmailVisibilityRulesForRole(sourceRole: string | null) {
  return useQuery({
    queryKey: ['email-visibility-rules', sourceRole],
    queryFn: async () => {
      if (!sourceRole) return [];

      const { data, error } = await supabase
        .from('email_visibility_rules')
        .select('*')
        .eq('source_role', sourceRole)
        .eq('is_allowed', true);

      if (error) throw error;
      return data as EmailVisibilityRule[];
    },
    enabled: !!sourceRole
  });
}

// Criar/atualizar regra de visibilidade
export function useUpsertEmailVisibilityRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: {
      source_role: string;
      target_role?: string;
      target_shared_box_id?: string;
      is_allowed: boolean;
    }) => {
      // Tenta buscar regra existente
      let existingQuery = supabase
        .from('email_visibility_rules')
        .select('id')
        .eq('source_role', rule.source_role);

      if (rule.target_role) {
        existingQuery = existingQuery.eq('target_role', rule.target_role);
      } else if (rule.target_shared_box_id) {
        existingQuery = existingQuery.eq('target_shared_box_id', rule.target_shared_box_id);
      }

      const { data: existing } = await existingQuery.maybeSingle();

      if (existing) {
        // Atualiza
        const { data, error } = await supabase
          .from('email_visibility_rules')
          .update({ is_allowed: rule.is_allowed, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Cria nova
        const { data, error } = await supabase
          .from('email_visibility_rules')
          .insert({
            source_role: rule.source_role,
            target_role: rule.target_role || null,
            target_shared_box_id: rule.target_shared_box_id || null,
            is_allowed: rule.is_allowed
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-visibility-rules'] });
      queryClient.invalidateQueries({ queryKey: ['email-recipient-options'] });
      queryClient.invalidateQueries({ queryKey: ['visible-shared-boxes'] });
    }
  });
}

// Deletar regra de visibilidade
export function useDeleteEmailVisibilityRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase
        .from('email_visibility_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-visibility-rules'] });
      queryClient.invalidateQueries({ queryKey: ['email-recipient-options'] });
      queryClient.invalidateQueries({ queryKey: ['visible-shared-boxes'] });
    }
  });
}

// Salvar múltiplas regras de uma vez
export function useBulkSaveEmailVisibilityRules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rules: Array<{
      source_role: string;
      target_role?: string;
      target_shared_box_id?: string;
      is_allowed: boolean;
    }>) => {
      // Processa cada regra individualmente com upsert
      for (const rule of rules) {
        let existingQuery = supabase
          .from('email_visibility_rules')
          .select('id')
          .eq('source_role', rule.source_role);

        if (rule.target_role) {
          existingQuery = existingQuery.eq('target_role', rule.target_role);
        } else if (rule.target_shared_box_id) {
          existingQuery = existingQuery.eq('target_shared_box_id', rule.target_shared_box_id);
        }

        const { data: existing } = await existingQuery.maybeSingle();

        if (existing) {
          await supabase
            .from('email_visibility_rules')
            .update({ is_allowed: rule.is_allowed, updated_at: new Date().toISOString() })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('email_visibility_rules')
            .insert({
              source_role: rule.source_role,
              target_role: rule.target_role || null,
              target_shared_box_id: rule.target_shared_box_id || null,
              is_allowed: rule.is_allowed
            });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-visibility-rules'] });
      queryClient.invalidateQueries({ queryKey: ['email-recipient-options'] });
      queryClient.invalidateQueries({ queryKey: ['visible-shared-boxes'] });
    }
  });
}
