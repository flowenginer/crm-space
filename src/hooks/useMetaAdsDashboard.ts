import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface LeadStatusMetrics {
  statusId: string;
  statusName: string;
  color: string | null;
  count: number;
}

export interface MetaCampaignDashboardData {
  campaignId: string;
  campaignName: string;
  views: number;
  leads: number;
  statusBreakdown: LeadStatusMetrics[];
  conversionRate: number;
}

export interface MetaInsights {
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
}

export interface MetaAdBreakdown {
  adId: string;
  adName: string;
  platform: string;
  leads: number;
  catalogo: number;
  layout: number;
  fechados: number;
}

export interface MetaAdsDashboardSummary {
  totalViews: number;
  totalLeads: number;
  leadsInCatalogo: number;
  leadsInLayout: number;
  pedidosFechados: number;
  conversionRate: number;
  statusBreakdown: LeadStatusMetrics[];
}

export interface MetaAdsDashboardData {
  summary: MetaAdsDashboardSummary;
  metaInsights: MetaInsights;
  byCampaign: MetaCampaignDashboardData[];
  byAd: MetaAdBreakdown[];
  leadStatuses: { id: string; name: string; color: string | null; order_position: number }[];
}

interface MetaCampaignOption {
  id: string;
  name: string;
  campaign_id: string;
}

export function useAllMetaCampaigns() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  return useQuery({
    queryKey: ['all-meta-campaigns', tenantId],
    queryFn: async (): Promise<MetaCampaignOption[]> => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('meta_campaigns')
        .select('id, name, campaign_id')
        .order('created_time', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });
}

interface UseMetaAdsDashboardParams {
  selectedCampaignId?: string;
  startDate?: string;
  endDate?: string;
}

