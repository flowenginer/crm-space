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
  byCampaign: MetaCampaignDashboardData[];
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

export function useMetaAdsDashboard(selectedCampaignId?: string) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  return useQuery({
    queryKey: ['meta-ads-dashboard', tenantId, selectedCampaignId],
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
        .select('ad_id, campaign_id');

      if (adsError) throw adsError;

      // Criar mapa de ad_id -> campaign info
      const adToCampaignMap: Record<string, { campaignId: string; campaignName: string }> = {};
      ads?.forEach(ad => {
        const campaign = campaigns?.find(c => c.campaign_id === ad.campaign_id);
        if (campaign) {
          adToCampaignMap[ad.ad_id] = {
            campaignId: campaign.id,
            campaignName: campaign.name
          };
        }
      });

      // 4. Buscar contatos do Meta Ads
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, referral_data, lead_status')
        .eq('tenant_id', tenantId)
        .eq('origin', 'meta_ads');

      if (contactsError) throw contactsError;

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

      // Processar contatos e agrupar por campanha
      const leadsByCampaign: Record<string, Set<string>> = {};
      const statusByCampaign: Record<string, Record<string, number>> = {};
      const globalStatusCount: Record<string, number> = {};

      contacts?.forEach(contact => {
        const refData = contact.referral_data as any;
        const sourceId = refData?.sourceId;
        
        if (!sourceId) return;

        const campaignInfo = adToCampaignMap[sourceId];
        if (!campaignInfo) return;

        // Se temos filtro de campanha, verificar
        if (selectedCampaignId && campaignInfo.campaignId !== selectedCampaignId) {
          return;
        }

        const campaignId = campaignInfo.campaignId;
        const leadStatus = contact.lead_status || 'sem_status';

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
            views: campaignLeads, // Views = Leads para Meta Ads
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

      return {
        summary: {
          totalViews: totalLeads, // Views = Leads para Meta Ads
          totalLeads,
          leadsInCatalogo,
          leadsInLayout,
          pedidosFechados,
          conversionRate: totalLeads > 0 ? (pedidosFechados / totalLeads) * 100 : 0,
          statusBreakdown
        },
        byCampaign,
        leadStatuses: leadStatuses || []
      };
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
