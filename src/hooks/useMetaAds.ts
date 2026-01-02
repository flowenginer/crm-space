import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MetaAdAccount {
  id: string;
  user_id: string;
  account_id: string;
  account_name: string | null;
  access_token: string;
  token_expires_at: string | null;
  business_id: string | null;
  currency: string;
  timezone: string;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MetaCampaign {
  id: string;
  meta_account_id: string;
  campaign_id: string;
  name: string;
  objective: string | null;
  status: string | null;
  daily_budget: number | null;
  lifetime_budget: number | null;
  start_time: string | null;
  stop_time: string | null;
  created_time: string | null;
  updated_at: string;
}

interface MetaCampaignInsight {
  id: string;
  campaign_id: string;
  date_start: string;
  date_stop: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number;
  cost_per_conversion: number | null;
  actions: any;
  created_at: string;
}

export interface CampaignWithInsights extends MetaCampaign {
  insights?: {
    impressions: number;
    clicks: number;
    spend: number;
    reach: number;
    ctr: number;
    cpc: number;
    conversions: number;
    costPerConversion: number | null;
  };
  ctwLeads?: number;
  realCpl?: number | null;
  conversationsStarted?: number;
}

export interface AggregatedInsights {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalReach: number;
  totalConversions: number;
  avgCtr: number;
  avgCpc: number;
  avgCpm: number;
  ctwLeads: number;
  realCpl: number | null;
  conversationsStarted: number;
}

// Hook para buscar anúncios do Meta Ads
export interface MetaAd {
  id: string;
  ad_id: string;
  name: string;
  status: string | null;
  campaign_id: string;
  campaign?: {
    id: string;
    campaign_id: string;
    name: string;
    meta_account_id?: string;
  };
}

export function useMetaAdsWithCampaigns(tenantId: string | null, metaAccountId?: string | null) {
  return useQuery({
    queryKey: ['meta-ads-with-campaigns', tenantId, metaAccountId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('meta_ads')
        .select(`
          id,
          ad_id,
          name,
          status,
          campaign_id,
          campaign:meta_campaigns(id, campaign_id, name, meta_account_id)
        `)
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      
      let result = data as MetaAd[];
      
      // Filtrar por conta Meta Ads se especificado
      if (metaAccountId) {
        result = result.filter(ad => 
          (ad.campaign as any)?.meta_account_id === metaAccountId
        );
      }
      
      return result;
    },
    enabled: !!tenantId
  });
}

export function useMetaAccounts() {
  return useQuery({
    queryKey: ['meta-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_ad_accounts')
        .select('*')
        .eq('is_active', true)
        .not('account_id', 'like', 'pending_%')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MetaAdAccount[];
    }
  });
}

export function useMetaCampaigns(accountId: string | null) {
  return useQuery({
    queryKey: ['meta-campaigns', accountId],
    queryFn: async () => {
      if (!accountId) return [];

      const { data, error } = await supabase
        .from('meta_campaigns')
        .select('*')
        .eq('meta_account_id', accountId)
        .order('created_time', { ascending: false });

      if (error) throw error;
      return data as MetaCampaign[];
    },
    enabled: !!accountId
  });
}

export function useMetaCampaignInsights(campaignId: string | null, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['meta-insights', campaignId, dateFrom, dateTo],
    queryFn: async () => {
      if (!campaignId) return [];

      let query = supabase
        .from('meta_campaign_insights')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('date_start', { ascending: false });

      if (dateFrom) {
        query = query.gte('date_start', dateFrom);
      }
      if (dateTo) {
        query = query.lte('date_stop', dateTo);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as MetaCampaignInsight[];
    },
    enabled: !!campaignId
  });
}

