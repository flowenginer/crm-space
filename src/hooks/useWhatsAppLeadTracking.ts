import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';

// =====================================================
// Types
// =====================================================

export interface TrackedLead {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  origin: string;
  origin_campaign: string | null;
  lead_status: string | null;
  created_at: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  referral_data: Record<string, any> | null;
  ad_name: string | null;
  adset_name: string | null;
  campaign_name: string | null;
  creative_name: string | null;
  source_type: 'ctwa' | 'redirect';
  creative_matched: boolean;
}

export interface LeadTrackingSummary {
  totalLeads: number;
  ctwaLeads: number;
  redirectLeads: number;
  matchedCreatives: number;
  unmatchedCreatives: number;
}

export interface CreativeBreakdown {
  creative_name: string;
  adset_name: string | null;
  campaign_name: string | null;
  lead_count: number;
  source_type: 'ctwa' | 'redirect' | 'mixed';
}

export interface WhatsAppLeadTrackingFilters {
  dateFrom: string;
  dateTo: string;
  sourceType?: 'all' | 'ctwa' | 'redirect';
  metaAccountId?: string | null;
}

// =====================================================
// Classification helpers
// =====================================================

/** Detect if referral_data comes from a CTWA (Click-to-WhatsApp) ad */
function isCTWAReferral(ref: Record<string, any> | null): boolean {
  if (!ref) return false;
  return !!(
    ref.ctwaClid ||
    ref.sourceType === 'ad' ||
    ref.showAdAttribution === true ||
    ref.conversionSource === 'FB_Ads' ||
    ref.ctwaPayload ||
    // If it has sourceId but NO utm fields → it's CTWA
    (ref.sourceId && !ref.utm_source && !ref.utm_campaign)
  );
}

/** Detect if referral_data comes from a redirect landing page (UTM-based) */
function isRedirectReferral(ref: Record<string, any> | null): boolean {
  if (!ref) return false;
  return !!(ref.utm_source || ref.utm_campaign || ref.utm_medium);
}

// =====================================================
// Hook: useWhatsAppLeadTracking
// =====================================================

