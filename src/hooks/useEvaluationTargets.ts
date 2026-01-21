import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EvaluationTargets {
  id?: string;
  targetOverallScore: number;
  targetTaxaFechamento: number;
  targetEficienciaObjecoes: number;
  targetNotaObjecoes: number;
  targetConducao: number;
  targetComunicacaoClareza: number;
  targetComunicacaoCordialidade: number;
  targetComunicacaoProatividade: number;
  targetComunicacaoConhecimento: number;
  targetTempoResposta: number;
  targetPersonalizacao: number;
  targetSensoUrgencia: number;
  targetRecuperacaoFinal: number;
  targetQualificacaoLead: number;
  targetFollowupEstruturado: number;
}

const DEFAULT_TARGETS: EvaluationTargets = {
  targetOverallScore: 7.0,
  targetTaxaFechamento: 20.0,
  targetEficienciaObjecoes: 80.0,
  targetNotaObjecoes: 6.5,
  targetConducao: 7.0,
  targetComunicacaoClareza: 7.0,
  targetComunicacaoCordialidade: 7.0,
  targetComunicacaoProatividade: 7.0,
  targetComunicacaoConhecimento: 7.0,
  targetTempoResposta: 7.0,
  targetPersonalizacao: 7.0,
  targetSensoUrgencia: 7.0,
  targetRecuperacaoFinal: 7.0,
  targetQualificacaoLead: 7.0,
  targetFollowupEstruturado: 7.0,
};

export function useEvaluationTargets() {
  return useQuery({
    queryKey: ['evaluation-targets'],
    queryFn: async (): Promise<EvaluationTargets> => {
      const { data, error } = await supabase
        .from('sales_evaluation_targets')
        .select('*')
        .maybeSingle();

      if (error) throw error;
      
      if (!data) return DEFAULT_TARGETS;

      return {
        id: data.id,
        targetOverallScore: Number(data.target_overall_score) || DEFAULT_TARGETS.targetOverallScore,
        targetTaxaFechamento: Number(data.target_taxa_fechamento) || DEFAULT_TARGETS.targetTaxaFechamento,
        targetEficienciaObjecoes: Number(data.target_eficiencia_objecoes) || DEFAULT_TARGETS.targetEficienciaObjecoes,
        targetNotaObjecoes: Number(data.target_nota_objecoes) || DEFAULT_TARGETS.targetNotaObjecoes,
        targetConducao: Number(data.target_conducao) || DEFAULT_TARGETS.targetConducao,
        targetComunicacaoClareza: Number(data.target_comunicacao_clareza) || DEFAULT_TARGETS.targetComunicacaoClareza,
        targetComunicacaoCordialidade: Number(data.target_comunicacao_cordialidade) || DEFAULT_TARGETS.targetComunicacaoCordialidade,
        targetComunicacaoProatividade: Number(data.target_comunicacao_proatividade) || DEFAULT_TARGETS.targetComunicacaoProatividade,
        targetComunicacaoConhecimento: Number(data.target_comunicacao_conhecimento) || DEFAULT_TARGETS.targetComunicacaoConhecimento,
        targetTempoResposta: Number(data.target_tempo_resposta) || DEFAULT_TARGETS.targetTempoResposta,
        targetPersonalizacao: Number(data.target_personalizacao) || DEFAULT_TARGETS.targetPersonalizacao,
        targetSensoUrgencia: Number(data.target_senso_urgencia) || DEFAULT_TARGETS.targetSensoUrgencia,
        targetRecuperacaoFinal: Number(data.target_recuperacao_final) || DEFAULT_TARGETS.targetRecuperacaoFinal,
        targetQualificacaoLead: Number(data.target_qualificacao_lead) || DEFAULT_TARGETS.targetQualificacaoLead,
        targetFollowupEstruturado: Number(data.target_followup_estruturado) || DEFAULT_TARGETS.targetFollowupEstruturado,
      };
    },
  });
}

export function useUpdateEvaluationTargets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targets: Partial<EvaluationTargets>) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', userData.user.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      const payload = {
        tenant_id: profile.tenant_id,
        updated_by: userData.user.id,
        target_overall_score: targets.targetOverallScore,
        target_taxa_fechamento: targets.targetTaxaFechamento,
        target_eficiencia_objecoes: targets.targetEficienciaObjecoes,
        target_nota_objecoes: targets.targetNotaObjecoes,
        target_conducao: targets.targetConducao,
        target_comunicacao_clareza: targets.targetComunicacaoClareza,
        target_comunicacao_cordialidade: targets.targetComunicacaoCordialidade,
        target_comunicacao_proatividade: targets.targetComunicacaoProatividade,
        target_comunicacao_conhecimento: targets.targetComunicacaoConhecimento,
        target_tempo_resposta: targets.targetTempoResposta,
        target_personalizacao: targets.targetPersonalizacao,
        target_senso_urgencia: targets.targetSensoUrgencia,
        target_recuperacao_final: targets.targetRecuperacaoFinal,
        target_qualificacao_lead: targets.targetQualificacaoLead,
        target_followup_estruturado: targets.targetFollowupEstruturado,
      };

      const { error } = await supabase
        .from('sales_evaluation_targets')
        .upsert(payload, { onConflict: 'tenant_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluation-targets'] });
      toast.success('Metas atualizadas com sucesso!');
    },
    onError: (error) => {
      console.error('Error updating targets:', error);
      toast.error('Erro ao atualizar metas');
    },
  });
}
