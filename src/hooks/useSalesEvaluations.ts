import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export interface EvaluationOverview {
  totalEvaluations: number;
  avgScore: number;
  closingRate: number;
  avgObjectionScore: number;
  avgCommunicationScore: number;
  avgConductionScore: number;
}

export interface AgentRanking {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  evaluations: number;
  avgScore: number;
  closingRate: number;
  avgConduction: number;
  avgObjectionScore: number;
  classification: 'excellent' | 'good' | 'regular' | 'weak' | 'critical';
}

export interface EvaluationDetail {
  id: string;
  conversationId: string;
  assignedTo: string;
  analyzedAt: string;
  overallScore: number;
  feedback: string;
  
  // Funnel stages (0 or 1)
  etapaCatalogoReferencia: number;
  etapaMockup: number;
  etapaAprovacaoMockup: number;
  etapaOrcamentoFinal: number;
  etapaFechamento: number;
  etapasScore: number;
  
  // Objections
  objecoes: Record<string, { apareceu: number; tratada: number; nota: number }>;
  objecoesApareceram: number;
  objecoesTratadas: number;
  objecoesNotaMedia: number;
  
  // Communication metrics (0-10)
  comunicacaoClareza: number;
  comunicacaoCordialidade: number;
  comunicacaoProatividade: number;
  comunicacaoConhecimentoProduto: number;
  
  // Additional criteria (0-10)
  criterioTempoResposta: number;
  criterioPersonalizacao: number;
  criterioSensoUrgencia: number;
  criterioRecuperacaoFinal: number;
  criterioQualificacaoLead: number;
  criterioFollowupEstruturado: number;
  
  // Conduction (0-10)
  conducao: number;
  
  // Agent info
  agent?: {
    fullName: string;
    avatarUrl: string | null;
  };
  
  // Contact info
  contact?: {
    fullName: string;
    phone: string;
  };
}

export interface ObjectionAnalysis {
  name: string;
  frequency: number;
  avgScore: number;
  handledRate: number;
}

export interface ScoreDistribution {
  excellent: number;
  good: number;
  regular: number;
  weak: number;
  critical: number;
}

function getClassification(score: number): 'excellent' | 'good' | 'regular' | 'weak' | 'critical' {
  if (score >= 8.5) return 'excellent';
  if (score >= 7) return 'good';
  if (score >= 5) return 'regular';
  if (score >= 3) return 'weak';
  return 'critical';
}

