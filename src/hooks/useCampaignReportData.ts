import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserStore } from '@/store/userStore';
import { format, eachDayOfInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { CampaignFilterState } from '@/components/campaigns/CampaignFilterBar';
import type { TimelineDataPoint } from '@/components/campaigns/CampaignTimelineChart';
import type { LeadInfo } from '@/components/campaigns/LeadsListModal';

// Função para converter data local para UTC (Brasília = UTC-3)
function toUTCDate(date: Date, endOfDay = false): string {
  const d = new Date(date);
  if (endOfDay) {
    d.setHours(23, 59, 59, 999);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  // Ajustar para UTC (adicionar 3 horas para compensar Brasília)
  d.setHours(d.getHours() + 3);
  return d.toISOString();
}

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

export interface StatusSummary {
  total: number;
  novo: number;
  catalogo: number;
  layout: number;
  fechado: number;
  naoRespondido: number; // Leads que não receberam resposta
  revenue: number;
}

export interface CampaignOption {
  id: string;
  name: string;
}

export interface CreativeOption {
  id: string;
  name: string;
  campaignId?: string;
}

export interface SegmentOption {
  id: string;
  name: string;
}

export interface StatusOption {
  id: string;
  name: string;
  color: string;
}

export interface CampaignReportData {
  summary: StatusSummary;
  timeline: TimelineDataPoint[];
  campaigns: CampaignOption[];
  creatives: CreativeOption[];
  segments: SegmentOption[];
  statuses: StatusOption[];
  leads: LeadInfo[];
}

export function useCampaignReportData(filters: CampaignFilterState) {
  const { tenantId } = useUserStore();

  return useQuery({
    queryKey: ['campaign-report-data', tenantId, filters],
    enabled: !!tenantId && !!filters.dateRange?.from && !!filters.dateRange?.to,
    staleTime: 60000,
    queryFn: async (): Promise<CampaignReportData> => {
      if (!tenantId || !filters.dateRange?.from || !filters.dateRange?.to) {
        throw new Error('Missing required parameters');
      }

      const dateFrom = toUTCDate(filters.dateRange.from, false);
      const dateTo = toUTCDate(filters.dateRange.to, true);

      // 1. Buscar lead statuses e configuração de conversão
      const { data: leadStatuses } = await supabase
        .from('lead_statuses')
        .select('id, name, color')
        .eq('tenant_id', tenantId)
        .order('order_index');

      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('conversion_status_ids')
        .eq('tenant_id', tenantId)
        .single();

      const statusMap = new Map<string, { name: string; color: string }>();
      leadStatuses?.forEach(s => statusMap.set(s.id, { name: s.name, color: s.color }));

      // Status de conversão (fechado) - usa o primeiro ID do array
      const conversionStatusId = companySettings?.conversion_status_ids?.[0] ?? null;

      // 2. Buscar segmentos
      const { data: segments } = await supabase
        .from('segments')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .order('name');

      // 3. Buscar campanhas do Meta Ads
      const { data: metaCampaigns } = await supabase
        .from('meta_campaigns')
        .select('id, name, campaign_id')
        .eq('tenant_id', tenantId);

      // 4. Buscar anúncios do Meta Ads
      const { data: metaAds } = await supabase
        .from('meta_ads')
        .select('id, name, ad_id, campaign_id')
        .eq('tenant_id', tenantId);

      // Criar mapas para lookup
      const adIdToAdName = new Map<string, string>();
      const adIdToCampaignId = new Map<string, string>();
      metaAds?.forEach(ad => {
        adIdToAdName.set(ad.ad_id, ad.name);
        adIdToCampaignId.set(ad.ad_id, ad.campaign_id);
      });

      const campaignIdToName = new Map<string, string>();
      metaCampaigns?.forEach(c => {
        campaignIdToName.set(c.campaign_id, c.name);
      });

      // 5. Buscar contatos de TODAS as fontes Meta (origin = 'meta_ads' OU redirect do Meta)
      const PAGE_SIZE = 1000;
      let allContacts: any[] = [];
      let page = 0;
      let hasMore = true;

      // 5a. Buscar leads diretos do Meta Ads
      while (hasMore) {
        let query = supabase
          .from('contacts')
          .select('id, full_name, phone, lead_status, segment_id, negotiated_value, referral_data, origin, created_at')
          .eq('tenant_id', tenantId)
          .eq('origin', 'meta_ads')
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        const { data: contacts } = await query;

        if (contacts && contacts.length > 0) {
          allContacts = [...allContacts, ...contacts];
          hasMore = contacts.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      // 5b. Buscar leads de Redirect que vieram do Meta (utm_source = facebook/instagram/meta)
      page = 0;
      hasMore = true;
      const processedIds = new Set(allContacts.map(c => c.id));

      while (hasMore) {
        let query = supabase
          .from('contacts')
          .select('id, full_name, phone, lead_status, segment_id, negotiated_value, referral_data, origin, created_at')
          .eq('tenant_id', tenantId)
          .eq('origin', 'redirect')
          .gte('created_at', dateFrom)
          .lte('created_at', dateTo)
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        const { data: contacts } = await query;

        if (contacts && contacts.length > 0) {
          // Filtrar apenas os que vieram do Meta (via utm_source)
          contacts.forEach((contact: any) => {
            if (processedIds.has(contact.id)) return;

            const refData = contact.referral_data as any;
            const utmSource = refData?.utm_source;

            if (isMetaSource(utmSource)) {
              allContacts.push(contact);
              processedIds.add(contact.id);
            }
          });
          hasMore = contacts.length === PAGE_SIZE;
          page++;
        } else {
          hasMore = false;
        }
      }

      // 5c. Buscar informações de conversa para identificar leads não respondidos
      const contactIds = allContacts.map(c => c.id);
      const conversationMap = new Map<string, { hasResponse: boolean }>();

      // Buscar em batches de 500 para evitar problemas com queries muito grandes
      const BATCH_SIZE = 500;
      for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
        const batch = contactIds.slice(i, i + BATCH_SIZE);
        const { data: conversations } = await supabase
          .from('conversations')
          .select('contact_id, first_response_at')
          .eq('tenant_id', tenantId)
          .in('contact_id', batch);

        conversations?.forEach((conv: any) => {
          const existing = conversationMap.get(conv.contact_id);
          // Se já tem resposta em alguma conversa, marca como respondido
          if (!existing || (conv.first_response_at && !existing.hasResponse)) {
            conversationMap.set(conv.contact_id, {
              hasResponse: !!conv.first_response_at
            });
          }
        });
      }

      // 5d. Buscar tags dos contatos
      const contactTagsMap = new Map<string, { name: string; color: string }[]>();
      for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
        const batch = contactIds.slice(i, i + BATCH_SIZE);
        const { data: contactTags } = await supabase
          .from('contact_tags')
          .select('contact_id, tag:tags(name, color)')
          .in('contact_id', batch);

        contactTags?.forEach((ct: any) => {
          if (!ct.tag) return;
          const existing = contactTagsMap.get(ct.contact_id) || [];
          existing.push({ name: ct.tag.name, color: ct.tag.color });
          contactTagsMap.set(ct.contact_id, existing);
        });
      }

      // 6. Processar dados
      const summary: StatusSummary = {
        total: 0,
        novo: 0,
        catalogo: 0,
        layout: 0,
        fechado: 0,
        naoRespondido: 0,
        revenue: 0,
      };

      // Timeline por dia
      const days = eachDayOfInterval({
        start: filters.dateRange.from,
        end: filters.dateRange.to,
      });

      const timelineMap = new Map<string, TimelineDataPoint>();
      days.forEach(day => {
        const key = format(day, 'dd/MM', { locale: ptBR });
        timelineMap.set(key, {
          date: key,
          leads: 0,
          catalogo: 0,
          layout: 0,
          fechado: 0,
        });
      });

      // Criativos únicos encontrados
      const uniqueCreatives = new Map<string, CreativeOption>();
      const uniqueCampaigns = new Map<string, CampaignOption>();

      // Processar contatos
      const leads: LeadInfo[] = [];

      allContacts.forEach((contact: any) => {
        const refData = contact.referral_data as any;
        const sourceId = refData?.source_id || refData?.sourceId || refData?.utm_term;
        const status = contact.lead_status || 'new';
        const statusInfo = statusMap.get(status);

        // Extrair informações do criativo/campanha
        let creativeName = refData?.utm_content || refData?.headline || 'Não identificado';
        let campaignName = 'Não identificada';
        let campaignId = '';

        if (sourceId) {
          const adName = adIdToAdName.get(sourceId);
          if (adName) creativeName = adName;

          const adCampaignId = adIdToCampaignId.get(sourceId);
          if (adCampaignId) {
            campaignId = adCampaignId;
            campaignName = campaignIdToName.get(adCampaignId) || campaignName;
          }
        }

        // Aplicar filtros
        if (filters.campaign && campaignId !== filters.campaign) return;
        if (filters.creative && sourceId !== filters.creative) return;
        if (filters.segment && contact.segment_id !== filters.segment) return;
        if (filters.status && contact.lead_status !== filters.status) return;

        // Adicionar ao criativo único
        if (sourceId && !uniqueCreatives.has(sourceId)) {
          uniqueCreatives.set(sourceId, { id: sourceId, name: creativeName, campaignId });
        }

        // Adicionar à campanha única
        if (campaignId && !uniqueCampaigns.has(campaignId)) {
          uniqueCampaigns.set(campaignId, { id: campaignId, name: campaignName });
        }

        // Atualizar summary
        summary.total++;
        summary.revenue += contact.negotiated_value || 0;

        // Verificar se foi respondido
        const convInfo = conversationMap.get(contact.id);
        const wasResponded = convInfo?.hasResponse ?? false;
        if (!wasResponded) {
          summary.naoRespondido++;
        }

        // Classificar por status
        const statusName = statusInfo?.name?.toLowerCase() || status.toLowerCase();
        const isConversion = status === conversionStatusId ||
                           statusName.includes('fechado') ||
                           statusName.includes('ganho') ||
                           statusName.includes('convertido') ||
                           statusName.includes('pedido');

        if (isConversion) {
          summary.fechado++;
        } else if (statusName.includes('catálogo') || statusName.includes('catalogo')) {
          summary.catalogo++;
        } else if (statusName.includes('layout')) {
          summary.layout++;
        } else {
          summary.novo++;
        }

        // Atualizar timeline
        const contactDate = new Date(contact.created_at);
        // Ajustar para timezone Brasília
        contactDate.setHours(contactDate.getHours() - 3);
        const dayKey = format(contactDate, 'dd/MM', { locale: ptBR });

        if (timelineMap.has(dayKey)) {
          const dayData = timelineMap.get(dayKey)!;
          dayData.leads++;

          if (isConversion) {
            dayData.fechado++;
          } else if (statusName.includes('catálogo') || statusName.includes('catalogo')) {
            dayData.catalogo++;
          } else if (statusName.includes('layout')) {
            dayData.layout++;
          }
        }

        // Adicionar lead à lista
        leads.push({
          id: contact.id,
          fullName: contact.full_name,
          phone: contact.phone,
          status: statusInfo?.name || status,
          statusColor: statusInfo?.color || '#6B7280',
          segment: segments?.find(s => s.id === contact.segment_id)?.name,
          negotiatedValue: contact.negotiated_value || 0,
          createdAt: contact.created_at,
          wasResponded: wasResponded,
          tags: contactTagsMap.get(contact.id) || [],
        });
      });

      // Converter timeline para array
      const timeline = Array.from(timelineMap.values());

      // Converter opções para arrays
      const campaignOptions: CampaignOption[] = Array.from(uniqueCampaigns.values()).sort((a, b) => a.name.localeCompare(b.name));
      const creativeOptions: CreativeOption[] = Array.from(uniqueCreatives.values()).sort((a, b) => a.name.localeCompare(b.name));
      const segmentOptions: SegmentOption[] = segments?.map(s => ({ id: s.id, name: s.name })) || [];
      const statusOptions: StatusOption[] = leadStatuses?.map(s => ({ id: s.id, name: s.name, color: s.color })) || [];

      // Ordenar leads por data (mais recente primeiro)
      leads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return {
        summary,
        timeline,
        campaigns: campaignOptions,
        creatives: creativeOptions,
        segments: segmentOptions,
        statuses: statusOptions,
        leads,
      };
    },
  });
}
