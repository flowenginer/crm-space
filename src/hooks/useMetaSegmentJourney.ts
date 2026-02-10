import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';

export interface SegmentBreakdown {
  assignedSegment: string;
  assignedSegmentId: string | null;
  count: number;
  layoutCount: number;
  pedidoFechadoCount: number;
  isMatch: boolean;
}

export interface SegmentJourneyData {
  campaignSegment: string;
  campaignSegmentId: string | null;
  totalLeads: number;
  matchCount: number;
  matchRate: number;
  breakdown: SegmentBreakdown[];
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
  const utcDate = new Date(d.getTime() + (3 * 60 * 60 * 1000));
  return utcDate.toISOString();
}

// Extrai o nome do segmento a partir do nome da campanha
function extractSegmentFromCampaignName(campaignName: string, segments: { id: string; name: string }[]): { id: string; name: string } | null {
  const upperCampaignName = campaignName.toUpperCase();

  for (const segment of segments) {
    const upperSegmentName = segment.name.toUpperCase();
    if (upperCampaignName.includes(upperSegmentName)) {
      return segment;
    }
  }

  return null;
}

// Normalizar utm_medium para nome de segmento
function normalizeUtmMedium(utmMedium: string | null): string {
  if (!utmMedium) return '';
  try {
    return decodeURIComponent(utmMedium).trim();
  } catch {
    return utmMedium.trim();
  }
}

