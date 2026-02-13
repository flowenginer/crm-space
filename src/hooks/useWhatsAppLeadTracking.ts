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
  source_type: 'ctwa' | 'redirect' | 'linktree' | 'whatsapp' | 'manual';
  creative_matched: boolean;
  segment_name: string | null;
  has_conversion: boolean;
  conversion_total: number;
}

export interface LeadTrackingSummary {
  totalLeads: number;
  ctwaLeads: number;
  redirectLeads: number;
  linktreeLeads: number;
  whatsappLeads: number;
  manualLeads: number;
  matchedCreatives: number;
  unmatchedCreatives: number;
}

export interface CreativeBreakdown {
  creative_name: string;
  adset_name: string | null;
  campaign_name: string | null;
  lead_count: number;
  source_type: 'ctwa' | 'redirect' | 'linktree' | 'whatsapp' | 'manual' | 'mixed';
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

      // 1. Query conversations with contact data joined (limited to prevent overload)
      const conversationsQuery = supabase
        .from('conversations')
        .select(`
          id, referral_source, referral_data, created_at, lead_status,
          contact:contacts!contact_id(
            id, full_name, phone, email, lead_status, origin, origin_campaign,
            assigned_to, custom_fields, profiles:assigned_to(full_name),
            segment:segments!segment_id(name)
          )
        `)
        .eq('tenant_id', tenantId)
        .in('referral_source', referralSources)
        .gte('created_at', filters.dateFrom)
        .lte('created_at', filters.dateTo + 'T23:59:59')
        .order('created_at', { ascending: false })
        .limit(5000);

      // 2. Fetch meta_ads with adsets and campaigns for cross-referencing
      const metaAdsQuery = supabase
        .from('meta_ads')
        .select(`
          id, ad_id, name, status, creative_id,
          adset:meta_adsets(id, adset_id, name),
          campaign:meta_campaigns(id, campaign_id, name, meta_account_id)
        `)
        .eq('tenant_id', tenantId)
        .limit(2000);

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

      // Group ALL conversations by contact (instead of keeping only the most recent)
      const convsByContact = new Map<string, typeof allConversations>();
      for (const conv of allConversations) {
        const contactId = (conv.contact as any)?.id;
        if (!contactId) continue;
        const arr = convsByContact.get(contactId) || [];
        arr.push(conv);
        convsByContact.set(contactId, arr);
      }

      // Process each unique lead
      const ctwaLeads: TrackedLead[] = [];
      const redirectLeads: TrackedLead[] = [];
      const linktreeLeads: TrackedLead[] = [];