export function useMetaAdsDashboard({ selectedCampaignId, startDate, endDate }: UseMetaAdsDashboardParams) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  return useQuery({
    queryKey: ['meta-ads-dashboard', tenantId, selectedCampaignId, startDate, endDate],
    queryFn: async (): Promise<MetaAdsDashboardData> => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      // 1. Buscar todos os lead_statuses do tenant
      const { data: leadStatuses, error: statusError } = await supabase
        .from('lead_statuses')
        .select('id, name, color, order_position')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('order_position');

      if (statusError) throw statusError;

      // 2. Buscar campanhas do Meta Ads
      const { data: campaigns, error: campaignsError } = await supabase
        .from('meta_campaigns')
        .select('id, name, campaign_id')
        .order('created_time', { ascending: false });

      if (campaignsError) throw campaignsError;

      // 3. Buscar todos os anúncios para mapear ad_id -> campaign
      const { data: ads, error: adsError } = await supabase
        .from('meta_ads')
        .select('ad_id, campaign_id, name');

      if (adsError) throw adsError;

      // Criar mapa de ad_id -> campaign info e ad name
      const adToCampaignMap: Record<string, { campaignId: string; campaignName: string; adName: string }> = {};
      ads?.forEach(ad => {
        const campaign = campaigns?.find(c => c.campaign_id === ad.campaign_id);
        if (campaign) {
          adToCampaignMap[ad.ad_id] = {
            campaignId: campaign.id,
            campaignName: campaign.name,
            adName: ad.name || 'Anúncio sem nome'
          };
        }
      });

      // 4. Buscar contatos do Meta Ads com filtro de data
      let contactsQuery = supabase
        .from('contacts')
        .select('id, referral_data, lead_status, created_at')
        .eq('tenant_id', tenantId)
        .eq('origin', 'meta_ads');

      if (startDate) {
        contactsQuery = contactsQuery.gte('created_at', `${startDate}T00:00:00`);
      }
      if (endDate) {
        contactsQuery = contactsQuery.lte('created_at', `${endDate}T23:59:59`);
      }

      const { data: contacts, error: contactsError } = await contactsQuery;

      if (contactsError) throw contactsError;

      // 5. Buscar insights do Meta Ads
      const selectedCampaign = selectedCampaignId 
        ? campaigns?.find(c => c.id === selectedCampaignId)
        : null;

      let insightsQuery = supabase
        .from('meta_campaign_insights')
        .select('impressions, clicks, ctr, spend, campaign_id');

      if (selectedCampaign) {
        insightsQuery = insightsQuery.eq('campaign_id', selectedCampaign.id);
      }
      if (startDate) {
        insightsQuery = insightsQuery.gte('date_start', startDate);
      }
      if (endDate) {
        insightsQuery = insightsQuery.lte('date_stop', endDate);
      }

      const { data: insights, error: insightsError } = await insightsQuery;

      if (insightsError) throw insightsError;

      // Calcular totais de insights
      const metaInsights: MetaInsights = {
        impressions: 0,
        clicks: 0,
        ctr: 0,
        spend: 0
      };

      insights?.forEach(insight => {
        metaInsights.impressions += Number(insight.impressions) || 0;
        metaInsights.clicks += Number(insight.clicks) || 0;
        metaInsights.spend += Number(insight.spend) || 0;
      });

      // Calcular CTR médio
      if (metaInsights.impressions > 0) {
        metaInsights.ctr = (metaInsights.clicks / metaInsights.impressions) * 100;
      }

      // Encontrar IDs dos status específicos
      const catalogoStatus = leadStatuses?.find(s => 
        s.name.toLowerCase().includes('catálogo') || s.name.toLowerCase().includes('catalogo')
      );
      const layoutStatus = leadStatuses?.find(s => 
        s.name.toLowerCase().includes('layout')
      );
      const fechadoStatus = leadStatuses?.find(s => 
        s.name.toLowerCase().includes('fechado') || s.name.toLowerCase().includes('pedido fechado')
      );

      // Processar contatos e agrupar por campanha e por anúncio
      const leadsByCampaign: Record<string, Set<string>> = {};
      const statusByCampaign: Record<string, Record<string, number>> = {};
      const globalStatusCount: Record<string, number> = {};

      // Para breakdown por anúncio
      const byAdMap: Record<string, { adId: string; adName: string; platform: string; leads: number; catalogo: number; layout: number; fechados: number }> = {};

      contacts?.forEach(contact => {
        const refData = contact.referral_data as any;
        const sourceId = refData?.sourceId;
        const sourceApp = refData?.sourceApp || 'facebook';
        
        if (!sourceId) return;

        const campaignInfo = adToCampaignMap[sourceId];
        if (!campaignInfo) return;

        // Se temos filtro de campanha, verificar
        if (selectedCampaignId && campaignInfo.campaignId !== selectedCampaignId) {
          return;
        }

        const campaignId = campaignInfo.campaignId;
        const leadStatus = contact.lead_status || 'sem_status';

        // Agrupar por campanha
        if (!leadsByCampaign[campaignId]) {
          leadsByCampaign[campaignId] = new Set();
        }
        leadsByCampaign[campaignId].add(contact.id);

        if (!statusByCampaign[campaignId]) {
          statusByCampaign[campaignId] = {};
        }
        statusByCampaign[campaignId][leadStatus] = (statusByCampaign[campaignId][leadStatus] || 0) + 1;

        // Contagem global
        globalStatusCount[leadStatus] = (globalStatusCount[leadStatus] || 0) + 1;

        // Agrupar por anúncio
        const adKey = sourceId;
        if (!byAdMap[adKey]) {
          byAdMap[adKey] = {
            adId: sourceId,
            adName: refData?.adName || campaignInfo.adName || 'Anúncio sem nome',
            platform: sourceApp,
            leads: 0,
            catalogo: 0,
            layout: 0,
            fechados: 0
          };
        }
        byAdMap[adKey].leads += 1;

        if (catalogoStatus && leadStatus === catalogoStatus.id) {
          byAdMap[adKey].catalogo += 1;
        }
        if (layoutStatus && leadStatus === layoutStatus.id) {
          byAdMap[adKey].layout += 1;
        }
        if (fechadoStatus && leadStatus === fechadoStatus.id) {
          byAdMap[adKey].fechados += 1;
        }
      });

      // Calcular totais
      let totalLeads = 0;
      let leadsInCatalogo = 0;
      let leadsInLayout = 0;
      let pedidosFechados = 0;

      Object.values(leadsByCampaign).forEach(set => {
        totalLeads += set.size;
      });

      if (catalogoStatus) {
        leadsInCatalogo = globalStatusCount[catalogoStatus.id] || 0;
      }
      if (layoutStatus) {
        leadsInLayout = globalStatusCount[layoutStatus.id] || 0;
      }
      if (fechadoStatus) {
        pedidosFechados = globalStatusCount[fechadoStatus.id] || 0;
      }

      // Processar por campanha
      const filteredCampaigns = selectedCampaignId 
        ? campaigns?.filter(c => c.id === selectedCampaignId) 
        : campaigns;

      const byCampaign: MetaCampaignDashboardData[] = (filteredCampaigns || [])
        .filter(campaign => leadsByCampaign[campaign.id]?.size > 0)
        .map(campaign => {
          const campaignLeads = leadsByCampaign[campaign.id]?.size || 0;
          const statusData = statusByCampaign[campaign.id] || {};

          const statusBreakdown: LeadStatusMetrics[] = leadStatuses?.map(ls => ({
            statusId: ls.id,
            statusName: ls.name,
            color: ls.color,
            count: statusData[ls.id] || 0
          })) || [];

          const fechados = fechadoStatus ? (statusData[fechadoStatus.id] || 0) : 0;

          return {
            campaignId: campaign.id,
            campaignName: campaign.name,
            views: campaignLeads,
            leads: campaignLeads,
            statusBreakdown,
            conversionRate: campaignLeads > 0 ? (fechados / campaignLeads) * 100 : 0
          };
        });

      const statusBreakdown: LeadStatusMetrics[] = leadStatuses?.map(ls => ({
        statusId: ls.id,
        statusName: ls.name,
        color: ls.color,
        count: globalStatusCount[ls.id] || 0
      })) || [];

      // Converter byAdMap para array
      const byAd = Object.values(byAdMap).sort((a, b) => b.leads - a.leads);

      return {
        summary: {
          totalViews: metaInsights.impressions > 0 ? metaInsights.impressions : totalLeads,
          totalLeads,
          leadsInCatalogo,
          leadsInLayout,
          pedidosFechados,
          conversionRate: totalLeads > 0 ? (pedidosFechados / totalLeads) * 100 : 0,
          statusBreakdown
        },
        metaInsights,
        byCampaign,
        byAd,
        leadStatuses: leadStatuses || []
      };
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
