import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';

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

// Normalizar utm_medium para nome de segmento
function normalizeUtmMedium(utmMedium: string | null): string {
  if (!utmMedium) return 'Sem Segmento';
  try {
    return decodeURIComponent(utmMedium).trim() || 'Sem Segmento';
  } catch {
    return utmMedium.trim() || 'Sem Segmento';
  }
}

export function useMetaSegmentROI(dateRange?: DateRange) {
  // Obter tenant_id do store para filtrar queries
  const { tenantId } = useUserStore();

  return useQuery({
    queryKey: ['meta_segment_roi', dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), tenantId],
    queryFn: async (): Promise<SegmentROIData[]> => {
      if (!tenantId) {
        return [];
      }

      // Buscar configurações de conversão dinâmicas - FILTRADO POR TENANT
      const { data: settings } = await supabase
        .from('company_settings')
        .select('conversion_status_ids')
        .eq('tenant_id', tenantId)
        .limit(1)
        .single();

      const conversionStatusIds = settings?.conversion_status_ids || [];

      // Buscar nomes dos status de conversão - FILTRADO POR TENANT
      let conversionStatusNames = new Set<string>();
      if (conversionStatusIds.length > 0) {
        const { data: conversionStatuses } = await supabase
          .from('lead_statuses')
          .select('name')
          .eq('tenant_id', tenantId)
          .in('id', conversionStatusIds);

        conversionStatuses?.forEach(s => {
          if (s.name) conversionStatusNames.add(s.name);
        });
      }

      // Fallback para status padrão se nenhum configurado
      if (conversionStatusNames.size === 0) {
        conversionStatusNames.add('07 - Pedido Fechado');
      }

      // Buscar campanhas (todas, não apenas ativas) - FILTRADO POR TENANT
      const { data: campaigns } = await supabase
        .from('meta_campaigns')
        .select('id, campaign_id, name, status')
        .eq('tenant_id', tenantId);

      const campaignIdMap: Record<string, { name: string; segment: string }> = {};
      campaigns?.forEach(c => {
        campaignIdMap[c.id] = {
          name: c.name,
          segment: extractSegmentFromCampaignName(c.name)
        };
      });

      // Buscar insights agregados - FILTRADO POR TENANT
      let insightsQuery = supabase
        .from('meta_campaign_insights')
        .select('campaign_id, spend, impressions, clicks')
        .eq('tenant_id', tenantId);

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

      // Buscar meta_ads para mapear sourceId → segment - FILTRADO POR TENANT
      const { data: metaAds } = await supabase
        .from('meta_ads')
        .select('ad_id, campaign_id')
        .eq('tenant_id', tenantId);

      const adToSegmentMap: Record<string, string> = {};
      metaAds?.forEach(ad => {
        if (ad.campaign_id && campaignIdMap[ad.campaign_id]) {
          adToSegmentMap[ad.ad_id] = campaignIdMap[ad.campaign_id].segment;
        }
      });

      // Mapa para agregar dados por segmento
      const crmDataMap: Record<string, { leads: number; conversions: number; revenue: number }> = {};
      const processedContacts = new Set<string>();

      // ========================================
      // FONTE 1: Meta Ads - USANDO contacts.origin (igual ao CRM Dashboard)
      // ========================================
      const PAGE_SIZE = 1000;
      let allContacts: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('contacts')
          .select('id, lead_status, negotiated_value, referral_data, created_at')
          .eq('tenant_id', tenantId)
          .eq('origin', 'meta_ads')
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (dateRange?.from) {
          query = query.gte('created_at', toUTCDate(dateRange.from, false));
        }
        if (dateRange?.to) {
          query = query.lte('created_at', toUTCDate(dateRange.to, true));
        }

        const { data: contacts } = await query;

        if (contacts && contacts.length > 0) {
          allContacts = [...allContacts, ...contacts];
          hasMore = contacts.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Processar leads do Meta Ads
      allContacts.forEach((contact: any) => {
        if (processedContacts.has(contact.id)) return;
        processedContacts.add(contact.id);

        const refData = contact.referral_data as any;
        // Suportar: source_id (snake_case), sourceId (camelCase), ou utm_term (redirect)
        const sourceId = refData?.source_id || refData?.sourceId || refData?.utm_term;

        // Encontrar segmento pelo sourceId, ou usar utm_medium como fallback
        let segment = 'Sem Segmento';
        if (sourceId) {
          segment = adToSegmentMap[sourceId] || refData?.utm_medium || 'Sem Segmento';
        } else if (refData?.utm_medium) {
          segment = refData.utm_medium;
        }

        if (!crmDataMap[segment]) {
          crmDataMap[segment] = { leads: 0, conversions: 0, revenue: 0 };
        }

        crmDataMap[segment].leads++;

        const status = contact.lead_status || 'new';
        if (conversionStatusNames.has(status)) {
          crmDataMap[segment].conversions++;
          crmDataMap[segment].revenue += (contact.negotiated_value || 0);
        }
      });

      // ========================================
      // FONTE 2: Redirect (UTM) - usar utm_medium como segmento
      // ========================================
      let allRedirectLogs: any[] = [];
      page = 0;
      hasMore = true;

      while (hasMore) {
        let query = supabase
          .from('redirect_logs')
          .select(`
            id,
            contact_id,
            utm_medium,
            created_at,
            contact:contacts!inner(
              id,
              lead_status,
              negotiated_value,
              origin
            )
          `)
          .eq('tenant_id', tenantId)
          .not('contact_id', 'is', null)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (dateRange?.from) {
          query = query.gte('created_at', toUTCDate(dateRange.from, false));
        }
        if (dateRange?.to) {
          query = query.lte('created_at', toUTCDate(dateRange.to, true));
        }

        const { data: logs } = await query;

        if (logs && logs.length > 0) {
          allRedirectLogs = [...allRedirectLogs, ...logs];
          hasMore = logs.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Processar leads do Redirect (apenas os que NÃO são meta_ads)
      allRedirectLogs.forEach((log: any) => {
        const contact = log.contact;
        if (!contact) return;

        if (processedContacts.has(contact.id)) return;
        if (contact.origin === 'meta_ads') return;

        processedContacts.add(contact.id);

        // Usar utm_medium como segmento
        const segment = normalizeUtmMedium(log.utm_medium);

        if (!crmDataMap[segment]) {
          crmDataMap[segment] = { leads: 0, conversions: 0, revenue: 0 };
        }

        crmDataMap[segment].leads++;

        const status = contact.lead_status || 'new';
        if (conversionStatusNames.has(status)) {
          crmDataMap[segment].conversions++;
          crmDataMap[segment].revenue += (contact.negotiated_value || 0);
        }
      });

      // ========================================
      // Combinar dados - coletar todos os segmentos únicos
      // ========================================
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

      // Ordenar por leads (maior primeiro)
      segmentROIData.sort((a, b) => b.leads - a.leads);

      const totalLeads = segmentROIData.reduce((sum, s) => sum + s.leads, 0);
      console.log(`[useMetaSegmentROI] Loaded ${segmentROIData.length} segments with ${totalLeads} leads`);

      return segmentROIData;
    },
    staleTime: 60000,
  });
}