      for (const contactConvs of convsByContact.values()) {
        // Sort by created_at DESC so [0] is the most recent
        contactConvs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Find conversation with tracking data (referral_source filled)
        const trackedConv = contactConvs.find(c => c.referral_source) || contactConvs[0];
        // Most recent conversation for operational data
        const recentConv = contactConvs[0];

        const contact = recentConv.contact as any;
        if (!contact) continue;

        // Use tracking data from the tracked conversation
        const rawRef = trackedConv.referral_data as Record<string, any> | null;
        const norm = normalizeReferralFields(rawRef);

        // Skip pattern-detected leads (not real ad referrals)
        if (norm?.detectedBy) continue;

        const assignedProfile = contact.profiles as any;
        const segmentData = contact.segment as any;
        // Referral source from tracked conv, operational data from recent conv
        const referralSource = trackedConv.referral_source;
        const leadStatus = (recentConv as any).lead_status || contact.lead_status;

        const isCTWA = referralSource === 'meta_ads' || referralSource === 'ctwa_ad';
        const isLinktree = referralSource === 'linktree';
        const isRedirect = referralSource === 'redirect';

        const buildLead = (sourceType: 'ctwa' | 'redirect' | 'linktree', extras: Partial<TrackedLead> = {}): TrackedLead => ({
          id: contact.id,
          conversation_id: recentConv.id,
          full_name: contact.full_name,
          phone: contact.phone,
          email: contact.email,
          origin: contact.origin || referralSource || sourceType,
          origin_campaign: contact.origin_campaign,
          lead_status: leadStatus,
          created_at: recentConv.created_at,
          assigned_to: contact.assigned_to,
          assigned_to_name: assignedProfile?.full_name || null,
          referral_data: rawRef,
          ad_name: null,
          adset_name: null,
          campaign_name: null,
          creative_name: null,
          source_type: sourceType,
          creative_matched: false,
          segment_name: segmentData?.name || null,
          has_conversion: Array.isArray((contact.custom_fields as any)?.conversoes) && (contact.custom_fields as any).conversoes.length > 0,
          conversion_total: Array.isArray((contact.custom_fields as any)?.conversoes)
            ? (contact.custom_fields as any).conversoes.reduce((sum: number, c: any) => sum + (parseFloat(c.total) || 0), 0)
            : 0,
          ...extras,
        });

        if (isCTWA) {
          const matched = matchCreativeCTWA(norm, adByAdId, adByCreativeId, adByName);
          const adsetData = matched?.adset as any;
          const campaignData = matched?.campaign as any;
          ctwaLeads.push(buildLead('ctwa', {
            ad_name: matched?.name || norm?.adName || null,
            adset_name: adsetData?.name || null,
            campaign_name: campaignData?.name || norm?.adName || null,
            creative_name: matched?.name || norm?.adName || norm?.headline || null,
            creative_matched: !!matched,
          }));
        } else if (isLinktree) {
          linktreeLeads.push(buildLead('linktree'));
        } else if (isRedirect) {
          const matched = matchCreativeRedirect(norm, adByAdId);
          const adsetData = matched?.adset as any;
          const campaignData = matched?.campaign as any;
          const creativeName = norm?.utmContent || matched?.name || null;
          const adsetName = norm?.utmMedium || adsetData?.name || null;
          const campaignName = campaignData?.name || norm?.utmCampaign || null;
          redirectLeads.push(buildLead('redirect', {
            ad_name: matched?.name || null,
            adset_name: adsetName,
            campaign_name: campaignName,
            creative_name: creativeName,
            creative_matched: !!(creativeName || matched),
          }));
        }
      }

      // Query WhatsApp organic leads (origin = 'whatsapp', no referral_source)
      const whatsappQuery = supabase
        .from('conversations')
        .select(`
          id, referral_source, created_at, lead_status,
          contact:contacts!contact_id(
            id, full_name, phone, email, lead_status, origin, origin_campaign,
            assigned_to, custom_fields, profiles:assigned_to(full_name),
            segment:segments!segment_id(name)
          )
        `)
        .eq('tenant_id', tenantId)
        .is('referral_source', null)
        .gte('created_at', filters.dateFrom)
        .lte('created_at', filters.dateTo + 'T23:59:59')
        .order('created_at', { ascending: false });

      const whatsappResult = await whatsappQuery;
      if (whatsappResult.error) throw whatsappResult.error;

      // Separate organic leads by contact.origin
      const whatsappLeads: TrackedLead[] = [];
      const manualLeads: TrackedLead[] = [];
      const seenOrganicContacts = new Set<string>();
      // Exclude contacts already tracked via referral sources
      const trackedContactIds = new Set([
        ...ctwaLeads.map(l => l.id),
        ...redirectLeads.map(l => l.id),
        ...linktreeLeads.map(l => l.id),
      ]);

      for (const conv of (whatsappResult.data || [])) {
        const contact = conv.contact as any;
        if (!contact) continue;
        const validOrigins = ['whatsapp', 'linktree', 'manual'];
        if (!validOrigins.includes(contact.origin)) continue;
        if (seenOrganicContacts.has(contact.id)) continue;
        if (trackedContactIds.has(contact.id)) continue;
        seenOrganicContacts.add(contact.id);

        const assignedProfile = contact.profiles as any;
        const segmentData = contact.segment as any;
        const leadStatus = (conv as any).lead_status || contact.lead_status;

        const sourceType: 'linktree' | 'whatsapp' | 'manual' =
          contact.origin === 'linktree' ? 'linktree' :
          contact.origin === 'manual' ? 'manual' : 'whatsapp';

        const lead: TrackedLead = {
          id: contact.id,
          conversation_id: conv.id,
          full_name: contact.full_name,
          phone: contact.phone,
          email: contact.email,
          origin: contact.origin || 'whatsapp',
          origin_campaign: contact.origin_campaign,
          lead_status: leadStatus,
          created_at: conv.created_at,
          assigned_to: contact.assigned_to,
          assigned_to_name: assignedProfile?.full_name || null,
          referral_data: null,
          ad_name: null,
          adset_name: null,
          campaign_name: null,
          creative_name: null,
          source_type: sourceType,
          creative_matched: false,
          segment_name: segmentData?.name || null,
          has_conversion: Array.isArray((contact.custom_fields as any)?.conversoes) && (contact.custom_fields as any).conversoes.length > 0,
          conversion_total: Array.isArray((contact.custom_fields as any)?.conversoes)
            ? (contact.custom_fields as any).conversoes.reduce((sum: number, c: any) => sum + (parseFloat(c.total) || 0), 0)
            : 0,
        };

        if (sourceType === 'linktree') {
          linktreeLeads.push(lead);
        } else if (sourceType === 'manual') {
          manualLeads.push(lead);
        } else {
          whatsappLeads.push(lead);
        }
      }

