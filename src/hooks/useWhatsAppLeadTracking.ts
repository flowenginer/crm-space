import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentTenantId } from '@/hooks/useTenant';

// =====================================================
// Types
// =====================================================

export interface TrackedLead {
  id: string;
  conversation_id: string;
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
// Normalize referral_data fields (snake_case + camelCase)
// =====================================================

interface NormalizedReferral {
  sourceId: string | null;
  sourceType: string | null;
  sourceUrl: string | null;
  ctwaClid: string | null;
  headline: string | null;
  adName: string | null;
  body: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  mediaType: string | null;
  showAdAttribution: boolean | null;
  conversionSource: string | null;
  sourceApp: string | null;
  // UTM fields (redirect)
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  // Pattern detection
  detectedBy: string | null;
}

function normalizeReferralFields(ref: Record<string, any> | null): NormalizedReferral | null {
  if (!ref) return null;
  return {
    sourceId: ref.sourceId || ref.source_id || null,
    sourceType: ref.sourceType || ref.source_type || null,
    sourceUrl: ref.sourceUrl || ref.source_url || null,
    ctwaClid: ref.ctwaClid || ref.ctwa_clid || null,
    headline: ref.headline || null,
    adName: ref.adName || null,
    body: ref.body || ref.greetingMessageBody || null,
    imageUrl: ref.imageUrl || ref.image_url || null,
    videoUrl: ref.videoUrl || ref.video_url || null,
    thumbnailUrl: ref.thumbnailUrl || ref.thumbnail_url || null,
    mediaType: ref.mediaType || ref.media_type || null,
    showAdAttribution: ref.showAdAttribution ?? ref.show_ad_attribution ?? null,
    conversionSource: ref.conversionSource || ref.conversion_source || null,
    sourceApp: ref.sourceApp || ref.source_app || null,
    utmSource: ref.utm_source || null,
    utmMedium: ref.utm_medium || null,
    utmCampaign: ref.utm_campaign || null,
    utmContent: ref.utm_content || null,
    utmTerm: ref.utm_term || null,
    detectedBy: ref.detected_by || null,
  };
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

      // Source of truth: conversations table (both webhooks always write here)
      const referralSources = ['meta_ads', 'ctwa_ad', 'redirect', 'linktree'];

      // 1. Query conversations with contact data joined
      const conversationsQuery = supabase
        .from('conversations')
        .select(`
          id, referral_source, referral_data, created_at, lead_status,
          contact:contacts!contact_id(
            id, full_name, phone, email, lead_status, origin, origin_campaign,
            assigned_to, profiles:assigned_to(full_name)
          )
        `)
        .eq('tenant_id', tenantId)
        .in('referral_source', referralSources)
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
      const [conversationsResult, metaAdsResult] = await Promise.all([
        conversationsQuery,
        metaAdsQuery,
      ]);

      if (conversationsResult.error) throw conversationsResult.error;
      if (metaAdsResult.error) throw metaAdsResult.error;

      const allConversations = conversationsResult.data || [];
      const metaAds = metaAdsResult.data || [];

      // Build lookup maps for meta_ads
      const adByAdId = new Map<string, typeof metaAds[0]>();
      const adByCreativeId = new Map<string, typeof metaAds[0]>();
      const adByName = new Map<string, typeof metaAds[0]>();

      const adsToIndex = filters.metaAccountId
        ? metaAds.filter(ad => (ad.campaign as any)?.meta_account_id === filters.metaAccountId)
        : metaAds;

      adsToIndex.forEach(ad => {
        if (ad.ad_id) adByAdId.set(ad.ad_id, ad);
        if (ad.creative_id) adByCreativeId.set(ad.creative_id, ad);
        if (ad.name) adByName.set(ad.name.toLowerCase(), ad);
      });

      // Deduplicate: keep only most recent conversation per contact
      const latestByContact = new Map<string, typeof allConversations[0]>();
      for (const conv of allConversations) {
        const contactId = (conv.contact as any)?.id;
        if (!contactId) continue;
        const existing = latestByContact.get(contactId);
        if (!existing || new Date(conv.created_at) > new Date(existing.created_at)) {
          latestByContact.set(contactId, conv);
        }
      }

      // Process each unique lead
      const ctwaLeads: TrackedLead[] = [];
      const redirectLeads: TrackedLead[] = [];

      for (const conv of latestByContact.values()) {
        const contact = conv.contact as any;
        if (!contact) continue;

        const rawRef = conv.referral_data as Record<string, any> | null;
        const norm = normalizeReferralFields(rawRef);

        // Skip pattern-detected leads (not real ad referrals)
        if (norm?.detectedBy) continue;

        const assignedProfile = contact.profiles as any;
        const referralSource = conv.referral_source;
        const leadStatus = (conv as any).lead_status || contact.lead_status;

        const isCTWA = referralSource === 'meta_ads' || referralSource === 'ctwa_ad';
        const isRedirect = referralSource === 'redirect' || referralSource === 'linktree';

        if (isCTWA) {
          // --- CTWA Lead ---
          const matched = matchCreativeCTWA(norm, adByAdId, adByCreativeId, adByName);
          const adsetData = matched?.adset as any;
          const campaignData = matched?.campaign as any;

          ctwaLeads.push({
            id: contact.id,
            conversation_id: conv.id,
            full_name: contact.full_name,
            phone: contact.phone,
            email: contact.email,
            origin: contact.origin || referralSource || 'meta_ads',
            origin_campaign: contact.origin_campaign,
            lead_status: leadStatus,
            created_at: conv.created_at,
            assigned_to: contact.assigned_to,
            assigned_to_name: assignedProfile?.full_name || null,
            referral_data: rawRef,
            ad_name: matched?.name || norm?.adName || null,
            adset_name: adsetData?.name || null,
            campaign_name: campaignData?.name || norm?.adName || null,
            creative_name: matched?.name || norm?.adName || norm?.headline || null,
            source_type: 'ctwa',
            creative_matched: !!matched,
          });
        } else if (isRedirect) {
          // --- Redirect Lead ---
          // utm_term has the ad_id, utm_content has creative name, utm_medium has adset name
          const matched = matchCreativeRedirect(norm, adByAdId);
          const adsetData = matched?.adset as any;
          const campaignData = matched?.campaign as any;

          // Redirect already carries creative and adset names in UTMs
          const creativeName = norm?.utmContent || matched?.name || null;
          const adsetName = norm?.utmMedium || adsetData?.name || null;
          const campaignName = campaignData?.name || norm?.utmCampaign || null;

          redirectLeads.push({
            id: contact.id,
            conversation_id: conv.id,
            full_name: contact.full_name,
            phone: contact.phone,
            email: contact.email,
            origin: contact.origin || referralSource || 'redirect',
            origin_campaign: contact.origin_campaign,
            lead_status: leadStatus,
            created_at: conv.created_at,
            assigned_to: contact.assigned_to,
            assigned_to_name: assignedProfile?.full_name || null,
            referral_data: rawRef,
            ad_name: matched?.name || null,
            adset_name: adsetName,
            campaign_name: campaignName,
            creative_name: creativeName,
            source_type: 'redirect',
            creative_matched: !!(creativeName || matched),
          });
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
      const allLeads = [...ctwaLeads, ...redirectLeads];
      const summary: LeadTrackingSummary = {
        totalLeads: allLeads.length,
        ctwaLeads: ctwaLeads.length,
        redirectLeads: redirectLeads.length,
        matchedCreatives: allLeads.filter(l => l.creative_matched).length,
        unmatchedCreatives: allLeads.filter(l => !l.creative_matched).length,
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
// Creative matching - CTWA
// =====================================================

function matchCreativeCTWA(
  norm: NormalizedReferral | null,
  adByAdId: Map<string, any>,
  adByCreativeId: Map<string, any>,
  adByName: Map<string, any>,
): any | undefined {
  if (!norm) return undefined;

  // Strategy 1: sourceId (ad_id from referral) → meta_ads.ad_id
  if (norm.sourceId) {
    const id = String(norm.sourceId);
    const match = adByAdId.get(id);
    if (match) return match;

    // Also try against creative_id
    const creativeMatch = adByCreativeId.get(id);
    if (creativeMatch) return creativeMatch;
  }

  // Strategy 2: adName → meta_ads.name (case-insensitive)
  if (norm.adName) {
    const match = adByName.get(norm.adName.toLowerCase());
    if (match) return match;
  }

  // Strategy 3: headline → meta_ads.name
  if (norm.headline) {
    const match = adByName.get(norm.headline.toLowerCase());
    if (match) return match;
  }

  // Strategy 4: Extract numeric ID from sourceUrl path
  if (norm.sourceUrl) {
    const urlAdId = extractAdIdFromUrl(norm.sourceUrl);
    if (urlAdId) {
      const match = adByAdId.get(urlAdId);
      if (match) return match;
    }
  }

  return undefined;
}

// =====================================================
// Creative matching - Redirect
// =====================================================

function matchCreativeRedirect(
  norm: NormalizedReferral | null,
  adByAdId: Map<string, any>,
): any | undefined {
  if (!norm) return undefined;

  // utm_term contains the ad_id for redirect leads from Meta Ads
  if (norm.utmTerm) {
    const match = adByAdId.get(String(norm.utmTerm));
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
    const id = urlObj.searchParams.get('id') ||
      urlObj.searchParams.get('fbid') ||
      urlObj.searchParams.get('ad_id');
    if (id) return id;

    // Try to extract numeric ID from path segments (Meta ad IDs are 15+ digits)
    const pathSegments = urlObj.pathname.split('/').filter(Boolean);
    for (const segment of pathSegments) {
      if (/^\d{10,}$/.test(segment)) {
        return segment;
      }
    }
    return null;
  } catch {
    return null;
  }
}
