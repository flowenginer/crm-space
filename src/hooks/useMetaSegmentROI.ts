import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SegmentROIData {
  segmentName: string;
  
  // Do Meta API (agregado por campanhas do segmento)
  spend: number;
  impressions: number;
  clicks: number;
  
  // Do CRM
  leads: number;
  conversions: number;
  revenue: number;
  
  // Calculados
  cpl: number;
  cac: number;
  roi: number;
  roas: number;
}

interface DateRange {
  from: Date;
  to: Date;
}

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

// Extrair segmento do nome da campanha (ex: "VENDAS | TELECOM | ..." → "TELECOM")
function extractSegmentFromCampaignName(name: string): string {
  const parts = name.split('|').map(p => p.trim());
  if (parts.length >= 2) {
    return parts[1];
  }
  return 'Sem Segmento';
}

export function useMetaSegmentROI(dateRange?: DateRange) {
  return useQuery({
    queryKey: ['meta_segment_roi', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<SegmentROIData[]> => {
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

      // Buscar campanhas (todas, não apenas ativas)
      const { data: campaigns } = await supabase
        .from('meta_campaigns')
        .select('id, campaign_id, name, status');

      const campaignIdMap: Record<string, { name: string; segment: string }> = {};
      campaigns?.forEach(c => {
        campaignIdMap[c.id] = { 
          name: c.name, 
          segment: extractSegmentFromCampaignName(c.name) 
        };
      });

      // Buscar insights agregados
      let insightsQuery = supabase
        .from('meta_campaign_insights')
        .select('campaign_id, spend, impressions, clicks');

      if (dateRange?.from) {
        insightsQuery = insightsQuery.gte('date_start', dateRange.from.toISOString().split('T')[0]);
      }
      if (dateRange?.to) {
        insightsQuery = insightsQuery.lte('date_stop', dateRange.to.toISOString().split('T')[0]);
      }

      const { data: insights } = await insightsQuery;

      // Agregar insights por segmento
      const segmentInsightsMap: Record<string, { spend: number; impressions: number; clicks: number }> = {};
      insights?.forEach(i => {
        const campaignData = campaignIdMap[i.campaign_id];
        if (!campaignData) return;
        
        const segment = campaignData.segment;
        if (!segmentInsightsMap[segment]) {
          segmentInsightsMap[segment] = { spend: 0, impressions: 0, clicks: 0 };
        }
        segmentInsightsMap[segment].spend += Number(i.spend || 0);
        segmentInsightsMap[segment].impressions += Number(i.impressions || 0);
        segmentInsightsMap[segment].clicks += Number(i.clicks || 0);
      });

      // Buscar meta_ads para mapear sourceId → segment
      const { data: metaAds } = await supabase
        .from('meta_ads')
        .select('ad_id, campaign_id');

      const adToSegmentMap: Record<string, string> = {};
      metaAds?.forEach(ad => {
        if (ad.campaign_id && campaignIdMap[ad.campaign_id]) {
          adToSegmentMap[ad.ad_id] = campaignIdMap[ad.campaign_id].segment;
        }
      });

      // Buscar conversas de Meta Ads (com paginação)
      const PAGE_SIZE = 1000;
      let allConversations: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        let convQuery = supabase
          .from('conversations')
          .select(`
            referral_data,
            contact:contacts!inner(
              lead_status,
              negotiated_value
            )
          `)
          .eq('referral_source', 'meta_ads')
          .not('referral_data', 'is', null)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (dateRange?.from) {
          convQuery = convQuery.gte('created_at', toUTCDate(dateRange.from, false));
        }
        if (dateRange?.to) {
          convQuery = convQuery.lte('created_at', toUTCDate(dateRange.to, true));
        }

        const { data: convData } = await convQuery;
        
        if (convData && convData.length > 0) {
          allConversations = [...allConversations, ...convData];
          hasMore = convData.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      const conversations = allConversations;

      // Agrupar leads/conversões/receita por segmento
      const crmDataMap: Record<string, { leads: number; conversions: number; revenue: number }> = {};

      conversations?.forEach(conv => {
        const refData = conv.referral_data as any;
        const contact = conv.contact as any;
        const sourceId = refData?.sourceId;

        if (!sourceId) return;

        const segment = adToSegmentMap[sourceId] || 'Sem Segmento';

        if (!crmDataMap[segment]) {
          crmDataMap[segment] = { leads: 0, conversions: 0, revenue: 0 };
        }

        crmDataMap[segment].leads++;

        const status = contact?.lead_status || 'new';
        if (conversionStatusNames.has(status)) {
          crmDataMap[segment].conversions++;
          crmDataMap[segment].revenue += (contact?.negotiated_value || 0);
        }
      });

      // Combinar dados - coletar todos os segmentos únicos
      const allSegments = new Set<string>();
      Object.keys(segmentInsightsMap).forEach(s => allSegments.add(s));
      Object.keys(crmDataMap).forEach(s => allSegments.add(s));

      const segmentROIData: SegmentROIData[] = [];

      allSegments.forEach(segment => {
        const insightData = segmentInsightsMap[segment] || { spend: 0, impressions: 0, clicks: 0 };
        const crmData = crmDataMap[segment] || { leads: 0, conversions: 0, revenue: 0 };

        if (insightData.spend === 0 && crmData.leads === 0) return;

        const spend = insightData.spend;
        const leads = crmData.leads;
        const conversions = crmData.conversions;
        const revenue = crmData.revenue;

        segmentROIData.push({
          segmentName: segment,
          spend,
          impressions: insightData.impressions,
          clicks: insightData.clicks,
          leads,
          conversions,
          revenue,
          cpl: leads > 0 ? spend / leads : 0,
          cac: conversions > 0 ? spend / conversions : 0,
          roi: spend > 0 ? ((revenue - spend) / spend) * 100 : 0,
          roas: spend > 0 ? revenue / spend : 0,
        });
      });

      segmentROIData.sort((a, b) => b.spend - a.spend);

      return segmentROIData;
    },
    staleTime: 60000,
  });
}