export function useWhatsAppLeadTracking(filters: WhatsAppLeadTrackingFilters) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ['whatsapp-lead-tracking', tenantId, filters.dateFrom, filters.dateTo, filters.sourceType, filters.metaAccountId],
    queryFn: async (): Promise<{
      leads: TrackedLead[];
      summary: LeadTrackingSummary;
      creativeBreakdown: CreativeBreakdown[];
    }> => {
      if (!tenantId) return { leads: [], summary: emptySummary(), creativeBreakdown: [] };

      // All origins that can come from campaign traffic
      const campaignOrigins = ['meta_ads', 'ctwa_ad', 'redirect', 'linktree', 'site', 'google_ads', 'referral'];

      // 1. Single query: all contacts from campaign origins in the date range
      const contactsQuery = supabase
        .from('contacts')
        .select('id, full_name, phone, email, origin, origin_campaign, lead_status, created_at, assigned_to, referral_data, profiles:assigned_to(full_name)')
        .eq('tenant_id', tenantId)
        .in('origin', campaignOrigins)
        .gte('created_at', filters.dateFrom)
        .lte('created_at', filters.dateTo + 'T23:59:59')
        .order('created_at', { ascending: false });

      // 2. Fetch meta_ads with adsets and campaigns for cross-referencing
      const metaAdsQuery = supabase
        .from('meta_ads')
        .select(`
          id, ad_id, name, status, creative_id,
          adset:meta_adsets(id, adset_id, name),
          campaign:meta_campaigns(id, campaign_id, name, meta_account_id)
        `)
        .eq('tenant_id', tenantId);

      // Execute in parallel
      const [contactsResult, metaAdsResult] = await Promise.all([
        contactsQuery,
        metaAdsQuery,
      ]);

      if (contactsResult.error) throw contactsResult.error;
      if (metaAdsResult.error) throw metaAdsResult.error;

      const allContacts = contactsResult.data || [];
      const metaAds = metaAdsResult.data || [];

      // Build lookup maps for meta_ads
      const adByAdId = new Map<string, typeof metaAds[0]>();
      const adByCreativeId = new Map<string, typeof metaAds[0]>();
      const adByName = new Map<string, typeof metaAds[0]>();

      // If filtering by account, only use ads from that account
      const adsToIndex = filters.metaAccountId
        ? metaAds.filter(ad => (ad.campaign as any)?.meta_account_id === filters.metaAccountId)
        : metaAds;

      adsToIndex.forEach(ad => {
        if (ad.ad_id) adByAdId.set(ad.ad_id, ad);
        if (ad.creative_id) adByCreativeId.set(ad.creative_id, ad);
        if (ad.name) adByName.set(ad.name.toLowerCase(), ad);
      });

      // Classify and process each contact
      const ctwaLeads: TrackedLead[] = [];
      const redirectLeads: TrackedLead[] = [];

      for (const contact of allContacts) {
        const refData = contact.referral_data as Record<string, any> | null;
        const assignedProfile = contact.profiles as any;

        const isCTWA = isCTWAReferral(refData) ||
          // Fallback: origin is meta_ads/ctwa_ad and no UTM fields → treat as CTWA
          (['meta_ads', 'ctwa_ad'].includes(contact.origin || '') && !isRedirectReferral(refData));

        const isRedirect = isRedirectReferral(refData);

        if (isCTWA) {
          // --- CTWA Lead: cross-reference with meta_ads ---
          const matched = matchCreative(refData, adByAdId, adByCreativeId, adByName);

          const adsetData = matched?.adset as any;
          const campaignData = matched?.campaign as any;

          ctwaLeads.push({
            id: contact.id,
            full_name: contact.full_name,
            phone: contact.phone,
            email: contact.email,
            origin: contact.origin || 'meta_ads',
            origin_campaign: contact.origin_campaign,
            lead_status: contact.lead_status,
            created_at: contact.created_at,
            assigned_to: contact.assigned_to,
            assigned_to_name: assignedProfile?.full_name || null,
            referral_data: refData,
            ad_name: matched?.name || refData?.adName || null,
            adset_name: adsetData?.name || null,
            campaign_name: campaignData?.name || refData?.campaignName || null,
            creative_name: matched?.name || refData?.adName || refData?.headline || null,
            source_type: 'ctwa',
            creative_matched: !!matched,
          });
        } else if (isRedirect) {
          // --- Redirect Lead: use UTM data ---
          const creativeName = refData?.utm_content || refData?.utm_campaign || null;
          const campaignName = refData?.utm_campaign || null;

          redirectLeads.push({
            id: contact.id,
            full_name: contact.full_name,
            phone: contact.phone,
            email: contact.email,
            origin: contact.origin || 'redirect',
            origin_campaign: contact.origin_campaign,
            lead_status: contact.lead_status,
            created_at: contact.created_at,
            assigned_to: contact.assigned_to,
            assigned_to_name: assignedProfile?.full_name || null,
            referral_data: refData,
            ad_name: null,
            adset_name: null,
            campaign_name: campaignName,
            creative_name: creativeName,
            source_type: 'redirect',
            creative_matched: !!creativeName,
          });
        } else {
          // Ambiguous: origin suggests campaign but no clear referral data
          // Default to CTWA if origin is meta_ads/ctwa_ad, otherwise redirect
          if (['meta_ads', 'ctwa_ad'].includes(contact.origin || '')) {
            ctwaLeads.push({
              id: contact.id,
              full_name: contact.full_name,
              phone: contact.phone,
              email: contact.email,
              origin: contact.origin || 'meta_ads',
              origin_campaign: contact.origin_campaign,
              lead_status: contact.lead_status,
              created_at: contact.created_at,
              assigned_to: contact.assigned_to,
              assigned_to_name: assignedProfile?.full_name || null,
              referral_data: refData,
              ad_name: null,
              adset_name: null,
              campaign_name: refData?.campaignName || contact.origin_campaign || null,
              creative_name: refData?.adName || refData?.headline || null,
              source_type: 'ctwa',
              creative_matched: false,
            });
          } else {
            redirectLeads.push({
              id: contact.id,
              full_name: contact.full_name,
              phone: contact.phone,
              email: contact.email,
              origin: contact.origin || 'redirect',
              origin_campaign: contact.origin_campaign,
              lead_status: contact.lead_status,
              created_at: contact.created_at,
              assigned_to: contact.assigned_to,
              assigned_to_name: assignedProfile?.full_name || null,
              referral_data: refData,
              ad_name: null,
              adset_name: null,
              campaign_name: contact.origin_campaign || null,
              creative_name: null,
              source_type: 'redirect',
              creative_matched: false,
            });
          }
        }
      }

      // Apply source type filter
      let leads: TrackedLead[];
      if (filters.sourceType === 'ctwa') {
        leads = ctwaLeads;
      } else if (filters.sourceType === 'redirect') {
        leads = redirectLeads;
      } else {
        leads = [...ctwaLeads, ...redirectLeads];
      }

      // Sort by created_at desc
      leads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Build summary (always based on totals, not filtered)
      const summary: LeadTrackingSummary = {
        totalLeads: ctwaLeads.length + redirectLeads.length,
        ctwaLeads: ctwaLeads.length,
        redirectLeads: redirectLeads.length,
        matchedCreatives: [...ctwaLeads, ...redirectLeads].filter(l => l.creative_matched).length,
        unmatchedCreatives: [...ctwaLeads, ...redirectLeads].filter(l => !l.creative_matched).length,
      };

      // Build creative breakdown from filtered leads
      const creativeMap = new Map<string, CreativeBreakdown>();

      leads.forEach(lead => {
        const key = lead.creative_name || '(Sem criativo)';
        const existing = creativeMap.get(key);

        if (existing) {
          existing.lead_count += 1;
          if (existing.source_type !== lead.source_type) {
            existing.source_type = 'mixed';
          }
        } else {
          creativeMap.set(key, {
            creative_name: key,
            adset_name: lead.adset_name,
            campaign_name: lead.campaign_name,
            lead_count: 1,
            source_type: lead.source_type,
          });
        }
      });

      const creativeBreakdown = Array.from(creativeMap.values())
        .sort((a, b) => b.lead_count - a.lead_count);

      return { leads, summary, creativeBreakdown };
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });
}

