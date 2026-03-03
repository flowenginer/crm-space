import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';

// Verificar se utm_source indica que é do Meta Ads
function isMetaSource(utmSource: string | null | undefined): boolean {
  if (!utmSource) return false;
  const source = utmSource.toLowerCase();
  return source.includes('facebook') ||
         source.includes('instagram') ||
         source.includes('meta') ||
         source === 'fb' ||
         source === 'ig';
}

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
  novoCount: number;          // Leads novos (não catálogo/layout/fechado)
  catalogoCount: number;      // 03 - Catálogo
  layoutCount: number;        // 04 - Layout
  pedidoFechadoCount: number; // 07 - Pedido Fechado
  naoRespondidoCount: number; // Leads sem resposta
  revenue: number;
  // Indicar a fonte do lead
  source: 'meta_ads' | 'redirect';
}

export interface CrossDataSummary {
  totalLeads: number;
  novoCount: number;
  catalogoCount: number;
  layoutCount: number;
  pedidoFechadoCount: number;
  naoRespondidoCount: number;
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
        return { rows: [], summary: { totalLeads: 0, novoCount: 0, catalogoCount: 0, layoutCount: 0, pedidoFechadoCount: 0, naoRespondidoCount: 0, totalRevenue: 0 } };
      }

      // Buscar status de conversão do company_settings
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('conversion_status_ids')
        .eq('tenant_id', tenantId)
        .single();

      const conversionStatusId = companySettings?.conversion_status_ids?.[0];

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
        // Suportar: source_id (snake_case), sourceId (camelCase), ou utm_term (redirect)
        const sourceId = refData?.source_id || refData?.sourceId || refData?.utm_term;

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
            // Usar utm_content como nome do anúncio se disponível (redirect UTM)
            adName = refData?.utm_content || refData?.headline || `Anúncio ${sourceId.substring(0, 8)}...`;
            // Usar utm_medium como segmento se disponível (redirect UTM)
            if (refData?.utm_medium) {
              segmentName = refData.utm_medium;
            }
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
            novoCount: 0,
            catalogoCount: 0,
            layoutCount: 0,
            pedidoFechadoCount: 0,
            naoRespondidoCount: 0,
            revenue: 0,
            source: 'meta_ads'
          });
        }

        const data = adData.get(creativeKey)!;
        data.totalLeads++;

        // Classificar por status
        const status = contact.lead_status || '';
        const statusLower = status.toLowerCase();
        const isConversion = status === conversionStatusId ||
                           statusLower.includes('fechado') ||
                           statusLower.includes('ganho') ||
                           statusLower.includes('convertido') ||
                           statusLower.includes('pedido');

        if (isConversion) {
          data.pedidoFechadoCount++;
          data.revenue += contact.negotiated_value || 0;
        } else if (statusLower.includes('catálogo') || statusLower.includes('catalogo')) {
          data.catalogoCount++;
        } else if (statusLower.includes('layout')) {
          data.layoutCount++;
        } else {
          data.novoCount++;
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

      // Processar leads do Redirect que vieram do META ADS
      // Apenas incluir leads cujo utm_source indica Meta (facebook, instagram, etc.)
      allRedirectLogs.forEach((log: any) => {
        const contact = log.contact;
        if (!contact) return;

        // Se o contato já foi processado como Meta Ads, pular
        if (processedContacts.has(contact.id)) return;

        // Se o contato tem origin = meta_ads, já foi contado acima
        if (contact.origin === 'meta_ads') return;

        // Verificar se veio do Meta via utm_source
        const utmSource = normalizeUtmContent(log.utm_source);
        if (!isMetaSource(utmSource)) return;

        processedContacts.add(contact.id);

        // Usar utm_content como nome do criativo
        const utmContent = normalizeUtmContent(log.utm_content);
        const utmMedium = normalizeUtmContent(log.utm_medium);
        const utmCampaign = normalizeUtmContent(log.utm_campaign);
        const utmTerm = normalizeUtmContent(log.utm_term);

        // Tentar associar ao anúncio Meta via utm_term (que pode conter o ad_id)
        let creativeKey: string;
        let adName: string;
        let campaignName: string = utmCampaign || '';
        let segmentName: string = 'Sem Segmento';
        let sourceType: 'meta_ads' | 'redirect' = 'redirect';

        // Se utm_term contém um ad_id válido, associar ao anúncio Meta
        if (utmTerm && adInfoMap.has(utmTerm)) {
          const adInfo = adInfoMap.get(utmTerm)!;
          creativeKey = `meta_${utmTerm}`;
          adName = adInfo.adName;
          campaignName = adInfo.campaignName;
          segmentName = adInfo.segmentName;
          sourceType = 'meta_ads';
        } else {
          // Se não tem ad_id, usar utm_content como identificador
          const creativeName = utmContent || utmCampaign || 'Sem UTM';
          creativeKey = `redirect_meta_${creativeName}`;
          adName = creativeName;
          // Para redirect, utm_medium é o segmento/público
          segmentName = utmMedium
            ? findSegmentInText(utmMedium, segments || []) || utmMedium
            : 'Sem Segmento';
        }

        if (!adData.has(creativeKey)) {
          adData.set(creativeKey, {
            sourceId: utmTerm || creativeKey,
            adName: adName,
            campaignName: campaignName,
            segmentName: segmentName,
            sourceUrl: '',
            headline: '',
            thumbnailUrl: '',
            imageUrl: '',
            mediaType: 'redirect',
            totalLeads: 0,
            novoCount: 0,
            catalogoCount: 0,
            layoutCount: 0,
            pedidoFechadoCount: 0,
            naoRespondidoCount: 0,
            revenue: 0,
            source: sourceType
          });
        }

        const data = adData.get(creativeKey)!;
        data.totalLeads++;

        // Classificar por status
        const status = contact.lead_status || '';
        const statusLower = status.toLowerCase();
        const isConversion = status === conversionStatusId ||
                           statusLower.includes('fechado') ||
                           statusLower.includes('ganho') ||
                           statusLower.includes('convertido') ||
                           statusLower.includes('pedido');

        if (isConversion) {
          data.pedidoFechadoCount++;
          data.revenue += contact.negotiated_value || 0;
        } else if (statusLower.includes('catálogo') || statusLower.includes('catalogo')) {
          data.catalogoCount++;
        } else if (statusLower.includes('layout')) {
          data.layoutCount++;
        } else {
          data.novoCount++;
        }
      });

      // ========================================
      // Buscar dados de conversations para identificar leads não respondidos
      // ========================================
      const allContactIds = Array.from(processedContacts);
      const conversationMap = new Map<string, { hasResponse: boolean }>();

      // Buscar em batches de 500
      const CONV_BATCH_SIZE = 500;
      for (let i = 0; i < allContactIds.length; i += CONV_BATCH_SIZE) {
        const batch = allContactIds.slice(i, i + CONV_BATCH_SIZE);
        const { data: conversations } = await supabase
          .from('conversations')
          .select('contact_id, first_response_at')
          .eq('tenant_id', tenantId)
          .in('contact_id', batch);

        conversations?.forEach((conv: any) => {
          const existing = conversationMap.get(conv.contact_id);
          if (!existing || (conv.first_response_at && !existing.hasResponse)) {
            conversationMap.set(conv.contact_id, {
              hasResponse: !!conv.first_response_at
            });
          }
        });
      }

      // Atualizar contagem de não respondidos por criativo
      // Precisamos processar novamente os contatos para contar não respondidos
      allContacts.forEach((contact: any) => {
        const convInfo = conversationMap.get(contact.id);
        const wasResponded = convInfo?.hasResponse ?? false;

        if (!wasResponded) {
          const refData = contact.referral_data as any;
          const sourceId = refData?.source_id || refData?.sourceId || refData?.utm_term;

          let creativeKey: string;
          if (sourceId && sourceId !== '') {
            creativeKey = `meta_${sourceId}`;
          } else {
            creativeKey = 'meta_unknown';
          }

          const data = adData.get(creativeKey);
          if (data) {
            data.naoRespondidoCount++;
          }
        }
      });

      // ========================================
      // Combinar e retornar resultados
      // ========================================
      const rows = Array.from(adData.values()).sort((a, b) => b.totalLeads - a.totalLeads);

      // Calculate summary
      const summary: CrossDataSummary = {
        totalLeads: rows.reduce((sum, r) => sum + r.totalLeads, 0),
        novoCount: rows.reduce((sum, r) => sum + r.novoCount, 0),
        catalogoCount: rows.reduce((sum, r) => sum + r.catalogoCount, 0),
        layoutCount: rows.reduce((sum, r) => sum + r.layoutCount, 0),
        pedidoFechadoCount: rows.reduce((sum, r) => sum + r.pedidoFechadoCount, 0),
        naoRespondidoCount: rows.reduce((sum, r) => sum + r.naoRespondidoCount, 0),
        totalRevenue: rows.reduce((sum, r) => sum + r.revenue, 0)
      };

      const metaAdsCount = rows.filter(r => r.source === 'meta_ads').reduce((sum, r) => sum + r.totalLeads, 0);
      const redirectCount = rows.filter(r => r.source === 'redirect').reduce((sum, r) => sum + r.totalLeads, 0);
      console.log(`[useMetaLeadsCrossData] Total: ${summary.totalLeads} leads (Meta Ads Direto: ${metaAdsCount}, Redirect Meta: ${redirectCount})`);

      return { rows, summary };
    },
    staleTime: 60000,
  });
}