      // =====================================================
      // Complementary query: contacts with conversions in the period
      // whose conversations may have been created outside the date range
      // =====================================================
      const allProcessedContactIds = new Set([
        ...ctwaLeads.map(l => l.id),
        ...redirectLeads.map(l => l.id),
        ...linktreeLeads.map(l => l.id),
        ...whatsappLeads.map(l => l.id),
        ...manualLeads.map(l => l.id),
      ]);

      const dateFromTime = new Date(filters.dateFrom).getTime();
      const dateToTime = new Date(filters.dateTo + 'T23:59:59').getTime();

      // Helper to filter conversions within the selected period
      const getConversionsInPeriod = (customFields: any): any[] => {
        if (!customFields || !Array.isArray(customFields.conversoes)) return [];
        return customFields.conversoes.filter((c: any) => {
          if (!c.data) return false;
          const convDate = new Date(c.data).getTime();
          return convDate >= dateFromTime && convDate <= dateToTime;
        });
      };

      // Fetch contacts that have custom_fields with conversions
      const { data: contactsWithConversions } = await supabase
        .from('contacts')
        .select(`
          id, full_name, phone, email, lead_status, origin, origin_campaign,
          assigned_to, custom_fields, profiles:assigned_to(full_name),
          segment:segments!segment_id(name)
        `)
        .eq('tenant_id', tenantId)
        .not('custom_fields', 'is', null);

      const conversionLeads: TrackedLead[] = [];

