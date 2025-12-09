import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLeadStatuses } from './useLeadStatuses';
import { useCompanySettings } from './useCompanySettings';

export interface FunnelData {
  statusId: string;
  statusName: string;
  color: string;
  count: number;
  percentage: number;
  orderPosition: number;
}

export interface AdBreakdownData {
  sourceId: string;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  headline: string | null;
  mediaType: number | null;
  campaignName: string | null;
  adName: string | null;
  total: number;
  byStatus: Record<string, number>;
  conversions: number;
  conversionRate: number;
}

export interface ChampionCreative {
  sourceId: string;
  sourceUrl: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  headline: string | null;
  mediaType: number | null;
  campaignName: string | null;
  adName: string | null;
  total: number;
  conversions: number;
  conversionRate: number;
}

interface DateRange {
  from: Date;
  to: Date;
}

// Hook para buscar dados do funil de leads Meta Ads
export function useMetaLeadsFunnel(dateRange?: DateRange) {
  const { data: statuses } = useLeadStatuses();

  return useQuery({
    queryKey: ['meta_leads_funnel', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<FunnelData[]> => {
      let query = supabase
        .from('conversations')
        .select(`
          id,
          contact:contacts!inner(lead_status)
        `)
        .eq('referral_source', 'meta_ads');

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data: conversations } = await query;

      // Contar por status
      const statusCounts: Record<string, number> = {};
      conversations?.forEach(conv => {
        const contact = conv.contact as any;
        const status = contact?.lead_status || 'new';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

      // Mapear para o formato do funil usando os statuses configurados
      const funnelData: FunnelData[] = [];
      
      if (statuses) {
        statuses.forEach(status => {
          const count = statusCounts[status.name] || 0;
          if (count > 0) {
            funnelData.push({
              statusId: status.id,
              statusName: status.name,
              color: status.color || '#8B5CF6',
              count,
              percentage: total > 0 ? (count / total) * 100 : 0,
              orderPosition: status.order_position,
            });
          }
        });
      }

      // Adicionar status "new" se existir e não estiver nos statuses configurados
      if (statusCounts['new'] && !funnelData.some(f => f.statusName === 'new')) {
        funnelData.unshift({
          statusId: 'new',
          statusName: 'Novo',
          color: '#6B7280',
          count: statusCounts['new'],
          percentage: total > 0 ? (statusCounts['new'] / total) * 100 : 0,
          orderPosition: -1,
        });
      }

      return funnelData.sort((a, b) => a.orderPosition - b.orderPosition);
    },
    enabled: !!statuses,
    staleTime: 60000,
  });
}

// Hook para buscar breakdown por anúncio com status
export function useAdsBreakdown(dateRange?: DateRange) {
  const { data: settings } = useCompanySettings();
  const conversionStatusIds = settings?.conversion_status_ids || [];

  return useQuery({
    queryKey: ['ads_breakdown', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<AdBreakdownData[]> => {
      // Buscar meta_ads com nomes das campanhas
      const { data: metaAds } = await supabase
        .from('meta_ads')
        .select(`
          ad_id,
          name,
          thumbnail_url,
          campaign:meta_campaigns(name, campaign_id)
        `);

      // Criar mapa de ad_id → { campaignName, adName }
      const adInfoMap: Record<string, { campaignName: string | null; adName: string | null; thumbnailUrl: string | null }> = {};
      metaAds?.forEach(ad => {
        const campaign = ad.campaign as any;
        adInfoMap[ad.ad_id] = {
          campaignName: campaign?.name || null,
          adName: ad.name || null,
          thumbnailUrl: ad.thumbnail_url || null,
        };
      });

      let query = supabase
        .from('conversations')
        .select(`
          referral_data,
          contact:contacts!inner(lead_status)
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

      // Buscar nomes dos status de conversão
      let conversionStatusNames: string[] = [];
      if (conversionStatusIds.length > 0) {
        const { data: statusData } = await supabase
          .from('lead_statuses')
          .select('name')
          .in('id', conversionStatusIds);
        conversionStatusNames = statusData?.map(s => s.name) || [];
      }

      // Agrupar por sourceId
      const adsMap: Record<string, {
        sourceUrl: string | null;
        thumbnailUrl: string | null;
        imageUrl: string | null;
        headline: string | null;
        mediaType: number | null;
        campaignName: string | null;
        adName: string | null;
        byStatus: Record<string, number>;
        total: number;
        conversions: number;
      }> = {};

      conversations?.forEach(conv => {
        const refData = conv.referral_data as any;
        const contact = conv.contact as any;
        const sourceId = refData?.sourceId;
        
        if (!sourceId) return;

        // Buscar info do meta_ads
        const adInfo = adInfoMap[sourceId];

        if (!adsMap[sourceId]) {
          adsMap[sourceId] = {
            sourceUrl: refData?.sourceUrl || null,
            thumbnailUrl: adInfo?.thumbnailUrl || refData?.thumbnailUrl || null,
            imageUrl: refData?.imageUrl || null,
            headline: refData?.headline || refData?.adName || null,
            mediaType: refData?.mediaType || null,
            campaignName: adInfo?.campaignName || null,
            adName: adInfo?.adName || null,
            byStatus: {},
            total: 0,
            conversions: 0,
          };
        }

        const status = contact?.lead_status || 'new';
        adsMap[sourceId].byStatus[status] = (adsMap[sourceId].byStatus[status] || 0) + 1;
        adsMap[sourceId].total++;

        // Verificar se é conversão
        if (conversionStatusNames.includes(status)) {
          adsMap[sourceId].conversions++;
        }
      });

      // Converter para array e calcular taxa
      return Object.entries(adsMap)
        .map(([sourceId, data]) => ({
          sourceId,
          ...data,
          conversionRate: data.total > 0 ? (data.conversions / data.total) * 100 : 0,
        }))
        .sort((a, b) => b.total - a.total);
    },
    staleTime: 60000,
  });
}

// Hook para buscar criativo campeão
export function useChampionCreative(dateRange?: DateRange) {
  const { data: settings } = useCompanySettings();
  const conversionStatusIds = settings?.conversion_status_ids || [];

  return useQuery({
    queryKey: ['champion_creative', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<ChampionCreative | null> => {
      // Buscar meta_ads com nomes das campanhas
      const { data: metaAds } = await supabase
        .from('meta_ads')
        .select(`
          ad_id,
          name,
          thumbnail_url,
          campaign:meta_campaigns(name, campaign_id)
        `);

      // Criar mapa de ad_id → { campaignName, adName }
      const adInfoMap: Record<string, { campaignName: string | null; adName: string | null; thumbnailUrl: string | null }> = {};
      metaAds?.forEach(ad => {
        const campaign = ad.campaign as any;
        adInfoMap[ad.ad_id] = {
          campaignName: campaign?.name || null,
          adName: ad.name || null,
          thumbnailUrl: ad.thumbnail_url || null,
        };
      });

      let query = supabase
        .from('conversations')
        .select(`
          referral_data,
          contact:contacts!inner(lead_status)
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

      // Buscar nomes dos status de conversão
      let conversionStatusNames: string[] = [];
      if (conversionStatusIds.length > 0) {
        const { data: statusData } = await supabase
          .from('lead_statuses')
          .select('name')
          .in('id', conversionStatusIds);
        conversionStatusNames = statusData?.map(s => s.name) || [];
      }

      // Agrupar por sourceId e calcular conversões
      const adsMap: Record<string, {
        sourceUrl: string | null;
        thumbnailUrl: string | null;
        imageUrl: string | null;
        headline: string | null;
        mediaType: number | null;
        campaignName: string | null;
        adName: string | null;
        total: number;
        conversions: number;
      }> = {};

      conversations?.forEach(conv => {
        const refData = conv.referral_data as any;
        const contact = conv.contact as any;
        const sourceId = refData?.sourceId;
        
        if (!sourceId) return;

        const adInfo = adInfoMap[sourceId];

        if (!adsMap[sourceId]) {
          adsMap[sourceId] = {
            sourceUrl: refData?.sourceUrl || null,
            thumbnailUrl: adInfo?.thumbnailUrl || refData?.thumbnailUrl || null,
            imageUrl: refData?.imageUrl || null,
            headline: refData?.headline || refData?.adName || null,
            mediaType: refData?.mediaType || null,
            campaignName: adInfo?.campaignName || null,
            adName: adInfo?.adName || null,
            total: 0,
            conversions: 0,
          };
        }

        adsMap[sourceId].total++;

        const status = contact?.lead_status || 'new';
        if (conversionStatusNames.includes(status)) {
          adsMap[sourceId].conversions++;
        }
      });

      // Encontrar o campeão (maior taxa de conversão com pelo menos 5 leads)
      let champion: ChampionCreative | null = null;
      let bestRate = 0;

      Object.entries(adsMap).forEach(([sourceId, data]) => {
        // Mínimo de 5 leads para considerar
        if (data.total >= 5) {
          const rate = (data.conversions / data.total) * 100;
          if (rate > bestRate) {
            bestRate = rate;
            champion = {
              sourceId,
              campaignName: data.campaignName,
              adName: data.adName,
              ...data,
              conversionRate: rate,
            };
          }
        }
      });

      // Se nenhum tem 5+ leads, pegar o com mais leads que tenha conversão
      if (!champion) {
        Object.entries(adsMap).forEach(([sourceId, data]) => {
          if (data.conversions > 0) {
            const rate = (data.conversions / data.total) * 100;
            if (!champion || data.conversions > (champion.conversions || 0)) {
              champion = {
                sourceId,
                campaignName: data.campaignName,
                adName: data.adName,
                ...data,
                conversionRate: rate,
              };
            }
          }
        });
      }

      // Se ainda não tem, pegar o com mais leads
      if (!champion) {
        const sorted = Object.entries(adsMap).sort((a, b) => b[1].total - a[1].total);
        if (sorted.length > 0) {
          const [sourceId, data] = sorted[0];
          champion = {
            sourceId,
            campaignName: data.campaignName,
            adName: data.adName,
            ...data,
            conversionRate: 0,
          };
        }
      }

      return champion;
    },
    staleTime: 60000,
  });
}

// Hook para buscar leads de um status específico com detalhes do anúncio
export function useLeadsByStatus(status: string | null, dateRange?: DateRange) {
  return useQuery({
    queryKey: ['leads_by_status', status, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async () => {
      if (!status) return [];

      let query = supabase
        .from('conversations')
        .select(`
          id,
          referral_data,
          created_at,
          contact:contacts!inner(
            id,
            full_name,
            phone,
            lead_status
          )
        `)
        .eq('referral_source', 'meta_ads')
        .eq('contacts.lead_status', status);

      if (dateRange?.from) {
        query = query.gte('created_at', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data } = await query.order('created_at', { ascending: false }).limit(100);

      return data?.map(conv => {
        const refData = conv.referral_data as any;
        const contact = conv.contact as any;
        return {
          conversationId: conv.id,
          contactId: contact?.id,
          contactName: contact?.full_name,
          contactPhone: contact?.phone,
          sourceId: refData?.sourceId,
          headline: refData?.headline || refData?.adName,
          thumbnailUrl: refData?.thumbnailUrl || refData?.imageUrl,
          createdAt: conv.created_at,
        };
      }) || [];
    },
    enabled: !!status,
    staleTime: 60000,
  });
}

// Hook para buscar top criativos
export function useTopCreatives(dateRange?: DateRange, limit: number = 6) {
  const { data: adsBreakdown } = useAdsBreakdown(dateRange);

  return useQuery({
    queryKey: ['top_creatives', dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), limit],
    queryFn: async (): Promise<AdBreakdownData[]> => {
      if (!adsBreakdown) return [];

      // Ordenar por taxa de conversão (com mínimo de leads) ou por total de leads
      const filtered = adsBreakdown.filter(ad => ad.thumbnailUrl || ad.imageUrl);
      
      const withConversions = filtered.filter(ad => ad.conversions > 0 && ad.total >= 3);
      const sortedByRate = [...withConversions].sort((a, b) => b.conversionRate - a.conversionRate);

      if (sortedByRate.length >= limit) {
        return sortedByRate.slice(0, limit);
      }

      // Completar com os de maior volume
      const remaining = filtered
        .filter(ad => !sortedByRate.includes(ad))
        .sort((a, b) => b.total - a.total);

      return [...sortedByRate, ...remaining].slice(0, limit);
    },
    enabled: !!adsBreakdown,
    staleTime: 60000,
  });
}
