import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
export interface UTMBreakdownEnhanced {
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  visits: number;
  leads: number;
  catalogo: number;
  layout: number;
  fechados: number;
  conversionRate: number;
}

export interface RedirectDashboardEnhancedSummary {
  totalVisits: number;
  totalLeads: number;
  conversionRate: number;
  costPerLead: number;
  totalSpend: number;
  leadsInCatalogo: number;
  leadsInLayout: number;
  pedidosFechados: number;
  uniqueSources: number;
}

export interface UnmappedSummary {
  totalVisits: number;
  totalLeads: number;
}

export interface RedirectDashboardEnhancedData {
  summary: RedirectDashboardEnhancedSummary;
  utmBreakdown: UTMBreakdownEnhanced[];
  unmappedBreakdown: UTMBreakdownEnhanced[];
  unmappedSummary: UnmappedSummary;
  hasUntracked: boolean;
}

interface UseRedirectDashboardEnhancedParams {
  redirectCampaignId?: string;
  startDate?: string;
  endDate?: string;
  selectedMetaAdNames?: string[];
}

// Função para limpar content: usa medium como fallback se content for grande/encoded
function getCleanContent(utm_content: string | null, utm_medium: string | null): string | null {
  if (!utm_content) return utm_medium;
  
  const hasUrlEncoding = utm_content.includes('%');
  const isTooLong = utm_content.length > 40;
  
  if (hasUrlEncoding || isTooLong) {
    return utm_medium || utm_content;
  }
  
  return utm_content;
}
// Função para buscar todos os registros com paginação
// OBS: o PostgREST do Supabase costuma ter limite máximo de 1000 linhas por request.
// Por isso usamos pageSize=1000 e avançamos pelo tamanho retornado.
async function fetchAllRecords<T>(
  buildQuery: () => any,
  pageSize = 1000
): Promise<T[]> {
  const allRecords: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await buildQuery().range(offset, offset + pageSize - 1);
    if (error) throw error;

    const chunk = (data || []) as T[];
    if (chunk.length === 0) break;

    allRecords.push(...chunk);
    offset += chunk.length;

    if (chunk.length < pageSize) break;
  }

  return allRecords;
}

// Função para normalizar nome de anúncio para comparação
function normalizeAdName(name: string): string {
  return name
    .replace(/\+/g, ' ')
    .replace(/%20/g, ' ')
    .replace(/%[0-9A-Fa-f]{2}/g, ' ')
    .trim()
    .toLowerCase();
}