export function useMetaAccountInsights(accountId: string | null, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['meta-account-insights', accountId, dateFrom, dateTo],
    queryFn: async () => {
      if (!accountId) return null;

      // Get all campaigns for this account
      const { data: campaigns } = await supabase
        .from('meta_campaigns')
        .select('id')
        .eq('meta_account_id', accountId);

      if (!campaigns || campaigns.length === 0) return null;

      const campaignIds = campaigns.map(c => c.id);

      // Get insights for all campaigns
      let query = supabase
        .from('meta_campaign_insights')
        .select('*')
        .in('campaign_id', campaignIds);

      if (dateFrom) {
        query = query.gte('date_start', dateFrom);
      }
      if (dateTo) {
        query = query.lte('date_stop', dateTo);
      }

      const { data: insights, error } = await query;
      if (error) throw error;

      // Aggregate insights
      const aggregated: AggregatedInsights = {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalReach: 0,
        totalConversions: 0,
        avgCtr: 0,
        avgCpc: 0,
        avgCpm: 0,
        ctwLeads: 0,
        realCpl: null,
        conversationsStarted: 0
      };

      if (insights && insights.length > 0) {
        insights.forEach(insight => {
          aggregated.totalSpend += Number(insight.spend) || 0;
          aggregated.totalImpressions += Number(insight.impressions) || 0;
          aggregated.totalClicks += Number(insight.clicks) || 0;
          aggregated.totalReach += Number(insight.reach) || 0;
          aggregated.totalConversions += Number(insight.conversions) || 0;
        });

        if (aggregated.totalImpressions > 0) {
          aggregated.avgCtr = (aggregated.totalClicks / aggregated.totalImpressions) * 100;
          aggregated.avgCpm = (aggregated.totalSpend / aggregated.totalImpressions) * 1000;
        }
        if (aggregated.totalClicks > 0) {
          aggregated.avgCpc = aggregated.totalSpend / aggregated.totalClicks;
        }
      }

      // Get CTWA leads from contacts table
      let leadsQuery = supabase
        .from('contacts')
        .select('id', { count: 'exact' })
        .eq('origin', 'meta_ads');

      if (dateFrom) {
        leadsQuery = leadsQuery.gte('created_at', dateFrom);
      }
      if (dateTo) {
        leadsQuery = leadsQuery.lte('created_at', dateTo + 'T23:59:59');
      }

      const { count: ctwLeads } = await leadsQuery;
      aggregated.ctwLeads = ctwLeads || 0;

      if (aggregated.ctwLeads > 0 && aggregated.totalSpend > 0) {
        aggregated.realCpl = aggregated.totalSpend / aggregated.ctwLeads;
      }

      // Get conversations started from meta_ads origin
      let conversationsQuery = supabase
        .from('conversations')
        .select('id', { count: 'exact' })
        .eq('referral_source', 'meta_ads');

      if (dateFrom) {
        conversationsQuery = conversationsQuery.gte('created_at', dateFrom);
      }
      if (dateTo) {
        conversationsQuery = conversationsQuery.lte('created_at', dateTo + 'T23:59:59');
      }

      const { count: conversationsStarted } = await conversationsQuery;
      aggregated.conversationsStarted = conversationsStarted || 0;

      return aggregated;
    },
    enabled: !!accountId
  });
}

export function useCampaignsWithInsights(accountId: string | null, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['meta-campaigns-with-insights', accountId, dateFrom, dateTo],
    queryFn: async () => {
      if (!accountId) return [];

      // Get campaigns
      const { data: campaigns } = await supabase
        .from('meta_campaigns')
        .select('*')
        .eq('meta_account_id', accountId)
        .order('created_time', { ascending: false });

      if (!campaigns || campaigns.length === 0) return [];

      // Get insights for all campaigns
      const campaignIds = campaigns.map(c => c.id);
      
      let insightsQuery = supabase
        .from('meta_campaign_insights')
        .select('*')
        .in('campaign_id', campaignIds);

      if (dateFrom) {
        insightsQuery = insightsQuery.gte('date_start', dateFrom);
      }
      if (dateTo) {
        insightsQuery = insightsQuery.lte('date_stop', dateTo);
      }

      const { data: allInsights } = await insightsQuery;

      // Get CTWA leads per campaign from referral_data
      let leadsDataQuery = supabase
        .from('contacts')
        .select('referral_data, created_at')
        .eq('origin', 'meta_ads');

      if (dateFrom) {
        leadsDataQuery = leadsDataQuery.gte('created_at', dateFrom);
      }
      if (dateTo) {
        leadsDataQuery = leadsDataQuery.lte('created_at', dateTo + 'T23:59:59');
      }

      const { data: leadsData } = await leadsDataQuery;

      // Get conversations per campaign
      let conversationsDataQuery = supabase
        .from('conversations')
        .select('referral_data, created_at')
        .eq('referral_source', 'meta_ads');

      if (dateFrom) {
        conversationsDataQuery = conversationsDataQuery.gte('created_at', dateFrom);
      }
      if (dateTo) {
        conversationsDataQuery = conversationsDataQuery.lte('created_at', dateTo + 'T23:59:59');
      }

      const { data: conversationsData } = await conversationsDataQuery;

      // Map leads to campaigns
      const leadsPerCampaign: Record<string, number> = {};
      if (leadsData) {
        leadsData.forEach(contact => {
          const refData = contact.referral_data as any;
          if (refData?.sourceId) {
            leadsPerCampaign[refData.sourceId] = (leadsPerCampaign[refData.sourceId] || 0) + 1;
          }
        });
      }

      // Map conversations to campaigns
      const conversationsPerCampaign: Record<string, number> = {};
      if (conversationsData) {
        conversationsData.forEach(conv => {
          const refData = conv.referral_data as any;
          if (refData?.sourceId) {
            conversationsPerCampaign[refData.sourceId] = (conversationsPerCampaign[refData.sourceId] || 0) + 1;
          }
        });
      }

      // Aggregate insights per campaign
      const result: CampaignWithInsights[] = campaigns.map(campaign => {
        const campaignInsights = allInsights?.filter(i => i.campaign_id === campaign.id) || [];
        
        const aggregated = {
          impressions: 0,
          clicks: 0,
          spend: 0,
          reach: 0,
          ctr: 0,
          cpc: 0,
          conversions: 0,
          costPerConversion: null as number | null
        };

        campaignInsights.forEach(insight => {
          aggregated.impressions += Number(insight.impressions) || 0;
          aggregated.clicks += Number(insight.clicks) || 0;
          aggregated.spend += Number(insight.spend) || 0;
          aggregated.reach += Number(insight.reach) || 0;
          aggregated.conversions += Number(insight.conversions) || 0;
        });

        if (aggregated.impressions > 0) {
          aggregated.ctr = (aggregated.clicks / aggregated.impressions) * 100;
        }
        if (aggregated.clicks > 0) {
          aggregated.cpc = aggregated.spend / aggregated.clicks;
        }
        if (aggregated.conversions > 0) {
          aggregated.costPerConversion = aggregated.spend / aggregated.conversions;
        }

        const ctwLeads = leadsPerCampaign[campaign.campaign_id] || 0;
        const conversationsStarted = conversationsPerCampaign[campaign.campaign_id] || 0;
        const realCpl = ctwLeads > 0 && aggregated.spend > 0 ? aggregated.spend / ctwLeads : null;

        return {
          ...campaign,
          insights: aggregated,
          ctwLeads,
          realCpl,
          conversationsStarted
        };
      });

      return result;
    },
    enabled: !!accountId
  });
}

