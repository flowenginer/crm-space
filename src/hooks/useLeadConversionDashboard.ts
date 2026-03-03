import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';

// =====================================================
// Types
// =====================================================

export interface ConversionLead {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  origin: string | null;
  origin_campaign: string | null;
  lead_status: string | null;
  created_at: string;
  is_converted: boolean;
  conversion_source: 'custom_field' | 'status' | null;
  custom_field_value: string | null;
  creative_name: string | null;
  adset_name: string | null;
  campaign_name: string | null;
  segment_name: string | null;
  assigned_to_name: string | null;
  negotiated_value: number | null;
}

export interface ConversionSummary {
  totalLeads: number;
  convertedLeads: number;
  conversionRate: number;
  totalValue: number;
  convertedByCustomField: number;
  convertedByStatus: number;
}

export interface OriginBreakdown {
  origin: string;
  label: string;
  color: string;
  total: number;
  converted: number;
  conversionRate: number;
  totalValue: number;
}

export interface CreativeConversionBreakdown {
  creative_name: string;
  campaign_name: string | null;
  adset_name: string | null;
  total: number;
  converted: number;
  conversionRate: number;
}

export interface StatusBreakdown {
  status: string;
  count: number;
  is_conversion_status: boolean;
}

export interface LeadConversionFilters {
  dateFrom: string;
  dateTo: string;
  origin?: string | null;
  campaignName?: string | null;
}

// =====================================================
// Origin config (reused from useLeadJourneyDashboard)
// =====================================================

const ORIGIN_CONFIG: Record<string, { label: string; color: string }> = {
  meta_ads: { label: 'Meta Ads', color: '#1877F2' },
  ctwa_ad: { label: 'Meta Ads', color: '#1877F2' },
  linktree: { label: 'Linktree', color: '#39E09B' },
  site: { label: 'Site', color: '#F59E0B' },
  referral: { label: 'Indicacao', color: '#EC4899' },
  manual: { label: 'Manual', color: '#8B5CF6' },
  organic_unknown: { label: 'Organico', color: '#6B7280' },
  whatsapp: { label: 'WhatsApp Direto', color: '#25D366' },
  redirect: { label: 'Redirect', color: '#F97316' },
  landing_page: { label: 'Landing Page', color: '#06B6D4' },
  website: { label: 'Website', color: '#0EA5E9' },
  other: { label: 'Outros', color: '#94A3B8' },
};

// =====================================================
// Conversion detection
// =====================================================

const CONVERSION_STATUS_PREFIXES = ['07', '08', '09', '10', '11', '12', '13'];

function checkConversion(
  leadStatus: string | null,
  customFields: Record<string, any> | null,
  conversionFieldKey: string | null,
): { converted: boolean; source: 'custom_field' | 'status' | null; fieldValue: string | null } {
  // Criterio 1: Custom field preenchido
  if (conversionFieldKey && customFields) {
    const value = customFields[conversionFieldKey];
    if (value !== null && value !== undefined && value !== '' && value !== false) {
      return { converted: true, source: 'custom_field', fieldValue: String(value) };
    }
  }

  // Criterio 2: Status de conversao (07-13)
  if (leadStatus) {
    const match = leadStatus.match(/^(\d+)/);
    if (match) {
      const prefix = match[1].padStart(2, '0');
      if (CONVERSION_STATUS_PREFIXES.includes(prefix)) {
        return { converted: true, source: 'status', fieldValue: null };
      }
    }
  }

  return { converted: false, source: null, fieldValue: null };
}

// =====================================================
// Referral normalization (same logic as useWhatsAppLeadTracking)
// =====================================================

