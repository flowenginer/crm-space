import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SegmentBreakdown {
  assignedSegment: string;
  assignedSegmentId: string | null;
  count: number;
  layoutCount: number;
  pedidoFechadoCount: number;
  isMatch: boolean;
}

export interface SegmentJourneyData {
  campaignSegment: string;
  campaignSegmentId: string | null;
  totalLeads: number;
  matchCount: number;
  matchRate: number;
  breakdown: SegmentBreakdown[];
}

interface DateRange {
  from: Date;
  to: Date;
}

// Função para ajustar data para UTC considerando Brasília (UTC-3)
function toUTCDate(date: Date, isEndOfDay: boolean = false): string {
  const d = new Date(date);
  if (isEndOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  const utcDate = new Date(d.getTime() + (3 * 60 * 60 * 1000));
  return utcDate.toISOString();
}

// Extrai o nome do segmento a partir do nome da campanha
function extractSegmentFromCampaignName(campaignName: string, segments: { id: string; name: string }[]): { id: string; name: string } | null {
  const upperCampaignName = campaignName.toUpperCase();
  
  for (const segment of segments) {
    const upperSegmentName = segment.name.toUpperCase();
    if (upperCampaignName.includes(upperSegmentName)) {
      return segment;
    }
  }
  
  return null;
}

export function useMetaSegmentJourney(dateRange?: DateRange) {
  return useQuery({
    queryKey: ['meta_segment_journey', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<SegmentJourneyData[]> => {
      // Buscar configurações de conversão dinâmicas
      const { data: settings } = await supabase
        .from('company_settings')
        .select('conversion_status_ids')
        .limit(1)
        .single();

      const conversionStatusIds = settings?.conversion_status_ids || [];

      // Buscar nomes dos status de conversão
      let conversionStatusNames = new Set<string>();
      if (conversionStatusIds.length > 0) {
        const { data: conversionStatuses } = await supabase
          .from('lead_statuses')
          .select('name')
          .in('id', conversionStatusIds);
        
        conversionStatuses?.forEach(s => {
          if (s.name) conversionStatusNames.add(s.name);
        });
      }

      // Fallback para status padrão se nenhum configurado
      if (conversionStatusNames.size === 0) {
        conversionStatusNames.add('07 - Pedido Fechado');
      }

      // Buscar todos os segmentos
      const { data: segments } = await supabase
        .from('segments')
        .select('id, name')
        .eq('is_active', true);

      if (!segments || segments.length === 0) {
        return [];
      }

      // Buscar TODAS campanhas (não apenas ativas) para incluir leads de campanhas pausadas
      const { data: campaigns } = await supabase
        .from('meta_campaigns')
        .select('id, name');

      if (!campaigns || campaigns.length === 0) {
        return [];
      }

      // Mapear campanhas para segmentos baseado no nome
      const campaignToSegment = new Map<string, { id: string; name: string }>();
      campaigns.forEach(campaign => {
        const segment = extractSegmentFromCampaignName(campaign.name, segments);
        if (segment) {
          campaignToSegment.set(campaign.id, segment);
        }
      });

      // Buscar meta_ads para mapear sourceId → campaign
      const { data: metaAds } = await supabase
        .from('meta_ads')
        .select('ad_id, campaign_id');

      const adToCampaignMap: Record<string, string> = {};
      metaAds?.forEach(ad => {
        if (ad.campaign_id) {
          adToCampaignMap[ad.ad_id] = ad.campaign_id;
        }
      });

      // Buscar conversas de Meta Ads (com paginação)
      const PAGE_SIZE = 1000;
      let allConversations: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('conversations')
          .select(`
            id,
            referral_data,
            contact:contacts!inner(
              id,
              lead_status,
              segment_id
            )
          `)
          .eq('referral_source', 'meta_ads')
          .not('referral_data', 'is', null)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (dateRange?.from) {
          query = query.gte('created_at', toUTCDate(dateRange.from, false));
        }
        if (dateRange?.to) {
          query = query.lte('created_at', toUTCDate(dateRange.to, true));
        }

        const { data: convData } = await query;
        
        if (convData && convData.length > 0) {
          allConversations = [...allConversations, ...convData];
          hasMore = convData.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      const conversations = allConversations;

      if (!conversations || conversations.length === 0) {
        return [];
      }

      // Criar mapa de segment_id -> nome
      const segmentIdToName = new Map<string, string>();
      segments.forEach(s => segmentIdToName.set(s.id, s.name));

      // Agrupar leads por segmento da campanha
      const journeyData = new Map<string, {
        campaignSegmentId: string | null;
        totalLeads: number;
        breakdown: Map<string, {
          segmentId: string | null;
          count: number;
          layoutCount: number;
          pedidoFechadoCount: number;
        }>;
      }>();

      const processedContacts = new Set<string>();

      conversations.forEach((conv: any) => {
        const refData = conv.referral_data as any;
        const sourceId = refData?.sourceId;
        const contact = conv.contact;

        if (!sourceId || !contact) return;

        // Evitar contar o mesmo contato múltiplas vezes
        if (processedContacts.has(contact.id)) return;
        processedContacts.add(contact.id);

        const campaignId = adToCampaignMap[sourceId];
        if (!campaignId) return;

        const campaignSegment = campaignToSegment.get(campaignId);
        if (!campaignSegment) return;

        const campaignSegmentName = campaignSegment.name;
        const assignedSegmentId = contact.segment_id;
        const assignedSegmentName = assignedSegmentId ? (segmentIdToName.get(assignedSegmentId) || 'Desconhecido') : 'Sem Segmento';

        if (!journeyData.has(campaignSegmentName)) {
          journeyData.set(campaignSegmentName, {
            campaignSegmentId: campaignSegment.id,
            totalLeads: 0,
            breakdown: new Map()
          });
        }

        const data = journeyData.get(campaignSegmentName)!;
        data.totalLeads++;

        if (!data.breakdown.has(assignedSegmentName)) {
          data.breakdown.set(assignedSegmentName, {
            segmentId: assignedSegmentId,
            count: 0,
            layoutCount: 0,
            pedidoFechadoCount: 0
          });
        }

        const breakdownData = data.breakdown.get(assignedSegmentName)!;
        breakdownData.count++;

        const status = contact.lead_status || '';
        if (status.includes('04 - Layout') || status.toLowerCase().includes('layout')) {
          breakdownData.layoutCount++;
        }
        if (conversionStatusNames.has(status)) {
          breakdownData.pedidoFechadoCount++;
        }
      });

      // Converter para array final
      const result: SegmentJourneyData[] = [];

      journeyData.forEach((data, campaignSegmentName) => {
        const breakdown: SegmentBreakdown[] = [];
        let matchCount = 0;

        data.breakdown.forEach((bd, assignedSegmentName) => {
          const isMatch = assignedSegmentName.toUpperCase() === campaignSegmentName.toUpperCase();
          if (isMatch) {
            matchCount = bd.count;
          }

          breakdown.push({
            assignedSegment: assignedSegmentName,
            assignedSegmentId: bd.segmentId,
            count: bd.count,
            layoutCount: bd.layoutCount,
            pedidoFechadoCount: bd.pedidoFechadoCount,
            isMatch
          });
        });

        // Ordenar breakdown: primeiro o match, depois por contagem
        breakdown.sort((a, b) => {
          if (a.isMatch && !b.isMatch) return -1;
          if (!a.isMatch && b.isMatch) return 1;
          return b.count - a.count;
        });

        result.push({
          campaignSegment: campaignSegmentName,
          campaignSegmentId: data.campaignSegmentId,
          totalLeads: data.totalLeads,
          matchCount,
          matchRate: data.totalLeads > 0 ? (matchCount / data.totalLeads) * 100 : 0,
          breakdown
        });
      });

      // Ordenar por total de leads
      result.sort((a, b) => b.totalLeads - a.totalLeads);

      return result;
    },
    staleTime: 60000,
  });
}