// =====================================================
// Creative matching
// =====================================================

function matchCreative(
  refData: Record<string, any> | null,
  adByAdId: Map<string, any>,
  adByCreativeId: Map<string, any>,
  adByName: Map<string, any>,
): any | undefined {
  if (!refData) return undefined;

  // Strategy 1: Match sourceId against ad_id
  if (refData.sourceId) {
    const match = adByAdId.get(String(refData.sourceId));
    if (match) return match;

    // Also try sourceId against creative_id
    const creativeMatch = adByCreativeId.get(String(refData.sourceId));
    if (creativeMatch) return creativeMatch;
  }

  // Strategy 2: Match by adName (exact, case-insensitive)
  if (refData.adName) {
    const match = adByName.get(refData.adName.toLowerCase());
    if (match) return match;
  }

  // Strategy 3: Match by headline against ad name
  if (refData.headline) {
    const match = adByName.get(refData.headline.toLowerCase());
    if (match) return match;
  }

  // Strategy 4: Extract ad_id from sourceUrl
  if (refData.sourceUrl) {
    const urlAdId = extractAdIdFromUrl(refData.sourceUrl);
    if (urlAdId) {
      const match = adByAdId.get(urlAdId);
      if (match) return match;
    }
  }

  // Strategy 5: Match ctwaClid against creative_id (some providers use this)
  if (refData.ctwaClid) {
    const match = adByCreativeId.get(String(refData.ctwaClid));
    if (match) return match;
  }

  return undefined;
}

// =====================================================
// Helpers
// =====================================================

function emptySummary(): LeadTrackingSummary {
  return {
    totalLeads: 0,
    ctwaLeads: 0,
    redirectLeads: 0,
    matchedCreatives: 0,
    unmatchedCreatives: 0,
  };
}

function extractAdIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    // Common Facebook ad URL patterns
    const id = urlObj.searchParams.get('id') ||
      urlObj.searchParams.get('fbid') ||
      urlObj.searchParams.get('ad_id');
    if (id) return id;

    // Try to extract numeric ID from path segments
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);
    for (const segment of pathSegments) {
      // Meta ad IDs are long numeric strings (15+ digits)
      if (/^\d{10,}$/.test(segment)) {
        return segment;
      }
    }
    return null;
  } catch {
    return null;
  }
}
