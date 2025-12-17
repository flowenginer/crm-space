import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanySettings } from './useCompanySettings';

export interface CrossDataRow {
  // Identificação
  sourceId: string;
  adName: string | null;
  campaignName: string | null;
  
  // Métricas de leads
  totalLeads: number;
  leadsThisMonth: number;
  leadsToday: number;
  uniqueContacts: number;
  
  // Breakdown por segmento
  bySegment: Record<string, number>;
  
  // Breakdown por status/etapa
  byStatus: Record<string, number>;
  
  // Atribuição
  withAgent: number;
  withoutAgent: number;
  
  // Resposta do cliente
  responded: number;
  notResponded: number;
  
  // Conversão
  conversions: number;
  conversionRate: number;
  
  // Financeiro
  revenue: number;
}

export interface CrossDataSummary {
  totalLeads: number;
  totalLeadsThisMonth: number;
  totalLeadsToday: number;
  totalWithAgent: number;
  totalWithoutAgent: number;
  totalResponded: number;
  totalNotResponded: number;
  totalConversions: number;
  totalRevenue: number;
  overallConversionRate: number;
}

interface DateRange {
  from: Date;
  to: Date;
}

// Constante para status de conversão (07 - Pedido Fechado)
const CONVERSION_STATUS = '07 - Pedido Fechado';

