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

  // Fonte dos leads
  source: 'meta_ads' | 'redirect' | 'mixed';
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

// Função para normalizar nome de campanha para comparação
function normalizeCampaignName(name: string): string {
  return (name || '').toLowerCase().trim();
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
      const campaignNameToIdMap: Record<string, string> = {}; // Para matching com utm_campaign
      campaigns?.forEach(c => {
        campaignIdMap[c.id] = { name: c.name, internalId: c.campaign_id };
        campaignNameToIdMap[normalizeCampaignName(c.name)] = c.id;
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

      // Mapa para agregar dados por campanha
      const crmDataMap: Record<string, { leads: number; conversions: number; revenue: number; source: 'meta_ads' | 'redirect' | 'mixed' }> = {};
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

        // Encontrar campanha pelo sourceId
        let campaignId: string | null = null;
        if (sourceId) {
          campaignId = adToCampaignMap[sourceId] || null;
        }

        // Se não encontrou campanha, agrupar como "Sem Campanha Identificada"
        const campaignKey = campaignId || 'meta_unknown';

        if (!crmDataMap[campaignKey]) {
          crmDataMap[campaignKey] = { leads: 0, conversions: 0, revenue: 0, source: 'meta_ads' };

          // Se é campanha desconhecida, criar entrada no map
          if (!campaignId) {
            // Usar utm_campaign como nome se disponível (redirect UTM)
            const campaignName = refData?.utm_campaign && refData.utm_campaign !== 'meta_ads'
              ? refData.utm_campaign
              : 'Campanha Não Identificada';
            campaignIdMap[campaignKey] = { name: campaignName, internalId: campaignKey };
          }
        }

        crmDataMap[campaignKey].leads++;

        const status = contact.lead_status || 'new';
        if (conversionStatusNames.has(status)) {
          crmDataMap[campaignKey].conversions++;
          crmDataMap[campaignKey].revenue += (contact.negotiated_value || 0);
        }
      });

      // ========================================
      // FONTE 2: Redirect (UTM)
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
            utm_campaign,
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

        const utmCampaign = (log.utm_campaign || '').trim();
        if (!utmCampaign) return;

        // Tentar encontrar campanha Meta correspondente pelo nome
        const matchedCampaignId = campaignNameToIdMap[normalizeCampaignName(utmCampaign)];

        const campaignKey = matchedCampaignId || `redirect_${utmCampaign}`;

        if (!crmDataMap[campaignKey]) {
          crmDataMap[campaignKey] = {
            leads: 0,
            conversions: 0,
            revenue: 0,
            source: matchedCampaignId ? 'mixed' : 'redirect'
          };

          if (!matchedCampaignId) {
            campaignIdMap[campaignKey] = { name: utmCampaign, internalId: campaignKey };
          }
        } else if (matchedCampaignId && crmDataMap[campaignKey].source === 'meta_ads') {
          crmDataMap[campaignKey].source = 'mixed';
        }

        crmDataMap[campaignKey].leads++;

        const status = contact.lead_status || 'new';
        if (conversionStatusNames.has(status)) {
          crmDataMap[campaignKey].conversions++;
          crmDataMap[campaignKey].revenue += (contact.negotiated_value || 0);
        }
      });

      // ========================================
      // Combinar dados
      // ========================================
      const campaignROIData: CampaignROIData[] = [];

      Object.entries(campaignIdMap).forEach(([internalCampaignId, { name, internalId }]) => {
        const insightData = insightsMap[internalCampaignId] || { spend: 0, impressions: 0, clicks: 0 };
        const crmData = crmDataMap[internalCampaignId] || { leads: 0, conversions: 0, revenue: 0, source: 'meta_ads' as const };

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
          source: crmData.source,
        });
      });

      // Ordenar por leads (maior primeiro)
      campaignROIData.sort((a, b) => b.leads - a.leads);

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

      console.log(`[useMetaCampaignROI] Loaded ${campaignROIData.length} campaigns with ${totalLeads} leads`);

      return { campaigns: campaignROIData, summary };
    },
    staleTime: 60000,
  });
}