export function useEvaluationOverview(startDate?: Date, endDate?: Date) {
  const start = startDate || startOfMonth(new Date());
  const end = endDate || endOfMonth(new Date());

  return useQuery({
    queryKey: ['sales-evaluations-overview', format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')],
    queryFn: async (): Promise<EvaluationOverview> => {
      const { data, error } = await supabase
        .from('sales_evaluations')
        .select('overall_score, etapa_fechamento, objecoes_nota_media, comunicacao_clareza, comunicacao_cordialidade, comunicacao_proatividade, comunicacao_conhecimento_produto, conducao')
        .gte('analyzed_at', start.toISOString())
        .lte('analyzed_at', end.toISOString());

      if (error) throw error;
      if (!data || data.length === 0) {
        return {
          totalEvaluations: 0,
          avgScore: 0,
          closingRate: 0,
          avgObjectionScore: 0,
          avgCommunicationScore: 0,
          avgConductionScore: 0,
        };
      }

      const totalEvaluations = data.length;
      const avgScore = data.reduce((sum, e) => sum + (Number(e.overall_score) || 0), 0) / totalEvaluations;
      const closingRate = (data.filter(e => e.etapa_fechamento === 1).length / totalEvaluations) * 100;
      const avgObjectionScore = data.reduce((sum, e) => sum + (Number(e.objecoes_nota_media) || 0), 0) / totalEvaluations;
      
      const avgCommunicationScore = data.reduce((sum, e) => {
        const comm = ((e.comunicacao_clareza || 0) + (e.comunicacao_cordialidade || 0) + 
                      (e.comunicacao_proatividade || 0) + (e.comunicacao_conhecimento_produto || 0)) / 4;
        return sum + comm;
      }, 0) / totalEvaluations;
      
      const avgConductionScore = data.reduce((sum, e) => sum + (e.conducao || 0), 0) / totalEvaluations;

      return {
        totalEvaluations,
        avgScore: Math.round(avgScore * 10) / 10,
        closingRate: Math.round(closingRate * 10) / 10,
        avgObjectionScore: Math.round(avgObjectionScore * 10) / 10,
        avgCommunicationScore: Math.round(avgCommunicationScore * 10) / 10,
        avgConductionScore: Math.round(avgConductionScore * 10) / 10,
      };
    },
  });
}

export function useAgentRanking(startDate?: Date, endDate?: Date) {
  const start = startDate || startOfMonth(new Date());
  const end = endDate || endOfMonth(new Date());

  return useQuery({
    queryKey: ['sales-evaluations-ranking', format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')],
    queryFn: async (): Promise<AgentRanking[]> => {
      const { data, error } = await supabase
        .from('sales_evaluations')
        .select(`
          assigned_to,
          overall_score,
          etapa_fechamento,
          conducao,
          objecoes_nota_media,
          profiles!sales_evaluations_assigned_to_fkey (
            id,
            full_name,
            avatar_url
          )
        `)
        .gte('analyzed_at', start.toISOString())
        .lte('analyzed_at', end.toISOString());

      if (error) throw error;
      if (!data) return [];

      // Group by agent
      const agentMap = new Map<string, {
        profile: { id: string; full_name: string; avatar_url: string | null };
        evaluations: typeof data;
      }>();

      data.forEach(evaluation => {
        const profile = evaluation.profiles;
        if (!profile) return;
        
        const agentId = profile.id;
        if (!agentMap.has(agentId)) {
          agentMap.set(agentId, { profile, evaluations: [] });
        }
        agentMap.get(agentId)!.evaluations.push(evaluation);
      });

      const rankings: AgentRanking[] = [];
      
      agentMap.forEach(({ profile, evaluations }) => {
        const count = evaluations.length;
        const avgScore = evaluations.reduce((sum, e) => sum + (Number(e.overall_score) || 0), 0) / count;
        const closingRate = (evaluations.filter(e => e.etapa_fechamento === 1).length / count) * 100;
        const avgConduction = evaluations.reduce((sum, e) => sum + (e.conducao || 0), 0) / count;
        const avgObjectionScore = evaluations.reduce((sum, e) => sum + (Number(e.objecoes_nota_media) || 0), 0) / count;

        rankings.push({
          id: profile.id,
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
          evaluations: count,
          avgScore: Math.round(avgScore * 10) / 10,
          closingRate: Math.round(closingRate * 10) / 10,
          avgConduction: Math.round(avgConduction * 10) / 10,
          avgObjectionScore: Math.round(avgObjectionScore * 10) / 10,
          classification: getClassification(avgScore),
        });
      });

      return rankings.sort((a, b) => b.avgScore - a.avgScore);
    },
  });
}

export function useAgentEvaluations(agentId: string | null, startDate?: Date, endDate?: Date) {
  const start = startDate || subMonths(new Date(), 3);
  const end = endDate || new Date();

  return useQuery({
    queryKey: ['agent-evaluations', agentId, format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')],
    queryFn: async (): Promise<EvaluationDetail[]> => {
      if (!agentId) return [];

      const { data, error } = await supabase
        .from('sales_evaluations')
        .select(`
          *,
          profiles!sales_evaluations_assigned_to_fkey (
            full_name,
            avatar_url
          ),
          conversations!sales_evaluations_conversation_id_fkey (
            contacts (
              full_name,
              phone
            )
          )
        `)
        .eq('assigned_to', agentId)
        .gte('analyzed_at', start.toISOString())
        .lte('analyzed_at', end.toISOString())
        .order('analyzed_at', { ascending: false });

      if (error) throw error;
      if (!data) return [];

      return data.map(e => ({
        id: e.id,
        conversationId: e.conversation_id,
        assignedTo: e.assigned_to,
        analyzedAt: e.analyzed_at,
        overallScore: Number(e.overall_score) || 0,
        feedback: e.feedback || '',
        etapaCatalogoReferencia: e.etapa_catalogo_referencia || 0,
        etapaMockup: e.etapa_mockup || 0,
        etapaAprovacaoMockup: e.etapa_aprovacao_mockup || 0,
        etapaOrcamentoFinal: e.etapa_orcamento_final || 0,
        etapaFechamento: e.etapa_fechamento || 0,
        etapasScore: e.etapas_score || 0,
        objecoes: (e.objecoes as Record<string, { apareceu: number; tratada: number; nota: number }>) || {},
        objecoesApareceram: e.objecoes_apareceram || 0,
        objecoesTratadas: e.objecoes_tratadas || 0,
        objecoesNotaMedia: Number(e.objecoes_nota_media) || 0,
        comunicacaoClareza: e.comunicacao_clareza || 0,
        comunicacaoCordialidade: e.comunicacao_cordialidade || 0,
        comunicacaoProatividade: e.comunicacao_proatividade || 0,
        comunicacaoConhecimentoProduto: e.comunicacao_conhecimento_produto || 0,
        criterioTempoResposta: e.criterio_tempo_resposta || 0,
        criterioPersonalizacao: e.criterio_personalizacao || 0,
        criterioSensoUrgencia: e.criterio_senso_urgencia || 0,
        criterioRecuperacaoFinal: e.criterio_recuperacao_final || 0,
        criterioQualificacaoLead: e.criterio_qualificacao_lead || 0,
        criterioFollowupEstruturado: e.criterio_followup_estruturado || 0,
        conducao: e.conducao || 0,
        agent: e.profiles ? {
          fullName: e.profiles.full_name,
          avatarUrl: e.profiles.avatar_url,
        } : undefined,
        contact: e.conversations?.contacts ? {
          fullName: e.conversations.contacts.full_name,
          phone: e.conversations.contacts.phone,
        } : undefined,
      }));
    },
    enabled: !!agentId,
  });
}

export function useEvaluationDetail(evaluationId: string | null) {
  return useQuery({
    queryKey: ['evaluation-detail', evaluationId],
    queryFn: async (): Promise<EvaluationDetail | null> => {
      if (!evaluationId) return null;

      const { data, error } = await supabase
        .from('sales_evaluations')
        .select(`
          *,
          profiles!sales_evaluations_assigned_to_fkey (
            full_name,
            avatar_url
          ),
          conversations!sales_evaluations_conversation_id_fkey (
            contacts (
              full_name,
              phone
            )
          )
        `)
        .eq('id', evaluationId)
        .single();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        conversationId: data.conversation_id,
        assignedTo: data.assigned_to,
        analyzedAt: data.analyzed_at,
        overallScore: Number(data.overall_score) || 0,
        feedback: data.feedback || '',
        etapaCatalogoReferencia: data.etapa_catalogo_referencia || 0,
        etapaMockup: data.etapa_mockup || 0,
        etapaAprovacaoMockup: data.etapa_aprovacao_mockup || 0,
        etapaOrcamentoFinal: data.etapa_orcamento_final || 0,
        etapaFechamento: data.etapa_fechamento || 0,
        etapasScore: data.etapas_score || 0,
        objecoes: (data.objecoes as Record<string, { apareceu: number; tratada: number; nota: number }>) || {},
        objecoesApareceram: data.objecoes_apareceram || 0,
        objecoesTratadas: data.objecoes_tratadas || 0,
        objecoesNotaMedia: Number(data.objecoes_nota_media) || 0,
        comunicacaoClareza: data.comunicacao_clareza || 0,
        comunicacaoCordialidade: data.comunicacao_cordialidade || 0,
        comunicacaoProatividade: data.comunicacao_proatividade || 0,
        comunicacaoConhecimentoProduto: data.comunicacao_conhecimento_produto || 0,
        criterioTempoResposta: data.criterio_tempo_resposta || 0,
        criterioPersonalizacao: data.criterio_personalizacao || 0,
        criterioSensoUrgencia: data.criterio_senso_urgencia || 0,
        criterioRecuperacaoFinal: data.criterio_recuperacao_final || 0,
        criterioQualificacaoLead: data.criterio_qualificacao_lead || 0,
        criterioFollowupEstruturado: data.criterio_followup_estruturado || 0,
        conducao: data.conducao || 0,
        agent: data.profiles ? {
          fullName: data.profiles.full_name,
          avatarUrl: data.profiles.avatar_url,
        } : undefined,
        contact: data.conversations?.contacts ? {
          fullName: data.conversations.contacts.full_name,
          phone: data.conversations.contacts.phone,
        } : undefined,
      };
    },
    enabled: !!evaluationId,
  });
}

export function useObjectionsAnalysis(startDate?: Date, endDate?: Date) {
  const start = startDate || startOfMonth(new Date());
  const end = endDate || endOfMonth(new Date());

  return useQuery({
    queryKey: ['objections-analysis', format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')],
    queryFn: async (): Promise<ObjectionAnalysis[]> => {
      const { data, error } = await supabase
        .from('sales_evaluations')
        .select('objecoes')
        .gte('analyzed_at', start.toISOString())
        .lte('analyzed_at', end.toISOString());

      if (error) throw error;
      if (!data) return [];

      const objectionStats = new Map<string, { count: number; handled: number; totalScore: number }>();

      data.forEach(evaluation => {
        const objecoes = evaluation.objecoes as Record<string, { apareceu: number; tratada: number; nota: number }> | null;
        if (!objecoes) return;

        Object.entries(objecoes).forEach(([name, obj]) => {
          if (obj.apareceu === 1) {
            const stats = objectionStats.get(name) || { count: 0, handled: 0, totalScore: 0 };
            stats.count++;
            if (obj.tratada === 1) stats.handled++;
            stats.totalScore += obj.nota || 0;
            objectionStats.set(name, stats);
          }
        });
      });

      const result: ObjectionAnalysis[] = [];
      objectionStats.forEach((stats, name) => {
        result.push({
          name,
          frequency: stats.count,
          avgScore: Math.round((stats.totalScore / stats.count) * 10) / 10,
          handledRate: Math.round((stats.handled / stats.count) * 100),
        });
      });

      return result.sort((a, b) => b.frequency - a.frequency);
    },
  });
}

export function useScoreEvolution(agentId?: string | null, months: number = 6) {
  return useQuery({
    queryKey: ['score-evolution', agentId, months],
    queryFn: async () => {
      const end = new Date();
      const start = subMonths(end, months);

      let query = supabase
        .from('sales_evaluations')
        .select('analyzed_at, overall_score')
        .gte('analyzed_at', start.toISOString())
        .lte('analyzed_at', end.toISOString())
        .order('analyzed_at', { ascending: true });

      if (agentId) {
        query = query.eq('assigned_to', agentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data) return [];

      // Group by week
      const weeklyData = new Map<string, { scores: number[]; count: number }>();
      
      data.forEach(e => {
        const date = new Date(e.analyzed_at);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        
        const week = weeklyData.get(weekKey) || { scores: [], count: 0 };
        week.scores.push(Number(e.overall_score) || 0);
        week.count++;
        weeklyData.set(weekKey, week);
      });

      return Array.from(weeklyData.entries()).map(([week, data]) => ({
        week,
        avgScore: Math.round((data.scores.reduce((a, b) => a + b, 0) / data.count) * 10) / 10,
        count: data.count,
      }));
    },
  });
}

export function useScoreDistribution(startDate?: Date, endDate?: Date) {
  const start = startDate || startOfMonth(new Date());
  const end = endDate || endOfMonth(new Date());

  return useQuery({
    queryKey: ['score-distribution', format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')],
    queryFn: async (): Promise<ScoreDistribution> => {
      const { data, error } = await supabase
        .from('sales_evaluations')
        .select('overall_score')
        .gte('analyzed_at', start.toISOString())
        .lte('analyzed_at', end.toISOString());

      if (error) throw error;
      
      const distribution: ScoreDistribution = {
        excellent: 0,
        good: 0,
        regular: 0,
        weak: 0,
        critical: 0,
      };

      if (!data || data.length === 0) return distribution;

      data.forEach(e => {
        const score = Number(e.overall_score) || 0;
        if (score >= 8.5) distribution.excellent++;
        else if (score >= 7) distribution.good++;
        else if (score >= 5) distribution.regular++;
        else if (score >= 3) distribution.weak++;
        else distribution.critical++;
      });

      return distribution;
    },
  });
}

export function useFunnelAnalysis(startDate?: Date, endDate?: Date) {
  const start = startDate || startOfMonth(new Date());
  const end = endDate || endOfMonth(new Date());

  return useQuery({
    queryKey: ['funnel-analysis', format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_evaluations')
        .select('etapa_catalogo_referencia, etapa_mockup, etapa_aprovacao_mockup, etapa_orcamento_final, etapa_fechamento')
        .gte('analyzed_at', start.toISOString())
        .lte('analyzed_at', end.toISOString());

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const total = data.length;
      
      const stages = [
        { name: 'Catálogo/Referência', value: data.filter(e => e.etapa_catalogo_referencia === 1).length },
        { name: 'Mockup', value: data.filter(e => e.etapa_mockup === 1).length },
        { name: 'Aprovação Mockup', value: data.filter(e => e.etapa_aprovacao_mockup === 1).length },
        { name: 'Orçamento Final', value: data.filter(e => e.etapa_orcamento_final === 1).length },
        { name: 'Fechamento', value: data.filter(e => e.etapa_fechamento === 1).length },
      ];

      return stages.map(stage => ({
        ...stage,
        percentage: Math.round((stage.value / total) * 100),
      }));
    },
  });
}
