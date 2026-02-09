import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';

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
  // Novo: indicar a fonte do lead
  source: 'meta_ads' | 'redirect';
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

// Função para encontrar segmento no nome da campanha ou utm_medium
function findSegmentInText(text: string, segments: { id: string; name: string }[]): string {
  if (!text || !segments || segments.length === 0) return 'Sem Segmento';

  for (const segment of segments) {
    if (text.toLowerCase().includes(segment.name.toLowerCase())) {
      return segment.name;
    }
  }
  return 'Sem Segmento';
}

// Função para normalizar utm_content (decode URL e limpar)
function normalizeUtmContent(utmContent: string | null): string {
  if (!utmContent) return '';
  try {
    return decodeURIComponent(utmContent).trim();
  } catch {
    return utmContent.trim();
  }
}

export function useMetaLeadsCrossData(dateRange?: DateRange) {
  // Obter tenant_id do store para filtrar queries
  const { tenantId } = useUserStore();

  return useQuery({
    queryKey: ['meta_leads_cross_data', dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), tenantId],
    queryFn: async (): Promise<{ rows: CrossDataRow[]; summary: CrossDataSummary }> => {
      if (!tenantId) {
        return { rows: [], summary: { totalLeads: 0, catalogoCount: 0, layoutCount: 0, pedidoFechadoCount: 0, totalRevenue: 0 } };
      }

      // Fetch active segments for matching - FILTRADO POR TENANT
      const { data: segments } = await supabase
        .from('segments')
        .select('id, name')
        .eq('is_active', true)
        .eq('tenant_id', tenantId);

      // Fetch meta ads with campaign name (all campaigns, including paused) - FILTRADO POR TENANT
      const { data: metaAds } = await supabase
        .from('meta_ads')
        .select(`
          ad_id,
          name,
          campaign:meta_campaigns(name, status)
        `)
        .eq('tenant_id', tenantId);

      const adInfoMap = new Map<string, { adName: string; campaignName: string; segmentName: string }>();
      metaAds?.forEach((ad: any) => {
        const campaignName = ad.campaign?.name || '';
        adInfoMap.set(ad.ad_id, {
          adName: ad.name,
          campaignName,
          segmentName: findSegmentInText(campaignName, segments || [])
        });
      });

      // Mapa para agregar dados por criativo (combinando ambas as fontes)
      const adData = new Map<string, CrossDataRow>();
      const contactsByAd = new Map<string, Set<string>>();

      // ========================================
      // FONTE 1: Meta Ads (ctwa_ad) - via referral_data.sourceId
      // ========================================
      const PAGE_SIZE = 1000;
      let allConversations: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
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
          .eq('tenant_id', tenantId)
          .not('referral_data', 'is', null)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        if (dateRange?.from) {
          query = query.gte('created_at', toUTCDate(dateRange.from, false));
        }
        if (dateRange?.to) {
          query = query.lte('created_at', toUTCDate(dateRange.to, true));
        }

        const { data: conversations } = await query;

        if (conversations && conversations.length > 0) {
          allConversations = [...allConversations, ...conversations];
          hasMore = conversations.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Processar leads do Meta Ads (ctwa_ad)
      allConversations.forEach((conv: any) => {
        const refData = conv.referral_data as any;
        const sourceId = refData?.sourceId;

        // Skip leads without sourceId - they don't have direct ad tracking
        if (!sourceId || sourceId === '') return;

        const contact = conv.contact;
        if (!contact) return;

        // Criar chave única para o criativo
        const creativeKey = `meta_${sourceId}`;

        if (!contactsByAd.has(creativeKey)) {
          contactsByAd.set(creativeKey, new Set());
        }

        // Only count unique contacts per ad
        if (contactsByAd.get(creativeKey)!.has(contact.id)) {
          return;
        }
        contactsByAd.get(creativeKey)!.add(contact.id);

        if (!adData.has(creativeKey)) {
          const adInfo = adInfoMap.get(sourceId);
          adData.set(creativeKey, {
            sourceId,
            adName: adInfo?.adName || `Anúncio ${sourceId.substring(0, 8)}...`,
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
            revenue: 0,
            source: 'meta_ads'
          });
        }

        const data = adData.get(creativeKey)!;
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

      // ========================================
      // FONTE 2: Redirect (UTM) - via redirect_logs
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
            utm_content,
            utm_medium,
            utm_campaign,
            utm_source,
            created_at,
            contact:contacts!inner(
              id,
              lead_status,
              negotiated_value
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

      // Processar leads do Redirect (UTM)
      allRedirectLogs.forEach((log: any) => {
        const contact = log.contact;
        if (!contact) return;

        // Usar utm_content como nome do criativo
        const utmContent = normalizeUtmContent(log.utm_content);
        const utmMedium = normalizeUtmContent(log.utm_medium);
        const utmCampaign = normalizeUtmContent(log.utm_campaign);

        // Se não tem utm_content, usar utm_campaign como fallback
        const creativeName = utmContent || utmCampaign || 'Sem UTM';

        // Criar chave única para o criativo (redirect)
        const creativeKey = `redirect_${creativeName}`;

        if (!contactsByAd.has(creativeKey)) {
          contactsByAd.set(creativeKey, new Set());
        }

        // Only count unique contacts per creative
        if (contactsByAd.get(creativeKey)!.has(contact.id)) {
          return;
        }
        contactsByAd.get(creativeKey)!.add(contact.id);

        if (!adData.has(creativeKey)) {
          // Para redirect, utm_medium é o segmento/público
          const segmentName = utmMedium
            ? findSegmentInText(utmMedium, segments || []) || utmMedium
            : 'Sem Segmento';

          adData.set(creativeKey, {
            sourceId: creativeKey,
            adName: creativeName,
            campaignName: utmCampaign || '',
            segmentName: segmentName,
            sourceUrl: '',
            headline: '',
            thumbnailUrl: '',
            imageUrl: '',
            mediaType: 'redirect',
            totalLeads: 0,
            catalogoCount: 0,
            layoutCount: 0,
            pedidoFechadoCount: 0,
            revenue: 0,
            source: 'redirect'
          });
        }

        const data = adData.get(creativeKey)!;
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

      // ========================================
      // Combinar e retornar resultados
      // ========================================
      const rows = Array.from(adData.values()).sort((a, b) => b.totalLeads - a.totalLeads);

      // Calculate summary
      const summary: CrossDataSummary = {
        totalLeads: rows.reduce((sum, r) => sum + r.totalLeads, 0),
        catalogoCount: rows.reduce((sum, r) => sum + r.catalogoCount, 0),
        layoutCount: rows.reduce((sum, r) => sum + r.layoutCount, 0),
        pedidoFechadoCount: rows.reduce((sum, r) => sum + r.pedidoFechadoCount, 0),
        totalRevenue: rows.reduce((sum, r) => sum + r.revenue, 0)
      };

      console.log(`[useMetaLeadsCrossData] Loaded ${rows.length} creatives: ${rows.filter(r => r.source === 'meta_ads').length} from Meta Ads, ${rows.filter(r => r.source === 'redirect').length} from Redirect`);

      return { rows, summary };
    },
    staleTime: 60000,
  });
}
