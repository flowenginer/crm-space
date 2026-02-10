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
  // Indicar a fonte do lead
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
      const processedContacts = new Set<string>();

      // ========================================
      // FONTE 1: Meta Ads - USANDO contacts.origin (igual ao CRM Dashboard)
      // ========================================
      // Isso garante que contamos TODOS os leads do Meta Ads, mesmo os que não têm sourceId
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
        // Evitar duplicatas
        if (processedContacts.has(contact.id)) return;
        processedContacts.add(contact.id);

        const refData = contact.referral_data as any;
        // Suportar ambos os nomes de campo: source_id (snake_case) e sourceId (camelCase)
        const sourceId = refData?.source_id || refData?.sourceId;

        // Determinar a chave do criativo
        // Se tem sourceId válido, usar ele; senão, agrupar como "Não Identificado"
        let creativeKey: string;
        let adName: string;
        let campaignName: string = '';
        let segmentName: string = 'Sem Segmento';

        if (sourceId && sourceId !== '') {
          creativeKey = `meta_${sourceId}`;
          const adInfo = adInfoMap.get(sourceId);
          if (adInfo) {
            adName = adInfo.adName;
            campaignName = adInfo.campaignName;
            segmentName = adInfo.segmentName;
          } else {
            // Tem sourceId mas não encontrou na planilha Meta
            adName = refData?.headline || `Anúncio ${sourceId.substring(0, 8)}...`;
          }
        } else {
          // Não tem sourceId - agrupar como não identificado
          creativeKey = 'meta_unknown';
          adName = 'Anúncio Não Identificado';
        }

        if (!adData.has(creativeKey)) {
          adData.set(creativeKey, {
            sourceId: sourceId || 'unknown',
            adName,
            campaignName,
            segmentName,
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

      // Processar leads do Redirect
      // Apenas incluir leads que NÃO são do Meta Ads (para evitar duplicatas)
      allRedirectLogs.forEach((log: any) => {
        const contact = log.contact;
        if (!contact) return;

        // Se o contato já foi processado como Meta Ads, pular
        if (processedContacts.has(contact.id)) return;

        // Se o contato tem origin = meta_ads, já foi contado acima
        if (contact.origin === 'meta_ads') return;

        processedContacts.add(contact.id);

        // Usar utm_content como nome do criativo
        const utmContent = normalizeUtmContent(log.utm_content);
        const utmMedium = normalizeUtmContent(log.utm_medium);
        const utmCampaign = normalizeUtmContent(log.utm_campaign);

        // Se não tem utm_content, usar utm_campaign como fallback
        const creativeName = utmContent || utmCampaign || 'Sem UTM';

        // Criar chave única para o criativo (redirect)
        const creativeKey = `redirect_${creativeName}`;

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

      const metaAdsCount = rows.filter(r => r.source === 'meta_ads').reduce((sum, r) => sum + r.totalLeads, 0);
      const redirectCount = rows.filter(r => r.source === 'redirect').reduce((sum, r) => sum + r.totalLeads, 0);
      console.log(`[useMetaLeadsCrossData] Total: ${summary.totalLeads} leads (Meta Ads: ${metaAdsCount}, Redirect: ${redirectCount})`);

      return { rows, summary };
    },
    staleTime: 60000,
  });
}
