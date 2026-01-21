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
  // Individual communication metrics
  avgClareza: number;
  avgCordialidade: number;
  avgProatividade: number;
  avgConhecimento: number;
  // Criteria metrics
  avgTempoResposta: number;
  avgPersonalizacao: number;
  avgSensoUrgencia: number;
  avgRecuperacao: number;
  avgQualificacao: number;
  avgFollowup: number;
  // Objection efficiency
  objectionEfficiency: number;
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
  // Communication
  avgClareza: number;
  avgCordialidade: number;
  avgProatividade: number;
  avgConhecimento: number;
  // Criteria
  avgTempoResposta: number;
  avgPersonalizacao: number;
  avgSensoUrgencia: number;
  avgRecuperacao: number;
  avgQualificacao: number;
  avgFollowup: number;
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
  
  // Conversation date
  conversationDate?: string;
  
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

// Helper to query the view with conversation date filter
async function queryEvaluationsView(
  select: string,
  startDate: Date,
  endDate: Date,
  additionalFilters?: { column: string; value: string }[]
) {
  let query = supabase
    .from('sales_evaluations_with_conversation' as any)
    .select(select)
    .gte('conversation_last_message_at', startDate.toISOString())
    .lte('conversation_last_message_at', endDate.toISOString());

  if (additionalFilters) {
    additionalFilters.forEach(filter => {
      query = query.eq(filter.column, filter.value);
    });
  }

  return query;
}

