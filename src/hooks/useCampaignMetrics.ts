import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, eachDayOfInterval } from 'date-fns';

export interface CampaignMetrics {
  totalLeads: number;
  leadsThisMonth: number;
  leadsToday: number;
  conversions: number;
  conversionRate: number;
  avgResponseTime: number;
}

export interface DailyLeadData {
  date: string;
  leads: number;
  conversions: number;
}

export interface CampaignData {
  sourceId: string;
  headline: string;
  leads: number;
  conversions: number;
  conversionRate: number;
}

interface ReferralData {
  ctwaClid?: string;
  sourceId?: string;
  sourceType?: string;
  headline?: string;
  body?: string;
}

export function useCampaignMetrics(dateRange?: { from: Date; to: Date }) {
  return useQuery({
    queryKey: ['campaign_metrics', dateRange?.from?.toISOString(), dateRange?.to?.toISOString()],
    queryFn: async (): Promise<CampaignMetrics> => {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      
      // Total leads from Meta Ads (all time)
      const { count: totalLeads } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('origin', 'meta_ads');

      // Leads this month
      const { count: leadsThisMonth } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('origin', 'meta_ads')
        .gte('created_at', startOfMonth);

      // Leads today
      const { count: leadsToday } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('origin', 'meta_ads')
        .gte('created_at', startOfDay);

      // Get conversations from Meta Ads that have deals (conversions)
      const { data: metaConversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('referral_source', 'meta_ads');

      const conversationIds = metaConversations?.map(c => c.id) || [];
      
      let conversions = 0;
      if (conversationIds.length > 0) {
        const { count } = await supabase
          .from('deals')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', conversationIds)
          .eq('status', 'won');
        conversions = count || 0;
      }

      const total = totalLeads || 0;
      const conversionRate = total > 0 ? (conversions / total) * 100 : 0;

      return {
        totalLeads: total,
        leadsThisMonth: leadsThisMonth || 0,
        leadsToday: leadsToday || 0,
        conversions,
        conversionRate,
        avgResponseTime: 0,
      };
    },
  });
}

export function useDailyLeads(dateRange: { from: Date; to: Date }) {
  return useQuery({
    queryKey: ['daily_leads', dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async (): Promise<DailyLeadData[]> => {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('created_at')
        .eq('origin', 'meta_ads')
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());

      // Create a map of all days in the range
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const dailyMap: Record<string, number> = {};
      
      days.forEach(day => {
        dailyMap[format(day, 'yyyy-MM-dd')] = 0;
      });

      // Count leads per day
      contacts?.forEach(contact => {
        const day = format(new Date(contact.created_at), 'yyyy-MM-dd');
        if (dailyMap[day] !== undefined) {
          dailyMap[day]++;
        }
      });

      return Object.entries(dailyMap).map(([date, leads]) => ({
        date: format(new Date(date), 'dd/MM'),
        leads,
        conversions: 0, // Would need more complex query
      }));
    },
  });
}

export function useCampaignBreakdown() {
  return useQuery({
    queryKey: ['campaign_breakdown'],
    queryFn: async (): Promise<CampaignData[]> => {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('referral_data, origin_campaign')
        .eq('origin', 'meta_ads')
        .not('referral_data', 'is', null);

      // Group by campaign/ad
      const campaignMap: Record<string, { headline: string; leads: number }> = {};
      
      contacts?.forEach(contact => {
        const refData = contact.referral_data as ReferralData | null;
        const sourceId = refData?.sourceId || contact.origin_campaign || 'unknown';
        const headline = refData?.headline || contact.origin_campaign || 'Campanha desconhecida';
        
        if (!campaignMap[sourceId]) {
          campaignMap[sourceId] = { headline, leads: 0 };
        }
        campaignMap[sourceId].leads++;
      });

      return Object.entries(campaignMap)
        .map(([sourceId, data]) => ({
          sourceId,
          headline: data.headline,
          leads: data.leads,
          conversions: 0,
          conversionRate: 0,
        }))
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 10);
    },
  });
}

export function useRecentMetaLeads(limit: number = 10) {
  return useQuery({
    queryKey: ['recent_meta_leads', limit],
    queryFn: async () => {
      const { data } = await supabase
        .from('contacts')
        .select(`
          id,
          full_name,
          phone,
          created_at,
          origin_campaign,
          referral_data
        `)
        .eq('origin', 'meta_ads')
        .order('created_at', { ascending: false })
        .limit(limit);

      return data || [];
    },
  });
}