export function useDailyInsights(accountId: string | null, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['meta-daily-insights', accountId, dateFrom, dateTo],
    queryFn: async () => {
      if (!accountId) return [];

      // Get all campaigns for this account
      const { data: campaigns } = await supabase
        .from('meta_campaigns')
        .select('id')
        .eq('meta_account_id', accountId);

      if (!campaigns || campaigns.length === 0) return [];

      const campaignIds = campaigns.map(c => c.id);

      // Get insights
      let query = supabase
        .from('meta_campaign_insights')
        .select('*')
        .in('campaign_id', campaignIds)
        .order('date_start', { ascending: true });

      if (dateFrom) {
        query = query.gte('date_start', dateFrom);
      }
      if (dateTo) {
        query = query.lte('date_stop', dateTo);
      }

      const { data: insights } = await query;
      if (!insights) return [];

      // Group by date
      const dailyMap: Record<string, { date: string; spend: number; impressions: number; clicks: number; conversions: number; reach: number }> = {};

      insights.forEach(insight => {
        const date = insight.date_start;
        if (!dailyMap[date]) {
          dailyMap[date] = { date, spend: 0, impressions: 0, clicks: 0, conversions: 0, reach: 0 };
        }
        dailyMap[date].spend += Number(insight.spend) || 0;
        dailyMap[date].impressions += Number(insight.impressions) || 0;
        dailyMap[date].clicks += Number(insight.clicks) || 0;
        dailyMap[date].conversions += Number(insight.conversions) || 0;
        dailyMap[date].reach += Number(insight.reach) || 0;
      });

      return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    },
    enabled: !!accountId
  });
}

export function useSyncMetaAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, dateFrom, dateTo }: { accountId: string; dateFrom?: string; dateTo?: string }) => {
      // First sync campaigns
      const { data: campaignsData, error: campaignsError } = await supabase.functions.invoke('meta-sync', {
        body: { accountId, dateFrom, dateTo, action: 'sync-all' }
      });

      if (campaignsError) throw campaignsError;

      // Then sync ads to get campaign names for each ad
      const { data: adsData, error: adsError } = await supabase.functions.invoke('meta-sync', {
        body: { accountId, action: 'sync-ads' }
      });

      if (adsError) {
        console.error('Error syncing ads:', adsError);
        // Don't fail the whole sync if ads sync fails
      }

      return {
        campaignsCount: campaignsData?.campaignsCount || 0,
        insightsCount: campaignsData?.insightsCount || 0,
        adsCount: adsData?.adsCount || 0
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['meta-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['meta-account-insights'] });
      queryClient.invalidateQueries({ queryKey: ['meta-campaigns-with-insights'] });
      queryClient.invalidateQueries({ queryKey: ['meta-daily-insights'] });
      queryClient.invalidateQueries({ queryKey: ['meta-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['ads_breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['champion_creative'] });
      queryClient.invalidateQueries({ queryKey: ['top_creatives'] });
      toast.success(`Sincronização concluída: ${data.campaignsCount} campanhas, ${data.adsCount} anúncios`);
    },
    onError: (error: any) => {
      toast.error('Erro ao sincronizar: ' + error.message);
    }
  });
}

export function useSyncMetaAds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error } = await supabase.functions.invoke('meta-sync', {
        body: { accountId, action: 'sync-ads' }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ads_breakdown'] });
      queryClient.invalidateQueries({ queryKey: ['champion_creative'] });
      queryClient.invalidateQueries({ queryKey: ['top_creatives'] });
      toast.success(`Anúncios sincronizados: ${data.adsCount} anúncios de ${data.campaignsProcessed} campanhas`);
    },
    onError: (error: any) => {
      toast.error('Erro ao sincronizar anúncios: ' + error.message);
    }
  });
}

export function useDeleteMetaAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await supabase
        .from('meta_ad_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-accounts'] });
      toast.success('Conta desconectada com sucesso');
    },
    onError: (error: any) => {
      toast.error('Erro ao desconectar: ' + error.message);
    }
  });
}