export function useEvaluationOverview(startDate?: Date, endDate?: Date, agentId?: string | null) {
  const start = startDate || startOfMonth(new Date());
  const end = endDate || endOfMonth(new Date());

  return useQuery({
    queryKey: ['sales-evaluations-overview', format(start, 'yyyy-MM-dd'), format(end, 'yyyy-MM-dd'), agentId],
    queryFn: async (): Promise<EvaluationOverview> => {
      const filters = agentId ? [{ column: 'assigned_to', value: agentId }] : undefined;
      const { data, error } = await queryEvaluationsView(
        'overall_score, etapa_fechamento, objecoes_nota_media, objecoes_tratadas, objecoes_apareceram, comunicacao_clareza, comunicacao_cordialidade, comunicacao_proatividade, comunicacao_conhecimento_produto, conducao, criterio_tempo_resposta, criterio_personalizacao, criterio_senso_urgencia, criterio_recuperacao_final, criterio_qualificacao_lead, criterio_followup_estruturado',
        start,
        end,
        filters
      );

      if (error) throw error;
      if (!data || data.length === 0) {
        return {
          totalEvaluations: 0,
          avgScore: 0,
          closingRate: 0,
          avgObjectionScore: 0,
          avgCommunicationScore: 0,
          avgConductionScore: 0,
          avgClareza: 0,
          avgCordialidade: 0,
          avgProatividade: 0,
          avgConhecimento: 0,
          avgTempoResposta: 0,
          avgPersonalizacao: 0,
          avgSensoUrgencia: 0,
          avgRecuperacao: 0,
          avgQualificacao: 0,
          avgFollowup: 0,
          objectionEfficiency: 0,
        };
      }

      const totalEvaluations = data.length;
      const avgScore = data.reduce((sum, e: any) => sum + (Number(e.overall_score) || 0), 0) / totalEvaluations;
      const closingRate = (data.filter((e: any) => e.etapa_fechamento === 1).length / totalEvaluations) * 100;
      const avgObjectionScore = data.reduce((sum, e: any) => sum + (Number(e.objecoes_nota_media) || 0), 0) / totalEvaluations;
      
      // Individual communication metrics
      const avgClareza = data.reduce((sum, e: any) => sum + (e.comunicacao_clareza || 0), 0) / totalEvaluations;
      const avgCordialidade = data.reduce((sum, e: any) => sum + (e.comunicacao_cordialidade || 0), 0) / totalEvaluations;
      const avgProatividade = data.reduce((sum, e: any) => sum + (e.comunicacao_proatividade || 0), 0) / totalEvaluations;
      const avgConhecimento = data.reduce((sum, e: any) => sum + (e.comunicacao_conhecimento_produto || 0), 0) / totalEvaluations;
      
      const avgCommunicationScore = (avgClareza + avgCordialidade + avgProatividade + avgConhecimento) / 4;
      const avgConductionScore = data.reduce((sum, e: any) => sum + (e.conducao || 0), 0) / totalEvaluations;

      // Criteria metrics
      const avgTempoResposta = data.reduce((sum, e: any) => sum + (e.criterio_tempo_resposta || 0), 0) / totalEvaluations;
      const avgPersonalizacao = data.reduce((sum, e: any) => sum + (e.criterio_personalizacao || 0), 0) / totalEvaluations;
      const avgSensoUrgencia = data.reduce((sum, e: any) => sum + (e.criterio_senso_urgencia || 0), 0) / totalEvaluations;
      const avgRecuperacao = data.reduce((sum, e: any) => sum + (e.criterio_recuperacao_final || 0), 0) / totalEvaluations;
      const avgQualificacao = data.reduce((sum, e: any) => sum + (e.criterio_qualificacao_lead || 0), 0) / totalEvaluations;
      const avgFollowup = data.reduce((sum, e: any) => sum + (e.criterio_followup_estruturado || 0), 0) / totalEvaluations;

      // Objection efficiency
      const totalAppeared = data.reduce((sum, e: any) => sum + (e.objecoes_apareceram || 0), 0);
      const totalHandled = data.reduce((sum, e: any) => sum + (e.objecoes_tratadas || 0), 0);
      const objectionEfficiency = totalAppeared > 0 ? (totalHandled / totalAppeared) * 100 : 0;

      return {
        totalEvaluations,
        avgScore: Math.round(avgScore * 10) / 10,
        closingRate: Math.round(closingRate * 10) / 10,
        avgObjectionScore: Math.round(avgObjectionScore * 10) / 10,
        avgCommunicationScore: Math.round(avgCommunicationScore * 10) / 10,
        avgConductionScore: Math.round(avgConductionScore * 10) / 10,
        avgClareza: Math.round(avgClareza * 10) / 10,
        avgCordialidade: Math.round(avgCordialidade * 10) / 10,
        avgProatividade: Math.round(avgProatividade * 10) / 10,
        avgConhecimento: Math.round(avgConhecimento * 10) / 10,
        avgTempoResposta: Math.round(avgTempoResposta * 10) / 10,
        avgPersonalizacao: Math.round(avgPersonalizacao * 10) / 10,
        avgSensoUrgencia: Math.round(avgSensoUrgencia * 10) / 10,
        avgRecuperacao: Math.round(avgRecuperacao * 10) / 10,
        avgQualificacao: Math.round(avgQualificacao * 10) / 10,
        avgFollowup: Math.round(avgFollowup * 10) / 10,
        objectionEfficiency: Math.round(objectionEfficiency * 10) / 10,
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
      // First get evaluations from the view with all metrics
      const { data: evaluationsData, error: evalError } = await queryEvaluationsView(
        'assigned_to, overall_score, etapa_fechamento, conducao, objecoes_nota_media, comunicacao_clareza, comunicacao_cordialidade, comunicacao_proatividade, comunicacao_conhecimento_produto, criterio_tempo_resposta, criterio_personalizacao, criterio_senso_urgencia, criterio_recuperacao_final, criterio_qualificacao_lead, criterio_followup_estruturado',
        start,
        end
      );

      if (evalError) throw evalError;
      if (!evaluationsData || evaluationsData.length === 0) return [];

      // Get unique agent IDs
      const agentIds = [...new Set(evaluationsData.map((e: any) => e.assigned_to))];

      // Fetch agent profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', agentIds);

      if (profilesError) throw profilesError;

      // Create a map of profiles
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Group evaluations by agent
      const agentMap = new Map<string, {
        profile: { id: string; full_name: string; avatar_url: string | null };
        evaluations: any[];
      }>();

      evaluationsData.forEach((evaluation: any) => {
        const agentId = evaluation.assigned_to;
        const profile = profilesMap.get(agentId);
        if (!profile) return;
        
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
        
        // Communication metrics
        const avgClareza = evaluations.reduce((sum, e) => sum + (e.comunicacao_clareza || 0), 0) / count;
        const avgCordialidade = evaluations.reduce((sum, e) => sum + (e.comunicacao_cordialidade || 0), 0) / count;
        const avgProatividade = evaluations.reduce((sum, e) => sum + (e.comunicacao_proatividade || 0), 0) / count;
        const avgConhecimento = evaluations.reduce((sum, e) => sum + (e.comunicacao_conhecimento_produto || 0), 0) / count;

        // Criteria metrics
        const avgTempoResposta = evaluations.reduce((sum, e) => sum + (e.criterio_tempo_resposta || 0), 0) / count;
        const avgPersonalizacao = evaluations.reduce((sum, e) => sum + (e.criterio_personalizacao || 0), 0) / count;
        const avgSensoUrgencia = evaluations.reduce((sum, e) => sum + (e.criterio_senso_urgencia || 0), 0) / count;
        const avgRecuperacao = evaluations.reduce((sum, e) => sum + (e.criterio_recuperacao_final || 0), 0) / count;
        const avgQualificacao = evaluations.reduce((sum, e) => sum + (e.criterio_qualificacao_lead || 0), 0) / count;
        const avgFollowup = evaluations.reduce((sum, e) => sum + (e.criterio_followup_estruturado || 0), 0) / count;

        rankings.push({
          id: profile.id,
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
          evaluations: count,
          avgScore: Math.round(avgScore * 10) / 10,
          closingRate: Math.round(closingRate * 10) / 10,
          avgConduction: Math.round(avgConduction * 10) / 10,
          avgObjectionScore: Math.round(avgObjectionScore * 10) / 10,
          avgClareza: Math.round(avgClareza * 10) / 10,
          avgCordialidade: Math.round(avgCordialidade * 10) / 10,
          avgProatividade: Math.round(avgProatividade * 10) / 10,
          avgConhecimento: Math.round(avgConhecimento * 10) / 10,
          avgTempoResposta: Math.round(avgTempoResposta * 10) / 10,
          avgPersonalizacao: Math.round(avgPersonalizacao * 10) / 10,
          avgSensoUrgencia: Math.round(avgSensoUrgencia * 10) / 10,
          avgRecuperacao: Math.round(avgRecuperacao * 10) / 10,
          avgQualificacao: Math.round(avgQualificacao * 10) / 10,
          avgFollowup: Math.round(avgFollowup * 10) / 10,
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
        .from('sales_evaluations_with_conversation' as any)
        .select('*')
        .eq('assigned_to', agentId)
        .gte('conversation_last_message_at', start.toISOString())
        .lte('conversation_last_message_at', end.toISOString())
        .order('conversation_last_message_at', { ascending: false });

      if (error) throw error;
      if (!data) return [];

      // Fetch agent profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', agentId)
        .single();

      // Fetch conversation contacts
      const conversationIds = data.map((e: any) => e.conversation_id);
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, contacts(full_name, phone)')
        .in('id', conversationIds);

      const contactsMap = new Map(
        conversations?.map(c => [c.id, c.contacts]) || []
      );

      return data.map((e: any) => ({
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
        conversationDate: e.conversation_last_message_at,
        agent: profile ? {
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
        } : undefined,
        contact: contactsMap.get(e.conversation_id) ? {
          fullName: (contactsMap.get(e.conversation_id) as any).full_name,
          phone: (contactsMap.get(e.conversation_id) as any).phone,
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
        .from('sales_evaluations_with_conversation' as any)
        .select('*')
        .eq('id', evaluationId)
        .single();

      if (error) throw error;
      if (!data) return null;

      // Fetch agent profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', (data as any).assigned_to)
        .single();

      // Fetch contact info
      const { data: conversation } = await supabase
        .from('conversations')
        .select('contacts(full_name, phone)')
        .eq('id', (data as any).conversation_id)
        .single();

      return {
        id: (data as any).id,
        conversationId: (data as any).conversation_id,
        assignedTo: (data as any).assigned_to,
        analyzedAt: (data as any).analyzed_at,
        overallScore: Number((data as any).overall_score) || 0,
        feedback: (data as any).feedback || '',
        etapaCatalogoReferencia: (data as any).etapa_catalogo_referencia || 0,
        etapaMockup: (data as any).etapa_mockup || 0,
        etapaAprovacaoMockup: (data as any).etapa_aprovacao_mockup || 0,
        etapaOrcamentoFinal: (data as any).etapa_orcamento_final || 0,
        etapaFechamento: (data as any).etapa_fechamento || 0,
        etapasScore: (data as any).etapas_score || 0,
        objecoes: ((data as any).objecoes as Record<string, { apareceu: number; tratada: number; nota: number }>) || {},
        objecoesApareceram: (data as any).objecoes_apareceram || 0,
        objecoesTratadas: (data as any).objecoes_tratadas || 0,
        objecoesNotaMedia: Number((data as any).objecoes_nota_media) || 0,
        comunicacaoClareza: (data as any).comunicacao_clareza || 0,
        comunicacaoCordialidade: (data as any).comunicacao_cordialidade || 0,
        comunicacaoProatividade: (data as any).comunicacao_proatividade || 0,
        comunicacaoConhecimentoProduto: (data as any).comunicacao_conhecimento_produto || 0,
        criterioTempoResposta: (data as any).criterio_tempo_resposta || 0,
        criterioPersonalizacao: (data as any).criterio_personalizacao || 0,
        criterioSensoUrgencia: (data as any).criterio_senso_urgencia || 0,
        criterioRecuperacaoFinal: (data as any).criterio_recuperacao_final || 0,
        criterioQualificacaoLead: (data as any).criterio_qualificacao_lead || 0,
        criterioFollowupEstruturado: (data as any).criterio_followup_estruturado || 0,
        conducao: (data as any).conducao || 0,
        conversationDate: (data as any).conversation_last_message_at,
        agent: profile ? {
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
        } : undefined,
        contact: (conversation as any)?.contacts ? {
          fullName: (conversation as any).contacts.full_name,
          phone: (conversation as any).contacts.phone,
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
      const { data, error } = await queryEvaluationsView('objecoes', start, end);

      if (error) throw error;
      if (!data) return [];

      const objectionStats = new Map<string, { count: number; handled: number; totalScore: number }>();

      data.forEach((evaluation: any) => {
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
        .from('sales_evaluations_with_conversation' as any)
        .select('conversation_last_message_at, overall_score')
        .gte('conversation_last_message_at', start.toISOString())
        .lte('conversation_last_message_at', end.toISOString())
        .order('conversation_last_message_at', { ascending: true });

      if (agentId) {
        query = query.eq('assigned_to', agentId);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data) return [];

      // Group by week
      const weeklyData = new Map<string, { scores: number[]; count: number }>();
      
      data.forEach((e: any) => {
        const date = new Date(e.conversation_last_message_at);
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
      const { data, error } = await queryEvaluationsView('overall_score', start, end);

      if (error) throw error;
      
      const distribution: ScoreDistribution = {
        excellent: 0,
        good: 0,
        regular: 0,
        weak: 0,
        critical: 0,
      };

      if (!data || data.length === 0) return distribution;

      data.forEach((e: any) => {
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
      const { data, error } = await queryEvaluationsView(
        'etapa_catalogo_referencia, etapa_mockup, etapa_aprovacao_mockup, etapa_orcamento_final, etapa_fechamento',
        start,
        end
      );

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const total = data.length;
      
      const stages = [
        { name: 'Catálogo/Referência', value: data.filter((e: any) => e.etapa_catalogo_referencia === 1).length },
        { name: 'Mockup', value: data.filter((e: any) => e.etapa_mockup === 1).length },
        { name: 'Aprovação Mockup', value: data.filter((e: any) => e.etapa_aprovacao_mockup === 1).length },
        { name: 'Orçamento Final', value: data.filter((e: any) => e.etapa_orcamento_final === 1).length },
        { name: 'Fechamento', value: data.filter((e: any) => e.etapa_fechamento === 1).length },
      ];

      return stages.map(stage => ({
        ...stage,
        percentage: Math.round((stage.value / total) * 100),
      }));
    },
  });
}