export function useMetaLeadsCrossData(dateRange?: DateRange) {
  const { data: settings } = useCompanySettings();

  return useQuery({
    queryKey: ['meta_leads_cross_data', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<{ rows: CrossDataRow[]; summary: CrossDataSummary }> => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Buscar meta_ads com nomes das campanhas
      const { data: metaAds } = await supabase
        .from('meta_ads')
        .select(`
          ad_id,
          name,
          campaign:meta_campaigns(name, campaign_id)
        `);

      const adInfoMap: Record<string, { campaignName: string | null; adName: string | null }> = {};
      metaAds?.forEach(ad => {
        const campaign = ad.campaign as any;
        adInfoMap[ad.ad_id] = {
          campaignName: campaign?.name || null,
          adName: ad.name || null,
        };
      });

      // Buscar segmentos
      const { data: segments } = await supabase
        .from('segments')
        .select('id, name');
      
      const segmentMap: Record<string, string> = {};
      segments?.forEach(s => {
        segmentMap[s.id] = s.name;
      });

      // Buscar conversas com dados completos
      let query = supabase
        .from('conversations')
        .select(`
          id,
          referral_data,
          created_at,
          assigned_to,
          contact:contacts!inner(
            id,
            lead_status,
            negotiated_value,
            segment_id,
            assigned_to
          )
        `)
        .eq('referral_source', 'meta_ads')
        .not('referral_data', 'is', null);

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data: conversations } = await query;

      // Buscar IDs de todas as conversas para verificar respostas
      const conversationIds = conversations?.map(c => c.id) || [];
      
      // Verificar quais conversas têm resposta do cliente
      let respondedConvIds = new Set<string>();
      if (conversationIds.length > 0) {
        // Buscar mensagens do cliente em batches
        const batchSize = 500;
        for (let i = 0; i < conversationIds.length; i += batchSize) {
          const batch = conversationIds.slice(i, i + batchSize);
          const { data: messages } = await supabase
            .from('messages')
            .select('conversation_id')
            .in('conversation_id', batch)
            .eq('is_from_me', false)
            .eq('is_deleted', false);

          messages?.forEach(m => {
            respondedConvIds.add(m.conversation_id);
          });
        }
      }

      // Agrupar por sourceId
      const adsMap: Record<string, {
        campaignName: string | null;
        adName: string | null;
        contactIds: Set<string>;
        totalLeads: number;
        leadsThisMonth: number;
        leadsToday: number;
        bySegment: Record<string, number>;
        byStatus: Record<string, number>;
        withAgent: number;
        withoutAgent: number;
        responded: number;
        notResponded: number;
        conversions: number;
        revenue: number;
      }> = {};

      conversations?.forEach(conv => {
        const refData = conv.referral_data as any;
        const contact = conv.contact as any;
        const sourceId = refData?.sourceId;
        
        if (!sourceId) return;

        const adInfo = adInfoMap[sourceId];
        const convCreatedAt = new Date(conv.created_at);
        const isThisMonth = convCreatedAt >= startOfMonth;
        const isToday = convCreatedAt >= startOfToday;

        if (!adsMap[sourceId]) {
          adsMap[sourceId] = {
            campaignName: adInfo?.campaignName || null,
            adName: adInfo?.adName || null,
            contactIds: new Set(),
            totalLeads: 0,
            leadsThisMonth: 0,
            leadsToday: 0,
            bySegment: {},
            byStatus: {},
            withAgent: 0,
            withoutAgent: 0,
            responded: 0,
            notResponded: 0,
            conversions: 0,
            revenue: 0,
          };
        }

        const ad = adsMap[sourceId];
        ad.totalLeads++;
        if (isThisMonth) ad.leadsThisMonth++;
        if (isToday) ad.leadsToday++;

        // Contato único
        if (contact?.id) {
          ad.contactIds.add(contact.id);
        }

        // Segmento
        if (contact?.segment_id) {
          const segmentName = segmentMap[contact.segment_id] || 'Outros';
          ad.bySegment[segmentName] = (ad.bySegment[segmentName] || 0) + 1;
        } else {
          ad.bySegment['Não definido'] = (ad.bySegment['Não definido'] || 0) + 1;
        }

        // Status
        const status = contact?.lead_status || 'new';
        ad.byStatus[status] = (ad.byStatus[status] || 0) + 1;

        // Atribuição (verifica no contact.assigned_to ou conversation.assigned_to)
        const hasAgent = conv.assigned_to || contact?.assigned_to;
        if (hasAgent) {
          ad.withAgent++;
        } else {
          ad.withoutAgent++;
        }

        // Resposta do cliente
        if (respondedConvIds.has(conv.id)) {
          ad.responded++;
        } else {
          ad.notResponded++;
        }

        // Conversão (07 - Pedido Fechado)
        if (status === CONVERSION_STATUS) {
          ad.conversions++;
          ad.revenue += (contact?.negotiated_value || 0);
        }
      });

      // Converter para array
      const rows: CrossDataRow[] = Object.entries(adsMap)
        .map(([sourceId, data]) => ({
          sourceId,
          adName: data.adName,
          campaignName: data.campaignName,
          totalLeads: data.totalLeads,
          leadsThisMonth: data.leadsThisMonth,
          leadsToday: data.leadsToday,
          uniqueContacts: data.contactIds.size,
          bySegment: data.bySegment,
          byStatus: data.byStatus,
          withAgent: data.withAgent,
          withoutAgent: data.withoutAgent,
          responded: data.responded,
          notResponded: data.notResponded,
          conversions: data.conversions,
          conversionRate: data.totalLeads > 0 ? (data.conversions / data.totalLeads) * 100 : 0,
          revenue: data.revenue,
        }))
        .sort((a, b) => b.totalLeads - a.totalLeads);

      // Calcular sumário
      const summary: CrossDataSummary = {
        totalLeads: rows.reduce((sum, r) => sum + r.totalLeads, 0),
        totalLeadsThisMonth: rows.reduce((sum, r) => sum + r.leadsThisMonth, 0),
        totalLeadsToday: rows.reduce((sum, r) => sum + r.leadsToday, 0),
        totalWithAgent: rows.reduce((sum, r) => sum + r.withAgent, 0),
        totalWithoutAgent: rows.reduce((sum, r) => sum + r.withoutAgent, 0),
        totalResponded: rows.reduce((sum, r) => sum + r.responded, 0),
        totalNotResponded: rows.reduce((sum, r) => sum + r.notResponded, 0),
        totalConversions: rows.reduce((sum, r) => sum + r.conversions, 0),
        totalRevenue: rows.reduce((sum, r) => sum + r.revenue, 0),
        overallConversionRate: 0,
      };
      
      summary.overallConversionRate = summary.totalLeads > 0 
        ? (summary.totalConversions / summary.totalLeads) * 100 
        : 0;

      return { rows, summary };
    },
    staleTime: 60000,
  });
}