export function useMetaSegmentJourney(dateRange?: DateRange) {
  // Obter tenant_id do store para filtrar queries
  const { tenantId } = useUserStore();

  return useQuery({
    queryKey: ['meta_segment_journey', dateRange?.from?.toISOString(), dateRange?.to?.toISOString(), tenantId],
    queryFn: async (): Promise<SegmentJourneyData[]> => {
      if (!tenantId) {
        return [];
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

      // Buscar todos os segmentos - FILTRADO POR TENANT
      const { data: segments } = await supabase
        .from('segments')
        .select('id, name')
        .eq('is_active', true)
        .eq('tenant_id', tenantId);

      if (!segments || segments.length === 0) {
        return [];
      }

      // Buscar TODAS campanhas (não apenas ativas) para incluir leads de campanhas pausadas - FILTRADO POR TENANT
      const { data: campaigns } = await supabase
        .from('meta_campaigns')
        .select('id, name')
        .eq('tenant_id', tenantId);

      // Mapear campanhas para segmentos baseado no nome
      const campaignToSegment = new Map<string, { id: string; name: string }>();
      campaigns?.forEach(campaign => {
        const segment = extractSegmentFromCampaignName(campaign.name, segments);
        if (segment) {
          campaignToSegment.set(campaign.id, segment);
        }
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

      // Criar mapa de segment_id -> nome
      const segmentIdToName = new Map<string, string>();
      segments.forEach(s => segmentIdToName.set(s.id, s.name));

      // Agrupar leads por segmento da campanha
      const journeyData = new Map<string, {
        campaignSegmentId: string | null;
        totalLeads: number;
        breakdown: Map<string, {
          segmentId: string | null;
          count: number;
          layoutCount: number;
          pedidoFechadoCount: number;
        }>;
      }>();

      const processedContacts = new Set<string>();

      // Função auxiliar para processar um lead
      const processLead = (contact: any, campaignSegmentName: string, campaignSegmentId: string | null) => {
        // Evitar contar o mesmo contato múltiplas vezes
        if (processedContacts.has(contact.id)) return;
        processedContacts.add(contact.id);

        const assignedSegmentId = contact.segment_id;
        const assignedSegmentName = assignedSegmentId ? (segmentIdToName.get(assignedSegmentId) || 'Desconhecido') : 'Sem Segmento';

        if (!journeyData.has(campaignSegmentName)) {
          journeyData.set(campaignSegmentName, {
            campaignSegmentId: campaignSegmentId,
            totalLeads: 0,
            breakdown: new Map()
          });
        }

        const data = journeyData.get(campaignSegmentName)!;
        data.totalLeads++;

        if (!data.breakdown.has(assignedSegmentName)) {
          data.breakdown.set(assignedSegmentName, {
            segmentId: assignedSegmentId,
            count: 0,
            layoutCount: 0,
            pedidoFechadoCount: 0
          });
        }

        const breakdownData = data.breakdown.get(assignedSegmentName)!;
        breakdownData.count++;

        const status = contact.lead_status || '';
        if (status.includes('04 - Layout') || status.toLowerCase().includes('layout')) {
          breakdownData.layoutCount++;
        }
        if (conversionStatusNames.has(status)) {
          breakdownData.pedidoFechadoCount++;
        }
      };

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
          .select('id, lead_status, segment_id, referral_data, created_at')
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
        const refData = contact.referral_data as any;
        // Suportar ambos os nomes de campo: source_id (snake_case) e sourceId (camelCase)
        const sourceId = refData?.source_id || refData?.sourceId;

        // Tentar encontrar o segmento da campanha pelo sourceId
        let campaignSegmentName: string | null = null;
        let campaignSegmentId: string | null = null;

        if (sourceId) {
          const campaignId = adToCampaignMap[sourceId];
          if (campaignId) {
            const campaignSegment = campaignToSegment.get(campaignId);
            if (campaignSegment) {
              campaignSegmentName = campaignSegment.name;
              campaignSegmentId = campaignSegment.id;
            }
          }
        }

        // Se não encontrou segmento, agrupar como "Sem Segmento"
        if (!campaignSegmentName) {
          campaignSegmentName = 'Sem Segmento';
        }

        processLead(contact, campaignSegmentName, campaignSegmentId);
      });

      // ========================================
      // FONTE 2: Redirect (UTM) - usar utm_medium como segmento da campanha
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
            utm_medium,
            created_at,
            contact:contacts!inner(
              id,
              lead_status,
              segment_id,
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

        // Se o contato já foi processado como Meta Ads, pular
        if (processedContacts.has(contact.id)) return;
        // Se o contato tem origin = meta_ads, já foi contado acima
        if (contact.origin === 'meta_ads') return;

        // Usar utm_medium como segmento da campanha
        const utmMedium = normalizeUtmMedium(log.utm_medium);
        if (!utmMedium) return;

        // Tentar encontrar segmento correspondente
        const matchedSegment = segments.find(s =>
          s.name.toLowerCase() === utmMedium.toLowerCase()
        );

        processLead(contact, utmMedium, matchedSegment?.id || null);
      });

      // ========================================
      // Converter para array final
      // ========================================
      const result: SegmentJourneyData[] = [];

      journeyData.forEach((data, campaignSegmentName) => {
        const breakdown: SegmentBreakdown[] = [];
        let matchCount = 0;

        data.breakdown.forEach((bd, assignedSegmentName) => {
          const isMatch = assignedSegmentName.toUpperCase() === campaignSegmentName.toUpperCase();
          if (isMatch) {
            matchCount = bd.count;
          }

          breakdown.push({
            assignedSegment: assignedSegmentName,
            assignedSegmentId: bd.segmentId,
            count: bd.count,
            layoutCount: bd.layoutCount,
            pedidoFechadoCount: bd.pedidoFechadoCount,
            isMatch
          });
        });

        // Ordenar breakdown: primeiro o match, depois por contagem
        breakdown.sort((a, b) => {
          if (a.isMatch && !b.isMatch) return -1;
          if (!a.isMatch && b.isMatch) return 1;
          return b.count - a.count;
        });

        result.push({
          campaignSegment: campaignSegmentName,
          campaignSegmentId: data.campaignSegmentId,
          totalLeads: data.totalLeads,
          matchCount,
          matchRate: data.totalLeads > 0 ? (matchCount / data.totalLeads) * 100 : 0,
          breakdown
        });
      });

      // Ordenar por total de leads
      result.sort((a, b) => b.totalLeads - a.totalLeads);

      console.log(`[useMetaSegmentJourney] Loaded ${result.length} campaign segments`);

      return result;
    },
    staleTime: 60000,
  });
}
