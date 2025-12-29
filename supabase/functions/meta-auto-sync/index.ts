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

  const startTime = Date.now();
  console.log('[Meta Auto Sync] Starting automatic sync job...');

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Get all active Meta accounts that need syncing
    const { data: accounts, error: accountsError } = await supabase
      .from('meta_ad_accounts')
      .select('*')
      .eq('is_active', true)
      .eq('auto_sync_enabled', true);

    if (accountsError) {
      console.error('[Meta Auto Sync] Error fetching accounts:', accountsError);
      return new Response(JSON.stringify({ error: accountsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!accounts || accounts.length === 0) {
      console.log('[Meta Auto Sync] No accounts configured for auto sync');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No accounts to sync',
        accountsProcessed: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Meta Auto Sync] Found ${accounts.length} accounts to sync`);

    const results = [];
    const now = new Date();

    for (const account of accounts) {
      const accountStartTime = Date.now();
      
      // Check if account needs syncing based on interval
      const lastSync = account.last_auto_sync_at ? new Date(account.last_auto_sync_at) : null;
      const intervalMs = (account.sync_interval_hours || 1) * 60 * 60 * 1000;
      
      if (lastSync && (now.getTime() - lastSync.getTime()) < intervalMs) {
        console.log(`[Meta Auto Sync] Skipping account ${account.account_id} - synced recently`);
        results.push({
          accountId: account.id,
          accountName: account.account_name,
          status: 'skipped',
          reason: 'Recently synced'
        });
        continue;
      }

      // Create sync log entry
      const { data: syncLog, error: logError } = await supabase
        .from('meta_sync_logs')
        .insert({
          meta_account_id: account.id,
          tenant_id: account.tenant_id,
          sync_type: 'auto',
          status: 'running',
          started_at: now.toISOString()
        })
        .select()
        .single();

      if (logError) {
        console.error(`[Meta Auto Sync] Error creating log for ${account.account_id}:`, logError);
      }

      try {
        const accessToken = account.access_token;
        const adAccountId = account.account_id;

        console.log(`[Meta Auto Sync] Syncing account ${adAccountId}...`);

        // Fetch campaigns from Meta API
        const campaignsResponse = await fetch(
          `https://graph.facebook.com/v21.0/${adAccountId}/campaigns?` +
          `fields=id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time,created_time` +
          `&limit=500` +
          `&access_token=${accessToken}`
        );

        const campaignsData = await campaignsResponse.json();
        
        if (campaignsData.error) {
          throw new Error(campaignsData.error.message);
        }

        const campaigns: MetaCampaign[] = campaignsData.data || [];
        console.log(`[Meta Auto Sync] Found ${campaigns.length} campaigns for ${adAccountId}`);

        // Upsert campaigns
        for (const campaign of campaigns) {
          await supabase.from('meta_campaigns').upsert({
            meta_account_id: account.id,
            campaign_id: campaign.id,
            name: campaign.name,
            objective: campaign.objective,
            status: campaign.status,
            daily_budget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
            lifetime_budget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
            start_time: campaign.start_time,
            stop_time: campaign.stop_time,
            created_time: campaign.created_time,
            updated_at: now.toISOString()
          }, { onConflict: 'meta_account_id,campaign_id' });
        }

        // Sync insights for last 30 days
        const endDate = now.toISOString().split('T')[0];
        const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const { data: dbCampaigns } = await supabase
          .from('meta_campaigns')
          .select('id, campaign_id')
          .eq('meta_account_id', account.id);

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
                    const conversionActions = insight.actions.filter((a: { action_type: string; value: string }) => 
                      a.action_type.includes('conversion') || 
                      a.action_type.includes('lead') ||
                      a.action_type === 'onsite_conversion.messaging_first_reply'
                    );
                    conversions = conversionActions.reduce((sum: number, a: { action_type: string; value: string }) => sum + parseInt(a.value), 0);
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

              // Small delay to avoid rate limiting
              await new Promise(resolve => setTimeout(resolve, 50));
            } catch (err) {
              console.error(`[Meta Auto Sync] Error fetching insights for ${campaign.campaign_id}:`, err);
            }
          }
        }

        // Update account last sync times
        await supabase.from('meta_ad_accounts').update({
          last_sync_at: now.toISOString(),
          last_auto_sync_at: now.toISOString()
        }).eq('id', account.id);

        // Update sync log with success
        if (syncLog) {
          await supabase.from('meta_sync_logs').update({
            status: 'success',
            completed_at: new Date().toISOString(),
            campaigns_synced: campaigns.length,
            insights_synced: totalInsights
          }).eq('id', syncLog.id);
        }

        const accountDuration = Date.now() - accountStartTime;
        console.log(`[Meta Auto Sync] Completed ${adAccountId} in ${accountDuration}ms - ${campaigns.length} campaigns, ${totalInsights} insights`);

        results.push({
          accountId: account.id,
          accountName: account.account_name,
          status: 'success',
          campaignsCount: campaigns.length,
          insightsCount: totalInsights,
          durationMs: accountDuration
        });

      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Meta Auto Sync] Error syncing account ${account.account_id}:`, error);

        // Update sync log with error
        if (syncLog) {
          await supabase.from('meta_sync_logs').update({
            status: 'error',
            completed_at: new Date().toISOString(),
            error_message: errorMessage
          }).eq('id', syncLog.id);
        }

        results.push({
          accountId: account.id,
          accountName: account.account_name,
          status: 'error',
          error: errorMessage
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[Meta Auto Sync] Completed all accounts in ${totalDuration}ms`);

    return new Response(JSON.stringify({ 
      success: true,
      accountsProcessed: accounts.length,
      results,
      durationMs: totalDuration
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[Meta Auto Sync] Fatal error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