export function useRedirectDashboardEnhanced({ redirectCampaignId, startDate, endDate, selectedMetaAdNames = [] }: UseRedirectDashboardEnhancedParams) {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  return useQuery({
    queryKey: ['redirect-dashboard-enhanced', tenantId, redirectCampaignId, startDate, endDate, selectedMetaAdNames],
    queryFn: async (): Promise<RedirectDashboardEnhancedData> => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      // Funções auxiliares para identificar status pelo nome (o campo lead_status armazena o nome, não o ID)
      const isCatalogoStatus = (status: string | null): boolean => {
        if (!status) return false;
        const lower = status.toLowerCase();
        return lower.includes('catálogo') || lower.includes('catalogo');
      };
      
      const isLayoutStatus = (status: string | null): boolean => {
        if (!status) return false;
        return status.toLowerCase().includes('layout');
      };
      
      const isConvertedStatus = (status: string | null): boolean => {
        if (!status) return false;
        // Status 07 a 10: Pedido Fechado, Em andamento, Cobrança, Aguardando envio
        return /^(07|08|09|10)\s*-/.test(status);
      };
      
      const isConverted = (contact: any): boolean => {
        if (!contact) return false;
        if (isConvertedStatus(contact.lead_status)) return true;
        // Verificar custom_fields.conversoes
        const cf = contact.custom_fields;
        if (cf && typeof cf === 'object') {
          const conversoes = (cf as any).conversoes;
          if (conversoes && (typeof conversoes === 'string' ? conversoes.trim() !== '' : Array.isArray(conversoes) ? conversoes.length > 0 : true)) {
            return true;
          }
        }
        return false;
      };

      // 2. Buscar visitas agrupadas por UTM (com paginação)
      const buildViewsQuery = () => {
        let query = supabase
          .from('redirect_campaign_views')
          .select('utm_source, utm_medium, utm_campaign, utm_content, visitor_id, created_at')
          .eq('tenant_id', tenantId);

        if (redirectCampaignId) {
          query = query.eq('campaign_id', redirectCampaignId);
        }
        if (startDate) {
          query = query.gte('created_at', `${startDate}T00:00:00`);
        }
        if (endDate) {
          query = query.lte('created_at', `${endDate}T23:59:59`);
        }
        return query;
      };

      const visitsData = await fetchAllRecords<any>(buildViewsQuery);

      // 3. Buscar leads com status do contato (com paginação)
      const buildLogsQuery = () => {
        let query = supabase
          .from('redirect_logs')
          .select(`
            utm_source, 
            utm_medium, 
            utm_campaign, 
            utm_content, 
            contact_id,
            created_at,
            contact:contacts(id, lead_status, custom_fields)
          `)
          .eq('tenant_id', tenantId);

        if (redirectCampaignId) {
          query = query.eq('campaign_id', redirectCampaignId);
        }
        if (startDate) {
          query = query.gte('created_at', `${startDate}T00:00:00`);
        }
        if (endDate) {
          query = query.lte('created_at', `${endDate}T23:59:59`);
        }
        return query;
      };

      const leadsData = await fetchAllRecords<any>(buildLogsQuery);

      // 4. Buscar anúncios do Meta Ads e seus spends por campanha
      let totalSpend = 0;
      let metaAdsData: any[] = [];
      
      if (startDate && endDate) {
        // Buscar todos os anúncios com suas campanhas
        const { data: adsData } = await supabase
          .from('meta_ads')
          .select(`
            id,
            ad_id,
            name,
            campaign_id,
            campaign:meta_campaigns(id, campaign_id, name)
          `)
          .eq('tenant_id', tenantId);
        
        metaAdsData = adsData || [];

        // Buscar insights das campanhas
        const { data: insightsData, error: insightsError } = await supabase
          .from('meta_campaign_insights')
          .select('campaign_id, spend')
          .gte('date_start', startDate)
          .lte('date_stop', endDate);

        if (!insightsError && insightsData) {
          // Se houver anúncios selecionados, calcular spend proporcional
          if (selectedMetaAdNames.length > 0) {
            // Agrupar spend por campaign_id
            const spendByCampaign: Record<string, number> = {};
            insightsData.forEach(row => {
              const cId = row.campaign_id;
              spendByCampaign[cId] = (spendByCampaign[cId] || 0) + (Number(row.spend) || 0);
            });

            // Contar anúncios por campanha
            const adsPerCampaign: Record<string, string[]> = {};
            metaAdsData.forEach(ad => {
              const campaignDbId = (ad.campaign as any)?.id;
              if (campaignDbId) {
                if (!adsPerCampaign[campaignDbId]) {
                  adsPerCampaign[campaignDbId] = [];
                }
                adsPerCampaign[campaignDbId].push(ad.name);
              }
            });

            // Calcular spend proporcional apenas para anúncios selecionados
            const normalizedSelectedAds = selectedMetaAdNames.map(n => normalizeAdName(n));
            
            Object.entries(adsPerCampaign).forEach(([campaignDbId, adNames]) => {
              const campaignSpend = spendByCampaign[campaignDbId] || 0;
              const totalAdsInCampaign = adNames.length;
              
              if (totalAdsInCampaign > 0 && campaignSpend > 0) {
                const spendPerAd = campaignSpend / totalAdsInCampaign;
                const selectedAdsInThisCampaign = adNames.filter(name => 
                  normalizedSelectedAds.some(selected => normalizeAdName(name).includes(selected) || selected.includes(normalizeAdName(name)))
                );
                totalSpend += spendPerAd * selectedAdsInThisCampaign.length;
              }
            });
          } else {
            // Se não houver anúncios selecionados, usar spend total
            totalSpend = insightsData.reduce((sum, row) => sum + (Number(row.spend) || 0), 0);
          }
        }
      }

      // Normalizar nomes de anúncios selecionados para comparação
      const normalizedSelectedAds = selectedMetaAdNames.map(n => normalizeAdName(n));
      
      // Função para verificar se o utm_content corresponde a um anúncio selecionado
      const matchesSelectedAds = (utmContent: string | null): boolean => {
        if (selectedMetaAdNames.length === 0) return true; // Se nada selecionado, mostrar tudo
        if (!utmContent) return false;
        
        const normalizedContent = normalizeAdName(utmContent);
        return normalizedSelectedAds.some(adName => 
          normalizedContent.includes(adName) || adName.includes(normalizedContent)
        );
      };

      // 5. Processar visitas por UTM (contando visitantes únicos)
      // Mapas separados para mapeados e não mapeados
      const visitsMap = new Map<string, { 
        utm_source: string | null; 
        utm_campaign: string | null; 
        utm_content: string | null; 
        visitors: Set<string> 
      }>();
      const unmappedVisitsMap = new Map<string, { 
        utm_source: string | null; 
        utm_campaign: string | null; 
        utm_content: string | null; 
        visitors: Set<string> 
      }>();
      
      const hasAdFilter = selectedMetaAdNames.length > 0;
      
      (visitsData || []).forEach((v) => {
        const cleanContent = getCleanContent(v.utm_content, v.utm_medium);
        const key = `${v.utm_source || "(direto)"}|${v.utm_campaign || "(none)"}|${cleanContent || "(none)"}`;
        
        // Determinar qual mapa usar
        const matches = matchesSelectedAds(cleanContent);
        const targetMap = (hasAdFilter && !matches) ? unmappedVisitsMap : visitsMap;
        
        if (!targetMap.has(key)) {
          targetMap.set(key, {
            utm_source: v.utm_source,
            utm_campaign: v.utm_campaign,
            utm_content: cleanContent,
            visitors: new Set(),
          });
        }
        targetMap.get(key)!.visitors.add(v.visitor_id);
      });

      // 6. Processar leads por UTM com status (contatos únicos por chave UTM)
      const leadsMap = new Map<string, { 
        total: number; 
        catalogo: number; 
        layout: number; 
        fechados: number;
        contacts: Set<string>;
      }>();
      const unmappedLeadsMap = new Map<string, { 
        total: number; 
        catalogo: number; 
        layout: number; 
        fechados: number;
        contacts: Set<string>;
      }>();
      
      (leadsData || []).forEach((l) => {
        const contactId = l.contact_id as string;
        if (!contactId) return;
        
        const cleanContent = getCleanContent(l.utm_content, l.utm_medium);
        const key = `${l.utm_source || "(direto)"}|${l.utm_campaign || "(none)"}|${cleanContent || "(none)"}`;
        
        // Determinar qual mapa usar
        const matches = matchesSelectedAds(cleanContent);
        const targetMap = (hasAdFilter && !matches) ? unmappedLeadsMap : leadsMap;
        
        if (!targetMap.has(key)) {
          targetMap.set(key, { total: 0, catalogo: 0, layout: 0, fechados: 0, contacts: new Set() });
        }
        
        const entry = targetMap.get(key)!;
        
        // Deduplicar: só contar cada contato uma vez por chave UTM
        if (entry.contacts.has(contactId)) return;
        entry.contacts.add(contactId);
        
        entry.total += 1;
        
        const contact = l.contact as any;
        const leadStatus = contact?.lead_status as string | null;
        if (isCatalogoStatus(leadStatus)) {
          entry.catalogo += 1;
        }
        if (isLayoutStatus(leadStatus)) {
          entry.layout += 1;
        }
        if (isConverted(contact)) {
          entry.fechados += 1;
        }
      });

      // 7. Função helper para processar breakdown
      const processBreakdown = (
        vMap: Map<string, { utm_source: string | null; utm_campaign: string | null; utm_content: string | null; visitors: Set<string> }>,
        lMap: Map<string, { total: number; catalogo: number; layout: number; fechados: number; contacts: Set<string> }>
      ): UTMBreakdownEnhanced[] => {
        const allKeys = new Set([...vMap.keys(), ...lMap.keys()]);
        const breakdown: UTMBreakdownEnhanced[] = [];

        allKeys.forEach((key) => {
          const [source, campaign, content] = key.split("|");
          const visitsEntry = vMap.get(key);
          const leadsEntry = lMap.get(key);
          
          const visits = visitsEntry ? visitsEntry.visitors.size : 0;
          const leads = leadsEntry?.total || 0;
          const catalogo = leadsEntry?.catalogo || 0;
          const layout = leadsEntry?.layout || 0;
          const fechados = leadsEntry?.fechados || 0;

          breakdown.push({
            utm_source: source === "(direto)" ? null : source,
            utm_campaign: campaign === "(none)" ? null : campaign,
            utm_content: content === "(none)" ? null : content,
            visits,
            leads,
            catalogo,
            layout,
            fechados,
            conversionRate: visits > 0 ? (leads / visits) * 100 : 0,
          });
        });

        breakdown.sort((a, b) => b.visits - a.visits);
        return breakdown;
      };

      // Processar breakdown mapeado
      const utmBreakdown = processBreakdown(visitsMap, leadsMap);
      
      // Processar breakdown não mapeado
      const unmappedBreakdown = processBreakdown(unmappedVisitsMap, unmappedLeadsMap);

      // Calcular unique sources
      const uniqueSources = new Set<string>();
      utmBreakdown.forEach(r => {
        if (r.utm_source) uniqueSources.add(r.utm_source);
      });

      // 8. Calcular totais
      const totalVisits = utmBreakdown.reduce((sum, r) => sum + r.visits, 0);
      const totalLeads = utmBreakdown.reduce((sum, r) => sum + r.leads, 0);
      const leadsInCatalogo = utmBreakdown.reduce((sum, r) => sum + r.catalogo, 0);
      const leadsInLayout = utmBreakdown.reduce((sum, r) => sum + r.layout, 0);
      const pedidosFechados = utmBreakdown.reduce((sum, r) => sum + r.fechados, 0);
      const conversionRate = totalVisits > 0 ? (totalLeads / totalVisits) * 100 : 0;
      
      // Totais não mapeados
      const unmappedTotalVisits = unmappedBreakdown.reduce((sum, r) => sum + r.visits, 0);
      const unmappedTotalLeads = unmappedBreakdown.reduce((sum, r) => sum + r.leads, 0);
      
      // CPL = Custo por lead (considerando leads do meta_ads)
      const metaAdsLeads = utmBreakdown
        .filter(r => r.utm_source === 'meta_ads')
        .reduce((sum, r) => sum + r.leads, 0);
      const costPerLead = metaAdsLeads > 0 ? totalSpend / metaAdsLeads : 0;

      const hasUntracked = utmBreakdown.some(r => r.utm_source === null);

      return {
        summary: {
          totalVisits,
          totalLeads,
          conversionRate,
          costPerLead,
          totalSpend,
          leadsInCatalogo,
          leadsInLayout,
          pedidosFechados,
          uniqueSources: uniqueSources.size,
        },
        utmBreakdown,
        unmappedBreakdown,
        unmappedSummary: {
          totalVisits: unmappedTotalVisits,
          totalLeads: unmappedTotalLeads,
        },
        hasUntracked,
      };
    },
    enabled: !!tenantId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
