import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface LeadStatusMetrics {
  statusId: string;
  statusName: string;
  color: string | null;
  count: number;
}

export interface CampaignDashboardData {
  campaignId: string;
  campaignName: string;
  views: number;
  leads: number;
  statusBreakdown: LeadStatusMetrics[];
  conversionRate: number;
}

export interface RedirectDashboardSummary {
  totalViews: number;
  totalLeads: number;
  leadsInCatalogo: number;      // 03 - Catálogo
  leadsInLayout: number;        // 04 - Layout
  pedidosFechados: number;      // 07 - Pedido Fechado
  conversionRate: number;
  statusBreakdown: LeadStatusMetrics[];
}

export interface RedirectDashboardData {
  summary: RedirectDashboardSummary;
  byCampaign: CampaignDashboardData[];
  leadStatuses: { id: string; name: string; color: string | null; order_position: number }[];
}

export function useRedirectDashboard(selectedCampaignId?: string) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  return useQuery({
    queryKey: ['redirect-dashboard', tenantId, selectedCampaignId],
    queryFn: async (): Promise<RedirectDashboardData> => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      // 1. Buscar todos os lead_statuses do tenant
      const { data: leadStatuses, error: statusError } = await supabase
        .from('lead_statuses')
        .select('id, name, color, order_position')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('order_position');

      if (statusError) throw statusError;

      // 2. Buscar campanhas com contagem de views
      let campaignsQuery = supabase
        .from('redirect_campaigns')
        .select('id, name')
        .eq('tenant_id', tenantId);

      if (selectedCampaignId) {
        campaignsQuery = campaignsQuery.eq('id', selectedCampaignId);
      }

      const { data: campaigns, error: campaignsError } = await campaignsQuery;
      if (campaignsError) throw campaignsError;

      // 3. Buscar views agrupadas por campanha
      let viewsQuery = supabase
        .from('redirect_campaign_views')
        .select('campaign_id')
        .eq('tenant_id', tenantId);

      if (selectedCampaignId) {
        viewsQuery = viewsQuery.eq('campaign_id', selectedCampaignId);
      }

      const { data: views, error: viewsError } = await viewsQuery;
      if (viewsError) throw viewsError;

      // 4. Buscar logs com dados do contato (incluindo lead_status)
      let logsQuery = supabase
        .from('redirect_logs')
        .select(`
          campaign_id,
          contact_id,
          contact:contacts(id, lead_status)
        `)
        .eq('tenant_id', tenantId);

      if (selectedCampaignId) {
        logsQuery = logsQuery.eq('campaign_id', selectedCampaignId);
      }

      const { data: logs, error: logsError } = await logsQuery;
      if (logsError) throw logsError;

      // Processar dados
      const viewsByCampaign: Record<string, number> = {};
      views?.forEach(v => {
        viewsByCampaign[v.campaign_id] = (viewsByCampaign[v.campaign_id] || 0) + 1;
      });

      // Agrupar leads por campanha e status
      const leadsByCampaignAndStatus: Record<string, Record<string, number>> = {};
      const leadsByCampaign: Record<string, Set<string>> = {};

      logs?.forEach(log => {
        const campaignId = log.campaign_id;
        const contactId = log.contact_id;
        const leadStatus = (log.contact as any)?.lead_status || 'sem_status';

        if (!leadsByCampaign[campaignId]) {
          leadsByCampaign[campaignId] = new Set();
        }
        leadsByCampaign[campaignId].add(contactId);

        if (!leadsByCampaignAndStatus[campaignId]) {
          leadsByCampaignAndStatus[campaignId] = {};
        }
        leadsByCampaignAndStatus[campaignId][leadStatus] = 
          (leadsByCampaignAndStatus[campaignId][leadStatus] || 0) + 1;
      });

      // Encontrar IDs dos status específicos (por nome)
      const catalogoStatus = leadStatuses?.find(s => s.name.toLowerCase().includes('catálogo') || s.name.toLowerCase().includes('catalogo'));
      const layoutStatus = leadStatuses?.find(s => s.name.toLowerCase().includes('layout'));
      const fechadoStatus = leadStatuses?.find(s => s.name.toLowerCase().includes('fechado') || s.name.toLowerCase().includes('pedido fechado'));

      // Calcular totais
      let totalViews = 0;
      let totalLeads = 0;
      let leadsInCatalogo = 0;
      let leadsInLayout = 0;
      let pedidosFechados = 0;
      const globalStatusCount: Record<string, number> = {};

      // Processar por campanha
      const byCampaign: CampaignDashboardData[] = campaigns?.map(campaign => {
        const campaignViews = viewsByCampaign[campaign.id] || 0;
        const campaignLeads = leadsByCampaign[campaign.id]?.size || 0;
        const statusData = leadsByCampaignAndStatus[campaign.id] || {};

        totalViews += campaignViews;
        totalLeads += campaignLeads;

        // Contabilizar status específicos
        Object.entries(statusData).forEach(([status, count]) => {
          globalStatusCount[status] = (globalStatusCount[status] || 0) + count;
          
          if (catalogoStatus && status === catalogoStatus.id) {
            leadsInCatalogo += count;
          }
          if (layoutStatus && status === layoutStatus.id) {
            leadsInLayout += count;
          }
          if (fechadoStatus && status === fechadoStatus.id) {
            pedidosFechados += count;
          }
        });

        const statusBreakdown: LeadStatusMetrics[] = leadStatuses?.map(ls => ({
          statusId: ls.id,
          statusName: ls.name,
          color: ls.color,
          count: statusData[ls.id] || 0
        })) || [];

        return {
          campaignId: campaign.id,
          campaignName: campaign.name,
          views: campaignViews,
          leads: campaignLeads,
          statusBreakdown,
          conversionRate: campaignLeads > 0 && fechadoStatus
            ? ((statusData[fechadoStatus.id] || 0) / campaignLeads) * 100
            : 0
        };
      }) || [];

      const statusBreakdown: LeadStatusMetrics[] = leadStatuses?.map(ls => ({
        statusId: ls.id,
        statusName: ls.name,
        color: ls.color,
        count: globalStatusCount[ls.id] || 0
      })) || [];

      return {
        summary: {
          totalViews,
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
