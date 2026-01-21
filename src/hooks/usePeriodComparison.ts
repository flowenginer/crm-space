import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, differenceInDays } from 'date-fns';

export interface PeriodComparison {
  totalEvaluations: { current: number; previous: number; variation: number };
  avgScore: { current: number; previous: number; variation: number };
  closingRate: { current: number; previous: number; variation: number };
  avgObjectionScore: { current: number; previous: number; variation: number };
  avgCommunicationScore: { current: number; previous: number; variation: number };
  avgConductionScore: { current: number; previous: number; variation: number };
  objectionEfficiency: { current: number; previous: number; variation: number };
}

async function fetchPeriodMetrics(startDate: Date, endDate: Date) {
  const { data, error } = await supabase
    .from('sales_evaluations_with_conversation' as any)
    .select('overall_score, etapa_fechamento, objecoes_nota_media, comunicacao_clareza, comunicacao_cordialidade, comunicacao_proatividade, comunicacao_conhecimento_produto, conducao, objecoes_tratadas, objecoes_apareceram')
    .gte('conversation_last_message_at', startDate.toISOString())
    .lte('conversation_last_message_at', endDate.toISOString());

  if (error) throw error;
  if (!data || data.length === 0) {
    return {
      totalEvaluations: 0,
      avgScore: 0,
      closingRate: 0,
      avgObjectionScore: 0,
      avgCommunicationScore: 0,
      avgConductionScore: 0,
      objectionEfficiency: 0,
    };
  }

  const totalEvaluations = data.length;
  const avgScore = data.reduce((sum, e: any) => sum + (Number(e.overall_score) || 0), 0) / totalEvaluations;
  const closingRate = (data.filter((e: any) => e.etapa_fechamento === 1).length / totalEvaluations) * 100;
  const avgObjectionScore = data.reduce((sum, e: any) => sum + (Number(e.objecoes_nota_media) || 0), 0) / totalEvaluations;
  
  const avgCommunicationScore = data.reduce((sum, e: any) => {
    const comm = ((e.comunicacao_clareza || 0) + (e.comunicacao_cordialidade || 0) + 
                  (e.comunicacao_proatividade || 0) + (e.comunicacao_conhecimento_produto || 0)) / 4;
    return sum + comm;
  }, 0) / totalEvaluations;
  
  const avgConductionScore = data.reduce((sum, e: any) => sum + (e.conducao || 0), 0) / totalEvaluations;

  // Calculate objection efficiency
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
    objectionEfficiency: Math.round(objectionEfficiency * 10) / 10,
  };
}

function calculateVariation(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

export function usePeriodComparison(startDate: Date, endDate: Date) {
  return useQuery({
    queryKey: ['period-comparison', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd')],
    queryFn: async (): Promise<PeriodComparison> => {
      const periodDays = differenceInDays(endDate, startDate) + 1;
      const previousStart = subDays(startDate, periodDays);
      const previousEnd = subDays(startDate, 1);

      const [current, previous] = await Promise.all([
        fetchPeriodMetrics(startDate, endDate),
        fetchPeriodMetrics(previousStart, previousEnd),
      ]);

      return {
        totalEvaluations: {
          current: current.totalEvaluations,
          previous: previous.totalEvaluations,
          variation: calculateVariation(current.totalEvaluations, previous.totalEvaluations),
        },
        avgScore: {
          current: current.avgScore,
          previous: previous.avgScore,
          variation: calculateVariation(current.avgScore, previous.avgScore),
        },
        closingRate: {
          current: current.closingRate,
          previous: previous.closingRate,
          variation: calculateVariation(current.closingRate, previous.closingRate),
        },
        avgObjectionScore: {
          current: current.avgObjectionScore,
          previous: previous.avgObjectionScore,
          variation: calculateVariation(current.avgObjectionScore, previous.avgObjectionScore),
        },
        avgCommunicationScore: {
          current: current.avgCommunicationScore,
          previous: previous.avgCommunicationScore,
          variation: calculateVariation(current.avgCommunicationScore, previous.avgCommunicationScore),
        },
        avgConductionScore: {
          current: current.avgConductionScore,
          previous: previous.avgConductionScore,
          variation: calculateVariation(current.avgConductionScore, previous.avgConductionScore),
        },
        objectionEfficiency: {
          current: current.objectionEfficiency,
          previous: previous.objectionEfficiency,
          variation: calculateVariation(current.objectionEfficiency, previous.objectionEfficiency),
        },
      };
    },
  });
}