function normalizeReferral(ref: Record<string, any> | null) {
  if (!ref) return null;
  return {
    sourceId: ref.sourceId || ref.source_id || null,
    sourceType: ref.sourceType || ref.source_type || null,
    sourceUrl: ref.sourceUrl || ref.source_url || null,
    adName: ref.adName || null,
    headline: ref.headline || null,
    utmSource: ref.utm_source || null,
    utmMedium: ref.utm_medium || null,
    utmCampaign: ref.utm_campaign || null,
    utmContent: ref.utm_content || null,
    utmTerm: ref.utm_term || null,
    detectedBy: ref.detected_by || null,
  };
}

// =====================================================
// Hook principal
// =====================================================

export function useLeadConversionDashboard(filters: LeadConversionFilters) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['lead-conversion-dashboard', tenantId, filters.dateFrom, filters.dateTo, filters.origin, filters.campaignName],
    queryFn: async (): Promise<{
      leads: ConversionLead[];
      summary: ConversionSummary;
      originBreakdown: OriginBreakdown[];
      creativeBreakdown: CreativeConversionBreakdown[];
      statusBreakdown: StatusBreakdown[];
    }> => {
      if (!tenantId) {
        return {
          leads: [],
          summary: { totalLeads: 0, convertedLeads: 0, conversionRate: 0, totalValue: 0, convertedByCustomField: 0, convertedByStatus: 0 },
          originBreakdown: [],
          creativeBreakdown: [],
          statusBreakdown: [],
        };
      }

      // Execute all queries in parallel
      const [contactsResult, customFieldsResult, metaAdsResult, conversationsResult] = await Promise.all([
        // 1. All contacts
        supabase
          .from('contacts')
          .select(`
            id, full_name, phone, email, lead_status, lead_score, origin, origin_campaign,
            custom_fields, referral_data, created_at, negotiated_value,
            segment:segments!segment_id(name),
            profile:profiles!assigned_to(full_name)
          `)
          .eq('tenant_id', tenantId)
          .gte('created_at', filters.dateFrom)
          .lte('created_at', filters.dateTo + 'T23:59:59')
          .order('created_at', { ascending: false })
          .limit(10000),

        // 2. Custom field definitions (detect conversion field)
        supabase
          .from('custom_field_definitions')
          .select('id, name, field_key, field_type')
          .eq('tenant_id', tenantId)
          .eq('entity_type', 'contact')
          .ilike('name', '%convers%'),

        // 3. Meta ads for creative matching
        supabase
          .from('meta_ads')
          .select(`
            id, ad_id, name, creative_id,
            adset:meta_adsets(id, adset_id, name),
            campaign:meta_campaigns(id, campaign_id, name)
          `)
          .eq('tenant_id', tenantId)
          .limit(2000),

        // 4. Conversations with referral data
        supabase
          .from('conversations')
          .select('id, contact_id, referral_source, referral_data, created_at')
          .eq('tenant_id', tenantId)
          .in('referral_source', ['meta_ads', 'ctwa_ad', 'redirect', 'linktree'])
          .gte('created_at', filters.dateFrom)
          .lte('created_at', filters.dateTo + 'T23:59:59')
          .limit(10000),
      ]);

      if (contactsResult.error) throw contactsResult.error;

      const contacts = contactsResult.data || [];
      const customFieldDefs = customFieldsResult.data || [];
      const metaAds = metaAdsResult.data || [];
      const conversations = conversationsResult.data || [];

      // Detect conversion field key
      const conversionFieldDef = customFieldDefs[0];
      const conversionFieldKey = conversionFieldDef?.field_key || conversionFieldDef?.name || null;

      // Build meta_ads lookup maps
      const adByAdId = new Map<string, (typeof metaAds)[0]>();
      const adByCreativeId = new Map<string, (typeof metaAds)[0]>();
      const adByName = new Map<string, (typeof metaAds)[0]>();

      metaAds.forEach(ad => {
        if (ad.ad_id) adByAdId.set(ad.ad_id, ad);
        if (ad.creative_id) adByCreativeId.set(ad.creative_id, ad);
        if (ad.name) adByName.set(ad.name.toLowerCase(), ad);
      });

      // Build conversation referral map (contact_id → referral data)
      const convByContact = new Map<string, (typeof conversations)[0]>();
      for (const conv of conversations) {
        if (!conv.contact_id) continue;
        const existing = convByContact.get(conv.contact_id);
        if (!existing || new Date(conv.created_at) > new Date(existing.created_at)) {
          convByContact.set(conv.contact_id, conv);
        }
      }

      // Process each contact
      const leads: ConversionLead[] = [];

      for (const contact of contacts) {
        const segment = contact.segment as any;
        const profile = contact.profile as any;
        const customFields = contact.custom_fields as Record<string, any> | null;

        // Check conversion
        const { converted, source, fieldValue } = checkConversion(
          contact.lead_status,
          customFields,
          conversionFieldKey,
        );

        // Try to match creative from conversation referral
        let creativeName: string | null = null;
        let adsetName: string | null = null;
        let campaignName: string | null = null;

        const conv = convByContact.get(contact.id);
        if (conv) {
          const rawRef = conv.referral_data as Record<string, any> | null;
          const norm = normalizeReferral(rawRef);

          if (norm && !norm.detectedBy) {
            const isCTWA = conv.referral_source === 'meta_ads' || conv.referral_source === 'ctwa_ad';

            if (isCTWA) {
              // Match CTWA
              let matched: any = null;
              if (norm.sourceId) {
                matched = adByAdId.get(String(norm.sourceId)) || adByCreativeId.get(String(norm.sourceId));
              }
              if (!matched && norm.adName) {
                matched = adByName.get(norm.adName.toLowerCase());
              }
              if (!matched && norm.headline) {
                matched = adByName.get(norm.headline.toLowerCase());
              }
              creativeName = matched?.name || norm.adName || norm.headline || null;
              adsetName = (matched?.adset as any)?.name || null;
              campaignName = (matched?.campaign as any)?.name || norm.adName || null;
            } else {
              // Redirect
              let matched: any = null;
              if (norm.utmTerm) {
                matched = adByAdId.get(String(norm.utmTerm));
              }
              creativeName = norm.utmContent || matched?.name || null;
              adsetName = norm.utmMedium || (matched?.adset as any)?.name || null;
              campaignName = (matched?.campaign as any)?.name || norm.utmCampaign || null;
            }
          }
        }

        // Also check contact's own referral_data (some contacts store it directly)
        if (!creativeName && contact.referral_data) {
          const contactRef = normalizeReferral(contact.referral_data as Record<string, any>);
          if (contactRef && !contactRef.detectedBy) {
            if (contactRef.sourceId) {
              const matched = adByAdId.get(String(contactRef.sourceId)) || adByCreativeId.get(String(contactRef.sourceId));
              if (matched) {
                creativeName = matched.name;
                adsetName = (matched.adset as any)?.name || null;
                campaignName = (matched.campaign as any)?.name || null;
              }
            }
            if (!creativeName && contactRef.utmContent) {
              creativeName = contactRef.utmContent;
            }
            if (!adsetName && contactRef.utmMedium) {
              adsetName = contactRef.utmMedium;
            }
            if (!campaignName && contactRef.utmCampaign) {
              campaignName = contactRef.utmCampaign;
            }
          }
        }

        leads.push({
          id: contact.id,
          full_name: contact.full_name,
          phone: contact.phone,
          email: contact.email,
          origin: contact.origin,
          origin_campaign: contact.origin_campaign,
          lead_status: contact.lead_status,
          created_at: contact.created_at,
          is_converted: converted,
          conversion_source: source,
          custom_field_value: fieldValue,
          creative_name: creativeName,
          adset_name: adsetName,
          campaign_name: campaignName,
          segment_name: segment?.name || null,
          assigned_to_name: profile?.full_name || null,
          negotiated_value: contact.negotiated_value,
        });
      }

      // Apply filters
      let filteredLeads = leads;
      if (filters.origin) {
        filteredLeads = filteredLeads.filter(l => (l.origin || 'other') === filters.origin);
      }
      if (filters.campaignName) {
        filteredLeads = filteredLeads.filter(l => l.campaign_name === filters.campaignName);
      }

      // Build summary
      const convertedLeads = filteredLeads.filter(l => l.is_converted);
      const summary: ConversionSummary = {
        totalLeads: filteredLeads.length,
        convertedLeads: convertedLeads.length,
        conversionRate: filteredLeads.length > 0 ? (convertedLeads.length / filteredLeads.length) * 100 : 0,
        totalValue: convertedLeads.reduce((sum, l) => sum + (l.negotiated_value || 0), 0),
        convertedByCustomField: convertedLeads.filter(l => l.conversion_source === 'custom_field').length,
        convertedByStatus: convertedLeads.filter(l => l.conversion_source === 'status').length,
      };

      // Build origin breakdown
      const originMap = new Map<string, OriginBreakdown>();
      filteredLeads.forEach(l => {
        const key = l.origin || 'other';
        const existing = originMap.get(key);
        const config = ORIGIN_CONFIG[key] || ORIGIN_CONFIG.other;

        if (existing) {
          existing.total += 1;
          if (l.is_converted) {
            existing.converted += 1;
            existing.totalValue += l.negotiated_value || 0;
          }
          existing.conversionRate = existing.total > 0 ? (existing.converted / existing.total) * 100 : 0;
        } else {
          originMap.set(key, {
            origin: key,
            label: config.label,
            color: config.color,
            total: 1,
            converted: l.is_converted ? 1 : 0,
            conversionRate: l.is_converted ? 100 : 0,
            totalValue: l.is_converted ? (l.negotiated_value || 0) : 0,
          });
        }
      });

      const originBreakdown = Array.from(originMap.values())
        .sort((a, b) => b.total - a.total);

      // Build creative breakdown (only leads with creative)
      const creativeMap = new Map<string, CreativeConversionBreakdown>();
      filteredLeads.forEach(l => {
        if (!l.creative_name) return;
        const key = l.creative_name;
        const existing = creativeMap.get(key);

        if (existing) {
          existing.total += 1;
          if (l.is_converted) existing.converted += 1;
          existing.conversionRate = existing.total > 0 ? (existing.converted / existing.total) * 100 : 0;
        } else {
          creativeMap.set(key, {
            creative_name: key,
            campaign_name: l.campaign_name,
            adset_name: l.adset_name,
            total: 1,
            converted: l.is_converted ? 1 : 0,
            conversionRate: l.is_converted ? 100 : 0,
          });
        }
      });

      const creativeBreakdown = Array.from(creativeMap.values())
        .sort((a, b) => b.total - a.total);

      // Build status breakdown
      const statusMap = new Map<string, StatusBreakdown>();
      filteredLeads.forEach(l => {
        const status = l.lead_status || '(Sem status)';
        const existing = statusMap.get(status);
        const match = status.match(/^(\d+)/);
        const prefix = match ? match[1].padStart(2, '0') : null;
        const isConversion = prefix ? CONVERSION_STATUS_PREFIXES.includes(prefix) : false;

        if (existing) {
          existing.count += 1;
        } else {
          statusMap.set(status, {
            status,
            count: 1,
            is_conversion_status: isConversion,
          });
        }
      });

      const statusBreakdown = Array.from(statusMap.values())
        .sort((a, b) => {
          const numA = parseInt(a.status.match(/^(\d+)/)?.[1] || '999');
          const numB = parseInt(b.status.match(/^(\d+)/)?.[1] || '999');
          if (a.status === 'new' || a.status === '(Sem status)') return -1;
          if (b.status === 'new' || b.status === '(Sem status)') return 1;
          if (numA !== numB) return numA - numB;
          return a.status.localeCompare(b.status);
        });

      return { leads: filteredLeads, summary, originBreakdown, creativeBreakdown, statusBreakdown };
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });
}
