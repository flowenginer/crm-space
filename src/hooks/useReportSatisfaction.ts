import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, format } from 'date-fns';

interface DateRange {
  from: Date;
  to: Date;
}

export interface SatisfactionSurvey {
  id: string;
  conversation_id: string | null;
  contact_id: string | null;
  agent_id: string | null;
  survey_type: 'nps' | 'csat';
  score: number | null;
  response: string | null;
  status: string;
  responded_at: string | null;
  created_at: string;
  contact?: { full_name: string } | null;
  agent?: { full_name: string; avatar_url: string | null } | null;
}

export interface SatisfactionMetrics {
  npsScore: number; // -100 to 100
  csatPercent: number; // 0-100
  totalSurveys: number;
  totalResponses: number;
  responseRate: number;
  promoters: number;
  passives: number;
  detractors: number;
  satisfiedCount: number;
  neutralCount: number;
  dissatisfiedCount: number;
}

export interface AgentSatisfaction {
  agent_id: string;
  agent_name: string;
  avatar_url: string | null;
  total_surveys: number;
  total_responses: number;
  nps_score: number;
  csat_percent: number;
}

export interface SatisfactionTrend {
  date: string;
  nps: number;
  csat: number;
  responses: number;
}

export function useReportSatisfaction(dateRange: DateRange | undefined) {
  return useQuery({
    queryKey: ['report-satisfaction', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<{
      metrics: SatisfactionMetrics;
      agents: AgentSatisfaction[];
      timeline: SatisfactionTrend[];
      recentSurveys: SatisfactionSurvey[];
    }> => {
      if (!dateRange?.from || !dateRange?.to) {
        return {
          metrics: {
            npsScore: 0,
            csatPercent: 0,
            totalSurveys: 0,
            totalResponses: 0,
            responseRate: 0,
            promoters: 0,
            passives: 0,
            detractors: 0,
            satisfiedCount: 0,
            neutralCount: 0,
            dissatisfiedCount: 0,
          },
          agents: [],
          timeline: [],
          recentSurveys: [],
        };
      }

      const startDate = startOfDay(dateRange.from).toISOString();
      const endDate = endOfDay(dateRange.to).toISOString();

      // Fetch satisfaction surveys
      const { data: surveys } = await supabase
        .from('satisfaction_surveys')
        .select(`
          id,
          conversation_id,
          contact_id,
          agent_id,
          survey_type,
          score,
          response,
          status,
          responded_at,
          created_at,
          contacts:contact_id(full_name),
          profiles:agent_id(full_name, avatar_url)
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false });

      const allSurveys = (surveys || []) as any[];
      const responded = allSurveys.filter(s => s.status === 'responded' && s.score !== null);
      
      // Calculate NPS metrics
      const npsSurveys = responded.filter(s => s.survey_type === 'nps');
      const promoters = npsSurveys.filter(s => s.score >= 9).length;
      const passives = npsSurveys.filter(s => s.score >= 7 && s.score <= 8).length;
      const detractors = npsSurveys.filter(s => s.score <= 6).length;
      const npsScore = npsSurveys.length > 0 
        ? Math.round(((promoters - detractors) / npsSurveys.length) * 100)
        : 0;

      // Calculate CSAT metrics
      const csatSurveys = responded.filter(s => s.survey_type === 'csat');
      const satisfiedCount = csatSurveys.filter(s => s.score >= 4).length;
      const neutralCount = csatSurveys.filter(s => s.score === 3).length;
      const dissatisfiedCount = csatSurveys.filter(s => s.score <= 2).length;
      const csatPercent = csatSurveys.length > 0 
        ? Math.round((satisfiedCount / csatSurveys.length) * 100)
        : 0;

      // Agent aggregation
      const agentMap = new Map<string, {
        agent_id: string;
        agent_name: string;
        avatar_url: string | null;
        total_surveys: number;
        nps_scores: number[];
        csat_scores: number[];
      }>();

      responded.forEach((s: any) => {
        if (!s.agent_id || !s.profiles) return;
        
        if (!agentMap.has(s.agent_id)) {
          agentMap.set(s.agent_id, {
            agent_id: s.agent_id,
            agent_name: s.profiles.full_name || 'Sem nome',
            avatar_url: s.profiles.avatar_url,
            total_surveys: 0,
            nps_scores: [],
            csat_scores: [],
          });
        }
        
        const agent = agentMap.get(s.agent_id)!;
        agent.total_surveys++;
        
        if (s.survey_type === 'nps' && s.score !== null) {
          agent.nps_scores.push(s.score);
        } else if (s.survey_type === 'csat' && s.score !== null) {
          agent.csat_scores.push(s.score);
        }
      });

      const agents: AgentSatisfaction[] = Array.from(agentMap.values()).map(a => {
        const agentPromoters = a.nps_scores.filter(s => s >= 9).length;
        const agentDetractors = a.nps_scores.filter(s => s <= 6).length;
        const agentNps = a.nps_scores.length > 0 
          ? Math.round(((agentPromoters - agentDetractors) / a.nps_scores.length) * 100)
          : 0;
        
        const agentSatisfied = a.csat_scores.filter(s => s >= 4).length;
        const agentCsat = a.csat_scores.length > 0 
          ? Math.round((agentSatisfied / a.csat_scores.length) * 100)
          : 0;

        return {
          agent_id: a.agent_id,
          agent_name: a.agent_name,
          avatar_url: a.avatar_url,
          total_surveys: a.total_surveys,
          total_responses: a.nps_scores.length + a.csat_scores.length,
          nps_score: agentNps,
          csat_percent: agentCsat,
        };
      }).sort((a, b) => b.nps_score - a.nps_score);

      // Timeline aggregation
      const timelineMap = new Map<string, { nps_scores: number[]; csat_scores: number[]; responses: number }>();
      
      responded.forEach((s: any) => {
        const dateKey = format(new Date(s.responded_at || s.created_at), 'dd/MM');
        
        if (!timelineMap.has(dateKey)) {
          timelineMap.set(dateKey, { nps_scores: [], csat_scores: [], responses: 0 });
        }
        
        const t = timelineMap.get(dateKey)!;
        t.responses++;
        
        if (s.survey_type === 'nps' && s.score !== null) {
          t.nps_scores.push(s.score);
        } else if (s.survey_type === 'csat' && s.score !== null) {
          t.csat_scores.push(s.score);
        }
      });

      const timeline = Array.from(timelineMap.entries())
        .map(([date, data]) => {
          const dayPromoters = data.nps_scores.filter(s => s >= 9).length;
          const dayDetractors = data.nps_scores.filter(s => s <= 6).length;
          const dayNps = data.nps_scores.length > 0 
            ? Math.round(((dayPromoters - dayDetractors) / data.nps_scores.length) * 100)
            : 0;
          
          const daySatisfied = data.csat_scores.filter(s => s >= 4).length;
          const dayCsat = data.csat_scores.length > 0 
            ? Math.round((daySatisfied / data.csat_scores.length) * 100)
            : 0;

          return { date, nps: dayNps, csat: dayCsat, responses: data.responses };
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      // Recent surveys
      const recentSurveys = allSurveys.slice(0, 10).map((s: any) => ({
        id: s.id,
        conversation_id: s.conversation_id,
        contact_id: s.contact_id,
        agent_id: s.agent_id,
        survey_type: s.survey_type,
        score: s.score,
        response: s.response,
        status: s.status,
        responded_at: s.responded_at,
        created_at: s.created_at,
        contact: s.contacts,
        agent: s.profiles,
      }));

      return {
        metrics: {
          npsScore,
          csatPercent,
          totalSurveys: allSurveys.length,
          totalResponses: responded.length,
          responseRate: allSurveys.length > 0 ? Math.round((responded.length / allSurveys.length) * 100) : 0,
          promoters,
          passives,
          detractors,
          satisfiedCount,
          neutralCount,
          dissatisfiedCount,
        },
        agents,
        timeline,
        recentSurveys,
      };
    },
    enabled: !!dateRange?.from && !!dateRange?.to,
    staleTime: 5 * 60 * 1000,
  });
}