      if (contactsWithConversions) {
        // Filter contacts with conversions in the period that aren't already tracked
        const contactsToProcess = contactsWithConversions.filter(contact => {
          if (allProcessedContactIds.has(contact.id)) return false;
          const conversionsInPeriod = getConversionsInPeriod(contact.custom_fields);
          return conversionsInPeriod.length > 0;
        });

        if (contactsToProcess.length > 0) {
          // Fetch conversations for these contacts to get tracking data
          const contactIds = contactsToProcess.map(c => c.id);
          const { data: convData } = await supabase
            .from('conversations')
            .select('id, referral_source, referral_data, created_at, lead_status, contact_id')
            .eq('tenant_id', tenantId)
            .in('contact_id', contactIds)
            .order('created_at', { ascending: false });

          const convByContact = new Map<string, typeof convData>();
          for (const conv of (convData || [])) {
            const arr = convByContact.get(conv.contact_id) || [];
            arr.push(conv);
            convByContact.set(conv.contact_id, arr);
          }

          for (const contact of contactsToProcess) {
            const contactConvs = convByContact.get(contact.id) || [];
            const trackedConv = contactConvs.find(c => c.referral_source) || contactConvs[0];
            const recentConv = contactConvs[0];

            const rawRef = trackedConv?.referral_data as Record<string, any> | null;
            const norm = normalizeReferralFields(rawRef);
            if (norm?.detectedBy) continue;

            const assignedProfile = (contact as any).profiles as any;
            const segmentData = (contact as any).segment as any;
            const leadStatus = recentConv?.lead_status || contact.lead_status;
            const referralSource = trackedConv?.referral_source;

            const conversionsInPeriod = getConversionsInPeriod(contact.custom_fields);
            const conversionTotal = conversionsInPeriod.reduce((sum: number, c: any) => sum + (parseFloat(c.total) || 0), 0);

            // Determine source type
            let sourceType: TrackedLead['source_type'] = 'whatsapp';
            if (referralSource === 'meta_ads' || referralSource === 'ctwa_ad') sourceType = 'ctwa';
            else if (referralSource === 'redirect') sourceType = 'redirect';
            else if (referralSource === 'linktree' || contact.origin === 'linktree') sourceType = 'linktree';
            else if (contact.origin === 'manual') sourceType = 'manual';

            // Match creative if CTWA or redirect
            let adName: string | null = null;
            let adsetName: string | null = null;
            let campaignName: string | null = null;
            let creativeName: string | null = null;
            let creativeMatched = false;

            if (sourceType === 'ctwa' && norm) {
              const matched = matchCreativeCTWA(norm, adByAdId, adByCreativeId, adByName);
              const adsetData = matched?.adset as any;
              const campaignData = matched?.campaign as any;
              adName = matched?.name || norm.adName || null;
              adsetName = adsetData?.name || null;
              campaignName = campaignData?.name || norm.adName || null;
              creativeName = matched?.name || norm.adName || norm.headline || null;
              creativeMatched = !!matched;
            } else if (sourceType === 'redirect' && norm) {
              const matched = matchCreativeRedirect(norm, adByAdId);
              const adsetData = matched?.adset as any;
              const campaignData = matched?.campaign as any;
              creativeName = norm.utmContent || matched?.name || null;
              adsetName = norm.utmMedium || adsetData?.name || null;
              campaignName = campaignData?.name || norm.utmCampaign || null;
              adName = matched?.name || null;
              creativeMatched = !!(creativeName || matched);
            }

            const lead: TrackedLead = {
              id: contact.id,
              conversation_id: recentConv?.id || '',
              full_name: contact.full_name,
              phone: contact.phone,
              email: contact.email,
              origin: contact.origin || referralSource || sourceType,
              origin_campaign: contact.origin_campaign,
              lead_status: leadStatus,
              created_at: recentConv?.created_at || '',
              assigned_to: contact.assigned_to,
              assigned_to_name: assignedProfile?.full_name || null,
              referral_data: rawRef,
              ad_name: adName,
              adset_name: adsetName,
              campaign_name: campaignName,
              creative_name: creativeName,
              source_type: sourceType,
              creative_matched: creativeMatched,
              segment_name: segmentData?.name || null,
              has_conversion: true,
              conversion_total: conversionTotal,
            };

            conversionLeads.push(lead);

            // Add to respective source arrays for summary counts
            if (sourceType === 'ctwa') ctwaLeads.push(lead);
            else if (sourceType === 'redirect') redirectLeads.push(lead);
            else if (sourceType === 'linktree') linktreeLeads.push(lead);
            else if (sourceType === 'manual') manualLeads.push(lead);
            else whatsappLeads.push(lead);
          }
        }
      }

      // Recalculate conversion_total for ALL leads to only count conversions in the period
      const allLeadArrays = [ctwaLeads, redirectLeads, linktreeLeads, whatsappLeads, manualLeads];
      for (const arr of allLeadArrays) {
        for (const lead of arr) {
          // Skip leads that were just added from conversionLeads (already calculated correctly)
          if (conversionLeads.includes(lead)) continue;
          // Find original contact's custom_fields from the conversation data
          const contactConvs = convsByContact.get(lead.id);
          if (contactConvs && contactConvs.length > 0) {
            const contact = (contactConvs[0].contact as any);
            if (contact?.custom_fields) {
              const inPeriod = getConversionsInPeriod(contact.custom_fields);
              lead.has_conversion = inPeriod.length > 0;
              lead.conversion_total = inPeriod.reduce((sum: number, c: any) => sum + (parseFloat(c.total) || 0), 0);
            }
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
        leads = [...ctwaLeads, ...redirectLeads, ...linktreeLeads, ...whatsappLeads, ...manualLeads];
      }

      // Sort by created_at desc
      leads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Build summary (always based on totals, not filtered)
      const allLeads = [...ctwaLeads, ...redirectLeads, ...linktreeLeads, ...whatsappLeads, ...manualLeads];
      const summary: LeadTrackingSummary = {
        totalLeads: allLeads.length,
        ctwaLeads: ctwaLeads.length,
        redirectLeads: redirectLeads.length,
        linktreeLeads: linktreeLeads.length,
        whatsappLeads: whatsappLeads.length,
        manualLeads: manualLeads.length,
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
    linktreeLeads: 0,
    whatsappLeads: 0,
    manualLeads: 0,
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
