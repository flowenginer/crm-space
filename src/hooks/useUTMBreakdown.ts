import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenantId } from "./useTenant";

export interface UTMBreakdownRow {
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  visits: number;
  leads: number;
}

// Função para limpar content: usa medium como fallback se content for grande/encoded
function getCleanContent(utm_content: string | null, utm_medium: string | null): string | null {
  if (!utm_content) return utm_medium;
  
  // Se content tem URL encoding OU é muito longo, usa medium
  const hasUrlEncoding = utm_content.includes('%');
  const isTooLong = utm_content.length > 40;
  
  if (hasUrlEncoding || isTooLong) {
    return utm_medium || utm_content;
  }
  
  return utm_content;
}

export interface UTMBreakdownTotals {
  total_visits: number;
  total_leads: number;
  overall_conversion_rate: number;
  has_untracked: boolean;
}

export function useUTMBreakdown(campaignId: string | undefined) {
  const { data: tenantId } = useCurrentTenantId();

  return useQuery({
    queryKey: ["utm-breakdown", campaignId, tenantId],
    queryFn: async () => {
      if (!campaignId || !tenantId) {
        return { breakdown: [], totals: { total_visits: 0, total_leads: 0, overall_conversion_rate: 0, has_untracked: false } };
      }

      // Fetch visits grouped by UTM
      const { data: visitsData, error: visitsError } = await supabase
        .from("redirect_campaign_views")
        .select("utm_source, utm_medium, utm_campaign, utm_content, visitor_id")
        .eq("campaign_id", campaignId)
        .eq("tenant_id", tenantId);

      if (visitsError) throw visitsError;

      // Fetch leads grouped by UTM
      const { data: leadsData, error: leadsError } = await supabase
        .from("redirect_logs")
        .select("utm_source, utm_medium, utm_campaign, utm_content")
        .eq("campaign_id", campaignId)
        .eq("tenant_id", tenantId);

      if (leadsError) throw leadsError;

      // Aggregate visits by UTM combination (usando content limpo)
      const visitsMap = new Map<string, { utm_source: string | null; utm_campaign: string | null; utm_content: string | null; visitors: Set<string> }>();
      
      (visitsData || []).forEach((v) => {
        const cleanContent = getCleanContent(v.utm_content, v.utm_medium);
        const key = `${v.utm_source || "(direto)"}|${v.utm_campaign || "(none)"}|${cleanContent || "(none)"}`;
        if (!visitsMap.has(key)) {
          visitsMap.set(key, {
            utm_source: v.utm_source,
            utm_campaign: v.utm_campaign,
            utm_content: cleanContent,
            visitors: new Set(),
          });
        }
        visitsMap.get(key)!.visitors.add(v.visitor_id);
      });

      // Aggregate leads by UTM combination (usando content limpo)
      const leadsMap = new Map<string, number>();
      (leadsData || []).forEach((l) => {
        const cleanContent = getCleanContent(l.utm_content, l.utm_medium);
        const key = `${l.utm_source || "(direto)"}|${l.utm_campaign || "(none)"}|${cleanContent || "(none)"}`;
        leadsMap.set(key, (leadsMap.get(key) || 0) + 1);
      });

      // Merge data
      const allKeys = new Set([...visitsMap.keys(), ...leadsMap.keys()]);
      const breakdown: UTMBreakdownRow[] = [];

      allKeys.forEach((key) => {
        const [source, campaign, content] = key.split("|");
        const visitsEntry = visitsMap.get(key);
        const visits = visitsEntry ? visitsEntry.visitors.size : 0;
        const leads = leadsMap.get(key) || 0;

        breakdown.push({
          utm_source: source === "(direto)" ? null : source,
          utm_campaign: campaign === "(none)" ? null : campaign,
          utm_content: content === "(none)" ? null : content,
          visits,
          leads,
        });
      });

      // Sort by visits descending
      breakdown.sort((a, b) => b.visits - a.visits);

      // Calculate totals
      const total_visits = breakdown.reduce((sum, r) => sum + r.visits, 0);
      const total_leads = breakdown.reduce((sum, r) => sum + r.leads, 0);
      const overall_conversion_rate = total_visits > 0 ? (total_leads / total_visits) * 100 : 0;
      const has_untracked = breakdown.some((r) => r.utm_source === null);

      const totals: UTMBreakdownTotals = {
        total_visits,
        total_leads,
        overall_conversion_rate,
        has_untracked,
      };

      return { breakdown, totals };
    },
    enabled: !!campaignId && !!tenantId,
  });
}
