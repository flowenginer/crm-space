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
  // Referral info
  referral_data: Record<string, any> | null;
  // Cross-referenced Meta Ads data
  ad_name: string | null;
  adset_name: string | null;
  campaign_name: string | null;
  creative_name: string | null;
  // Source type: 'ctwa' | 'redirect'
  source_type: 'ctwa' | 'redirect';
  // Whether creative was matched
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

      // 1. Fetch CTWA leads (origin = 'meta_ads')
      let ctwaQuery = supabase
        .from('contacts')
        .select('id, full_name, phone, email, origin, origin_campaign, lead_status, created_at, assigned_to, referral_data, profiles:assigned_to(full_name)')
        .eq('tenant_id', tenantId)
        .eq('origin', 'meta_ads')
        .gte('created_at', filters.dateFrom)
        .lte('created_at', filters.dateTo + 'T23:59:59')
        .order('created_at', { ascending: false });

      // 2. Fetch redirect leads
      let redirectQuery = supabase
        .from('contacts')
        .select('id, full_name, phone, email, origin, origin_campaign, lead_status, created_at, assigned_to, referral_data, profiles:assigned_to(full_name)')
        .eq('tenant_id', tenantId)
        .in('origin', ['redirect', 'linktree', 'site'])
        .gte('created_at', filters.dateFrom)
        .lte('created_at', filters.dateTo + 'T23:59:59')
        .order('created_at', { ascending: false });

      // 3. Fetch meta_ads with adsets and campaigns
      let metaAdsQuery = supabase
        .from('meta_ads')
        .select(`
          id, ad_id, name, status, creative_id,
          adset:meta_adsets(id, adset_id, name),
          campaign:meta_campaigns(id, campaign_id, name, meta_account_id)
        `)
        .eq('tenant_id', tenantId);

      // Execute all queries in parallel
      const [ctwaResult, redirectResult, metaAdsResult] = await Promise.all([
        ctwaQuery,
        redirectQuery,
        metaAdsQuery
      ]);

      if (ctwaResult.error) throw ctwaResult.error;
      if (redirectResult.error) throw redirectResult.error;
      if (metaAdsResult.error) throw metaAdsResult.error;

      const ctwaContacts = ctwaResult.data || [];
      const redirectContacts = redirectResult.data || [];
      const metaAds = metaAdsResult.data || [];

      // Build lookup maps for meta_ads
      // Map by ad_id (the Meta Ads numeric ID)
      const adByAdId = new Map<string, typeof metaAds[0]>();
      // Map by name (for fallback matching)
      const adByName = new Map<string, typeof metaAds[0]>();

      metaAds.forEach(ad => {
        adByAdId.set(ad.ad_id, ad);
        if (ad.name) {
          adByName.set(ad.name.toLowerCase(), ad);
        }
      });

      // Filter by metaAccountId if specified
      const filteredMetaAds = filters.metaAccountId
        ? metaAds.filter(ad => (ad.campaign as any)?.meta_account_id === filters.metaAccountId)
        : metaAds;

      // Rebuild maps with filtered ads if account filter is active
      if (filters.metaAccountId) {
        adByAdId.clear();
        adByName.clear();
        filteredMetaAds.forEach(ad => {
          adByAdId.set(ad.ad_id, ad);
          if (ad.name) {
            adByName.set(ad.name.toLowerCase(), ad);
          }
        });
      }

      // Process CTWA leads - cross-reference with meta_ads
      const ctwaLeads: TrackedLead[] = ctwaContacts.map(contact => {
        const refData = contact.referral_data as Record<string, any> | null;
        const assignedProfile = contact.profiles as any;

        let matchedAd: typeof metaAds[0] | undefined;
        let creativeMatched = false;

        if (refData) {
          // Strategy 1: Match by sourceId (ad_id from Meta)
          if (refData.sourceId) {
            matchedAd = adByAdId.get(refData.sourceId);
          }

          // Strategy 2: Match by adName
          if (!matchedAd && refData.adName) {
            matchedAd = adByName.get(refData.adName.toLowerCase());
          }

          // Strategy 3: Match by sourceUrl - extract ad_id from URL
          if (!matchedAd && refData.sourceUrl) {
            const urlAdId = extractAdIdFromUrl(refData.sourceUrl);
            if (urlAdId) {
              matchedAd = adByAdId.get(urlAdId);
            }
          }

          if (matchedAd) {
            creativeMatched = true;
          }
        }

        const adsetData = matchedAd?.adset as any;
        const campaignData = matchedAd?.campaign as any;

        return {
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
          ad_name: matchedAd?.name || refData?.adName || null,
          adset_name: adsetData?.name || null,
          campaign_name: campaignData?.name || refData?.campaignName || null,
          creative_name: matchedAd?.name || refData?.adName || refData?.headline || null,
          source_type: 'ctwa' as const,
          creative_matched: creativeMatched,
        };
      });

      // Process redirect leads - use UTM data
      const redirectLeads: TrackedLead[] = redirectContacts.map(contact => {
        const refData = contact.referral_data as Record<string, any> | null;
        const assignedProfile = contact.profiles as any;

        const creativeName = refData?.utm_content || refData?.utm_campaign || null;
        const campaignName = refData?.utm_campaign || null;

        return {
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
          source_type: 'redirect' as const,
          creative_matched: !!creativeName,
        };
      });

      // Apply source type filter
      let allLeads: TrackedLead[];
      if (filters.sourceType === 'ctwa') {
        allLeads = ctwaLeads;
      } else if (filters.sourceType === 'redirect') {
        allLeads = redirectLeads;
      } else {
        allLeads = [...ctwaLeads, ...redirectLeads];
      }

      // Sort by created_at desc
      allLeads.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      // Build summary
      const summary: LeadTrackingSummary = {
        totalLeads: allLeads.length,
        ctwaLeads: ctwaLeads.length,
        redirectLeads: redirectLeads.length,
        matchedCreatives: allLeads.filter(l => l.creative_matched).length,
        unmatchedCreatives: allLeads.filter(l => !l.creative_matched).length,
      };

      // Build creative breakdown
      const creativeMap = new Map<string, CreativeBreakdown>();

      allLeads.forEach(lead => {
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

      return { leads: allLeads, summary, creativeBreakdown };
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });
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
    // Try to extract ad ID from Facebook ad URLs
    // Common patterns: /ads/archive/render_ad/?id=123456 or fbid=123456
    const urlObj = new URL(url);
    const id = urlObj.searchParams.get('id') || urlObj.searchParams.get('fbid');
    return id || null;
  } catch {
    return null;
  }
}
