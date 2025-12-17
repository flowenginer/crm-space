import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CrossDataRow {
  sourceId: string;
  adName: string;
  campaignName: string;
  segmentName: string;
  sourceUrl: string;
  headline: string;
  thumbnailUrl: string;
  imageUrl: string;
  mediaType: string;
  totalLeads: number;
  catalogoCount: number;  // 03 - Catálogo
  layoutCount: number;    // 04 - Layout
  pedidoFechadoCount: number; // 07 - Pedido Fechado
  revenue: number;
}

export interface CrossDataSummary {
  totalLeads: number;
  catalogoCount: number;
  layoutCount: number;
  pedidoFechadoCount: number;
  totalRevenue: number;
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

// Função para encontrar segmento no nome da campanha
function findSegmentInCampaignName(campaignName: string, segments: { id: string; name: string }[]): string {
  if (!campaignName || !segments || segments.length === 0) return 'Sem Segmento';
  
  for (const segment of segments) {
    if (campaignName.toLowerCase().includes(segment.name.toLowerCase())) {
      return segment.name;
    }
  }
  return 'Sem Segmento';
}

export function useMetaLeadsCrossData(dateRange?: DateRange) {
  return useQuery({
    queryKey: ['meta_leads_cross_data', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<{ rows: CrossDataRow[]; summary: CrossDataSummary }> => {
      // Fetch active segments for matching
      const { data: segments } = await supabase
        .from('segments')
        .select('id, name')
        .eq('is_active', true);

      // Fetch meta ads with campaign name (all campaigns, including paused)
      const { data: metaAds } = await supabase
        .from('meta_ads')
        .select(`
          ad_id, 
          name,
          campaign:meta_campaigns(name, status)
        `);
      const adInfoMap = new Map<string, { adName: string; campaignName: string; segmentName: string }>();
      metaAds?.forEach((ad: any) => {
        const campaignName = ad.campaign?.name || '';
        adInfoMap.set(ad.ad_id, {
          adName: ad.name,
          campaignName,
          segmentName: findSegmentInCampaignName(campaignName, segments || [])
        });
      });

      // Build query for conversations with Meta Ads referral
      let query = supabase
        .from('conversations')
        .select(`
          id,
          referral_data,
          created_at,
          contact:contacts!inner(
            id,
            lead_status,
            negotiated_value
          )
        `)
        .eq('referral_source', 'meta_ads')
        .not('referral_data', 'is', null);

      if (dateRange?.from) {
        query = query.gte('created_at', toUTCDate(dateRange.from, false));
      }
      if (dateRange?.to) {
        query = query.lte('created_at', toUTCDate(dateRange.to, true));
      }

      const { data: conversations } = await query;

      if (!conversations || conversations.length === 0) {
        return {
          rows: [],
          summary: {
            totalLeads: 0,
            catalogoCount: 0,
            layoutCount: 0,
            pedidoFechadoCount: 0,
            totalRevenue: 0
          }
        };
      }

      // Group by sourceId (ad) - ONLY leads with valid sourceId
      const adData = new Map<string, CrossDataRow>();
      const contactsByAd = new Map<string, Set<string>>();

      conversations.forEach((conv: any) => {
        const refData = conv.referral_data as any;
        const sourceId = refData?.sourceId;
        
        // Skip leads without sourceId - they don't have direct ad tracking
        if (!sourceId || sourceId === '') return;
        
        const contact = conv.contact;

        if (!contact) return;

        if (!contactsByAd.has(sourceId)) {
          contactsByAd.set(sourceId, new Set());
        }

        // Only count unique contacts per ad
        if (contactsByAd.get(sourceId)!.has(contact.id)) {
          return;
        }
        contactsByAd.get(sourceId)!.add(contact.id);

        if (!adData.has(sourceId)) {
          const adInfo = adInfoMap.get(sourceId);
          adData.set(sourceId, {
            sourceId,
            // Use ONLY ad name from meta_ads table, never headline as fallback
            adName: adInfo?.adName || `Anúncio ${sourceId}`,
            campaignName: adInfo?.campaignName || '',
            segmentName: adInfo?.segmentName || 'Sem Segmento',
            sourceUrl: refData?.sourceUrl || '',
            headline: refData?.headline || '',
            thumbnailUrl: refData?.thumbnailUrl || refData?.imageUrl || '',
            imageUrl: refData?.imageUrl || refData?.thumbnailUrl || '',
            mediaType: refData?.mediaType || 'image',
            totalLeads: 0,
            catalogoCount: 0,
            layoutCount: 0,
            pedidoFechadoCount: 0,
            revenue: 0
          });
        }

        const data = adData.get(sourceId)!;
        data.totalLeads++;

        const status = contact.lead_status || '';
        if (status.includes('03 - Catálogo') || status.toLowerCase().includes('catálogo')) {
          data.catalogoCount++;
        }
        if (status.includes('04 - Layout') || status.toLowerCase().includes('layout')) {
          data.layoutCount++;
        }
        if (status.includes('07 - Pedido Fechado') || status.toLowerCase().includes('pedido fechado')) {
          data.pedidoFechadoCount++;
          data.revenue += contact.negotiated_value || 0;
        }
      });

      const rows = Array.from(adData.values()).sort((a, b) => b.totalLeads - a.totalLeads);

      // Calculate summary
      const summary: CrossDataSummary = {
        totalLeads: rows.reduce((sum, r) => sum + r.totalLeads, 0),
        catalogoCount: rows.reduce((sum, r) => sum + r.catalogoCount, 0),
        layoutCount: rows.reduce((sum, r) => sum + r.layoutCount, 0),
        pedidoFechadoCount: rows.reduce((sum, r) => sum + r.pedidoFechadoCount, 0),
        totalRevenue: rows.reduce((sum, r) => sum + r.revenue, 0)
      };

      return { rows, summary };
    },
    staleTime: 60000,
  });
}
