import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';

export interface CampaignROIData {
  campaignId: string;
  campaignName: string;
  
  // Do Meta API
  spend: number;
  impressions: number;
  clicks: number;
  
  // Do CRM
  leads: number;
  conversions: number;
  revenue: number;
  
  // Calculados
  cpl: number;          // Custo por Lead (spend / leads)
  cac: number;          // Custo por Conversão (spend / conversions)
  roi: number;          // ROI % ((revenue - spend) / spend * 100)
  roas: number;         // ROAS (revenue / spend)
}

export interface ROISummary {
  totalSpend: number;
  totalLeads: number;
  totalConversions: number;
  totalRevenue: number;
  averageCPL: number;
  averageCAC: number;
  overallROI: number;
  overallROAS: number;
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
  // Adiciona 3 horas para compensar UTC-3 de Brasília
  const utcDate = new Date(d.getTime() + (3 * 60 * 60 * 1000));
  return utcDate.toISOString();
}

export function useMetaCampaignROI(dateRange?: DateRange) {
  // Obter tenant_id do store para filtrar queries
  const { tenantId } = useUserStore();

  return useQuery({
    queryKey: ['meta_campaign_roi', dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), tenantId],
    queryFn: async (): Promise<{ campaigns: CampaignROIData[]; summary: ROISummary }> => {
      if (!tenantId) {
        return { campaigns: [], summary: { totalSpend: 0, totalLeads: 0, totalConversions: 0, totalRevenue: 0, averageCPL: 0, averageCAC: 0, overallROI: 0, overallROAS: 0 } };
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

      // Buscar TODAS campanhas (não apenas ativas) para incluir leads de campanhas pausadas - FILTRADO POR TENANT
      const { data: campaigns } = await supabase
        .from('meta_campaigns')
        .select(`
          id,
          campaign_id,
          name,
          status
        `)
        .eq('tenant_id', tenantId);

      const campaignIdMap: Record<string, { name: string; internalId: string }> = {};
      campaigns?.forEach(c => {
        campaignIdMap[c.id] = { name: c.name, internalId: c.campaign_id };
      });

      // Buscar insights agregados por campanha - FILTRADO POR TENANT
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

      // Agregar insights por campaign_id
      const insightsMap: Record<string, { spend: number; impressions: number; clicks: number }> = {};
      insights?.forEach(i => {
        if (!insightsMap[i.campaign_id]) {
          insightsMap[i.campaign_id] = { spend: 0, impressions: 0, clicks: 0 };
        }
        insightsMap[i.campaign_id].spend += Number(i.spend || 0);
        insightsMap[i.campaign_id].impressions += Number(i.impressions || 0);
        insightsMap[i.campaign_id].clicks += Number(i.clicks || 0);
      });

      // Buscar meta_ads para mapear sourceId → campaign - FILTRADO POR TENANT
      const { data: metaAds } = await supabase
        .from('meta_ads')
        .select('ad_id, campaign_id')
        .eq('tenant_id', tenantId);

      const adToCampaignMap: Record<string, string> = {};
      metaAds?.forEach(ad => {
        if (ad.campaign_id) {
          adToCampaignMap[ad.ad_id] = ad.campaign_id;
        }
      });

      // Buscar conversas de Meta Ads com dados de conversão (com paginação)
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

      // Agrupar leads/conversões/receita por campanha
      const crmDataMap: Record<string, { leads: number; conversions: number; revenue: number }> = {};

      conversations?.forEach(conv => {
        const refData = conv.referral_data as any;
        const contact = conv.contact as any;
        const sourceId = refData?.sourceId;

        if (!sourceId) return;

        const campaignId = adToCampaignMap[sourceId];
        if (!campaignId) return;

        if (!crmDataMap[campaignId]) {
          crmDataMap[campaignId] = { leads: 0, conversions: 0, revenue: 0 };
        }

        crmDataMap[campaignId].leads++;

        const status = contact?.lead_status || 'new';
        if (conversionStatusNames.has(status)) {
          crmDataMap[campaignId].conversions++;
          crmDataMap[campaignId].revenue += (contact?.negotiated_value || 0);
        }
      });

      // Combinar dados
      const campaignROIData: CampaignROIData[] = [];

      Object.entries(campaignIdMap).forEach(([internalCampaignId, { name, internalId }]) => {
        const insightData = insightsMap[internalCampaignId] || { spend: 0, impressions: 0, clicks: 0 };
        const crmData = crmDataMap[internalCampaignId] || { leads: 0, conversions: 0, revenue: 0 };

        // Só incluir campanhas que têm dados (spend ou leads)
        if (insightData.spend === 0 && crmData.leads === 0) return;

        const spend = insightData.spend;
        const leads = crmData.leads;
        const conversions = crmData.conversions;
        const revenue = crmData.revenue;

        campaignROIData.push({
          campaignId: internalId,
          campaignName: name,
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

      // Ordenar por spend (maior primeiro)
      campaignROIData.sort((a, b) => b.spend - a.spend);

      // Calcular sumário
      const totalSpend = campaignROIData.reduce((sum, c) => sum + c.spend, 0);
      const totalLeads = campaignROIData.reduce((sum, c) => sum + c.leads, 0);
      const totalConversions = campaignROIData.reduce((sum, c) => sum + c.conversions, 0);
      const totalRevenue = campaignROIData.reduce((sum, c) => sum + c.revenue, 0);

      const summary: ROISummary = {
        totalSpend,
        totalLeads,
        totalConversions,
        totalRevenue,
        averageCPL: totalLeads > 0 ? totalSpend / totalLeads : 0,
        averageCAC: totalConversions > 0 ? totalSpend / totalConversions : 0,
        overallROI: totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0,
        overallROAS: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      };

      return { campaigns: campaignROIData, summary };
    },
    staleTime: 60000,
  });
}
