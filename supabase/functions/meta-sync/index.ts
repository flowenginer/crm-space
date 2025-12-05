import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface MetaCampaign {
  id: string;
  name: string;
  objective?: string;
  status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  created_time?: string;
}

interface MetaInsight {
  impressions?: string;
  clicks?: string;
  spend?: string;
  reach?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: Array<{ action_type: string; value: string }>;
  date_start: string;
  date_stop: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const body = await req.json();
    const { accountId, dateFrom, dateTo, action } = body;

    // Get the meta account
    const { data: metaAccount, error: accountError } = await supabase
      .from('meta_ad_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accountError || !metaAccount) {
      console.error('[Meta Sync] Account not found:', accountError);
      return new Response(JSON.stringify({ error: 'Account not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const accessToken = metaAccount.access_token;
    const adAccountId = metaAccount.account_id;

    if (action === 'sync-campaigns') {
      console.log(`[Meta Sync] Syncing campaigns for account ${adAccountId}`);

      // Fetch campaigns from Meta API
      const campaignsResponse = await fetch(
        `https://graph.facebook.com/v21.0/${adAccountId}/campaigns?` +
        `fields=id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time,created_time` +
        `&limit=500` +
        `&access_token=${accessToken}`
      );

      const campaignsData = await campaignsResponse.json();
      
      if (campaignsData.error) {
        console.error('[Meta Sync] API Error:', campaignsData.error);
        return new Response(JSON.stringify({ error: campaignsData.error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const campaigns: MetaCampaign[] = campaignsData.data || [];
      console.log(`[Meta Sync] Found ${campaigns.length} campaigns`);

      // Upsert campaigns
      for (const campaign of campaigns) {
        const { error: upsertError } = await supabase.from('meta_campaigns').upsert({
          meta_account_id: accountId,
          campaign_id: campaign.id,
          name: campaign.name,
          objective: campaign.objective,
          status: campaign.status,
          daily_budget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
          lifetime_budget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
          start_time: campaign.start_time,
          stop_time: campaign.stop_time,
          created_time: campaign.created_time,
          updated_at: new Date().toISOString()
        }, { onConflict: 'meta_account_id,campaign_id' });

        if (upsertError) {
          console.error('[Meta Sync] Campaign upsert error:', upsertError);
        }
      }

      // Update last sync
      await supabase.from('meta_ad_accounts').update({
        last_sync_at: new Date().toISOString()
      }).eq('id', accountId);

      return new Response(JSON.stringify({ 
        success: true, 
        campaignsCount: campaigns.length 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'sync-insights') {
      console.log(`[Meta Sync] Syncing insights for account ${adAccountId}`);

      // Get campaigns from database
      const { data: dbCampaigns } = await supabase
        .from('meta_campaigns')
        .select('id, campaign_id')
        .eq('meta_account_id', accountId);

      if (!dbCampaigns || dbCampaigns.length === 0) {
        return new Response(JSON.stringify({ 
          success: true, 
          message: 'No campaigns to sync insights for' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Date range - default to last 30 days
      const endDate = dateTo || new Date().toISOString().split('T')[0];
      const startDate = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let totalInsights = 0;

      // Fetch insights for each campaign
      for (const campaign of dbCampaigns) {
        try {
          const insightsResponse = await fetch(
            `https://graph.facebook.com/v21.0/${campaign.campaign_id}/insights?` +
            `fields=impressions,clicks,spend,reach,ctr,cpc,cpm,actions` +
            `&time_range={"since":"${startDate}","until":"${endDate}"}` +
            `&time_increment=1` +
            `&access_token=${accessToken}`
          );

          const insightsData = await insightsResponse.json();
          
          if (insightsData.error) {
            console.error(`[Meta Sync] Insights error for campaign ${campaign.campaign_id}:`, insightsData.error);
            continue;
          }

          const insights: MetaInsight[] = insightsData.data || [];

          for (const insight of insights) {
            // Calculate conversions from actions
            let conversions = 0;
            if (insight.actions) {
              const conversionActions = insight.actions.filter(a => 
                a.action_type.includes('conversion') || 
                a.action_type.includes('lead') ||
                a.action_type === 'onsite_conversion.messaging_first_reply'
              );
              conversions = conversionActions.reduce((sum, a) => sum + parseInt(a.value), 0);
            }

            const spend = parseFloat(insight.spend || '0');
            const costPerConversion = conversions > 0 ? spend / conversions : null;

            const { error: upsertError } = await supabase.from('meta_campaign_insights').upsert({
              campaign_id: campaign.id,
              date_start: insight.date_start,
              date_stop: insight.date_stop,
              impressions: parseInt(insight.impressions || '0'),
              clicks: parseInt(insight.clicks || '0'),
              spend: spend,
              reach: parseInt(insight.reach || '0'),
              ctr: parseFloat(insight.ctr || '0'),
              cpc: parseFloat(insight.cpc || '0'),
              cpm: parseFloat(insight.cpm || '0'),
              conversions: conversions,
              cost_per_conversion: costPerConversion,
              actions: insight.actions || []
            }, { onConflict: 'campaign_id,date_start' });

            if (upsertError) {
              console.error('[Meta Sync] Insight upsert error:', upsertError);
            } else {
              totalInsights++;
            }
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error(`[Meta Sync] Error fetching insights for ${campaign.campaign_id}:`, err);
        }
      }

      // Update last sync
      await supabase.from('meta_ad_accounts').update({
        last_sync_at: new Date().toISOString()
      }).eq('id', accountId);

      return new Response(JSON.stringify({ 
        success: true, 
        insightsCount: totalInsights,
        campaignsProcessed: dbCampaigns.length
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'sync-all') {
      // Sync campaigns first
      console.log(`[Meta Sync] Starting full sync for account ${adAccountId}`);

      // Fetch campaigns
      const campaignsResponse = await fetch(
        `https://graph.facebook.com/v21.0/${adAccountId}/campaigns?` +
        `fields=id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time,created_time` +
        `&limit=500` +
        `&access_token=${accessToken}`
      );

      const campaignsData = await campaignsResponse.json();
      
      if (campaignsData.error) {
        console.error('[Meta Sync] API Error:', campaignsData.error);
        return new Response(JSON.stringify({ error: campaignsData.error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const campaigns: MetaCampaign[] = campaignsData.data || [];
      console.log(`[Meta Sync] Found ${campaigns.length} campaigns`);

      // Upsert campaigns
      for (const campaign of campaigns) {
        await supabase.from('meta_campaigns').upsert({
          meta_account_id: accountId,
          campaign_id: campaign.id,
          name: campaign.name,
          objective: campaign.objective,
          status: campaign.status,
          daily_budget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
          lifetime_budget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
          start_time: campaign.start_time,
          stop_time: campaign.stop_time,
          created_time: campaign.created_time,
          updated_at: new Date().toISOString()
        }, { onConflict: 'meta_account_id,campaign_id' });
      }

      // Now fetch insights for account level (aggregated)
      const endDate = dateTo || new Date().toISOString().split('T')[0];
      const startDate = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Get campaigns from database with their IDs
      const { data: dbCampaigns } = await supabase
        .from('meta_campaigns')
        .select('id, campaign_id')
        .eq('meta_account_id', accountId);

      let totalInsights = 0;

      if (dbCampaigns && dbCampaigns.length > 0) {
        for (const campaign of dbCampaigns) {
          try {
            const insightsResponse = await fetch(
              `https://graph.facebook.com/v21.0/${campaign.campaign_id}/insights?` +
              `fields=impressions,clicks,spend,reach,ctr,cpc,cpm,actions` +
              `&time_range={"since":"${startDate}","until":"${endDate}"}` +
              `&time_increment=1` +
              `&access_token=${accessToken}`
            );

            const insightsData = await insightsResponse.json();
            
            if (!insightsData.error && insightsData.data) {
              for (const insight of insightsData.data) {
                let conversions = 0;
                if (insight.actions) {
                  const conversionActions = insight.actions.filter((a: any) => 
                    a.action_type.includes('conversion') || 
                    a.action_type.includes('lead') ||
                    a.action_type === 'onsite_conversion.messaging_first_reply'
                  );
                  conversions = conversionActions.reduce((sum: number, a: any) => sum + parseInt(a.value), 0);
                }

                const spend = parseFloat(insight.spend || '0');
                const costPerConversion = conversions > 0 ? spend / conversions : null;

                await supabase.from('meta_campaign_insights').upsert({
                  campaign_id: campaign.id,
                  date_start: insight.date_start,
                  date_stop: insight.date_stop,
                  impressions: parseInt(insight.impressions || '0'),
                  clicks: parseInt(insight.clicks || '0'),
                  spend: spend,
                  reach: parseInt(insight.reach || '0'),
                  ctr: parseFloat(insight.ctr || '0'),
                  cpc: parseFloat(insight.cpc || '0'),
                  cpm: parseFloat(insight.cpm || '0'),
                  conversions: conversions,
                  cost_per_conversion: costPerConversion,
                  actions: insight.actions || []
                }, { onConflict: 'campaign_id,date_start' });

                totalInsights++;
              }
            }

            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (err) {
            console.error(`[Meta Sync] Error fetching insights for ${campaign.campaign_id}:`, err);
          }
        }
      }

      // Update last sync
      await supabase.from('meta_ad_accounts').update({
        last_sync_at: new Date().toISOString()
      }).eq('id', accountId);

      return new Response(JSON.stringify({ 
        success: true, 
        campaignsCount: campaigns.length,
        insightsCount: totalInsights
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[Meta Sync] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
