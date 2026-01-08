import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = "https://lkxrmjqrzhaivviuuamp.supabase.co";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

interface ProviderConfig {
  baseUrl: string;
  adminToken: string;
  code: string;
}

interface ProviderData {
  id: string;
  code: string;
  base_url: string;
  admin_token: string;
}

interface ChannelWithProvider {
  id: string;
  instance_id: string | null;
  instance_token: string | null;
  status: string | null;
  phone: string | null;
  tenant_id: string;
  provider: ProviderData | ProviderData[] | null;
}

// Helper to get provider from channel (handles array or single object)
function getProvider(channel: ChannelWithProvider): ProviderData | null {
  if (!channel.provider) return null;
  if (Array.isArray(channel.provider)) {
    return channel.provider[0] || null;
  }
  return channel.provider;
}

// Helper to normalize base URL
function normalizeBaseUrl(url: string): string {
  let normalized = url?.trim() || '';
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (normalized.endsWith('/manager')) {
    normalized = normalized.slice(0, -8);
  }
  return normalized;
}

// Get UAZAPI Status
async function getUAZAPIStatus(baseUrl: string, instanceToken: string) {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  
  try {
    const url = `${normalizedUrl}/instance/status`;
    const response = await fetch(url, {
      headers: { 'token': instanceToken },
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const state = data.state || data.status || 'disconnected';
    const isConnected = state === 'connected' || state === 'open';
    
    return { 
      success: true, 
      connected: isConnected,
      jid: data.owner || data.ownerJid,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Get Evolution Status
async function getEvolutionStatus(baseUrl: string, instanceName: string, adminToken: string) {
  const normalizedUrl = normalizeBaseUrl(baseUrl);
  
  try {
    const response = await fetch(`${normalizedUrl}/instance/connectionState/${instanceName}`, {
      headers: { 'apikey': adminToken },
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const state = data.instance?.state || data.state;
    
    return { 
      success: true, 
      connected: state === 'open',
      jid: data.instance?.owner || data.ownerJid,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Sync a single channel
async function syncChannel(
  supabase: any,
  channel: ChannelWithProvider
): Promise<{ channelId: string; success: boolean; status?: string; error?: string }> {
  const provider = getProvider(channel);
  
  if (!provider || !channel.instance_id) {
    return { 
      channelId: channel.id, 
      success: false, 
      error: 'Sem provedor ou instance_id' 
    };
  }
  
  let statusResult: { success: boolean; connected?: boolean; jid?: string; error?: string };
  
  try {
    switch (provider.code) {
      case 'uazapi':
        if (!channel.instance_token) {
          return { channelId: channel.id, success: false, error: 'Sem instance_token' };
        }
        statusResult = await getUAZAPIStatus(provider.base_url, channel.instance_token);
        break;
      case 'evolution':
        statusResult = await getEvolutionStatus(provider.base_url, channel.instance_id, provider.admin_token);
        break;
      default:
        return { channelId: channel.id, success: false, error: 'Provedor não suportado' };
    }
    
    if (!statusResult.success) {
      return { channelId: channel.id, success: false, error: statusResult.error };
    }
    
    // Determine new status and phone
    const newStatus = statusResult.connected ? 'connected' : 'disconnected';
    let phone = channel.phone || '';
    
    if (statusResult.jid) {
      const jidPhone = statusResult.jid.split(':')[0].split('@')[0];
      if (jidPhone) phone = jidPhone;
    }
    
    // Update channel in database
    const { error: updateError } = await supabase
      .from('whatsapp_channels')
      .update({
        status: newStatus,
        phone: phone,
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', channel.id);
    
    if (updateError) {
      return { channelId: channel.id, success: false, error: updateError.message };
    }
    
    return { channelId: channel.id, success: true, status: newStatus };
  } catch (err: any) {
    return { channelId: channel.id, success: false, error: err.message };
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[Sync WhatsApp Channels] Starting periodic sync...");

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch all active channels with their providers
    const { data: channels, error: fetchError } = await supabase
      .from('whatsapp_channels')
      .select(`
        id,
        instance_id,
        instance_token,
        status,
        phone,
        tenant_id,
        provider:whatsapp_providers(
          id,
          code,
          base_url,
          admin_token
        )
      `)
      .eq('is_deleted', false)
      .not('instance_id', 'is', null);

    if (fetchError) {
      console.error("[Sync WhatsApp Channels] Error fetching channels:", fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!channels || channels.length === 0) {
      console.log("[Sync WhatsApp Channels] No channels to sync");
      return new Response(
        JSON.stringify({ success: true, message: "No channels to sync", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Sync WhatsApp Channels] Found ${channels.length} channels to sync`);

    // Process all channels in parallel with a concurrency limit
    const BATCH_SIZE = 5;
    const results: { channelId: string; success: boolean; status?: string; error?: string }[] = [];
    
    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
      const batch = channels.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((channel) => syncChannel(supabase, channel as ChannelWithProvider))
      );
      results.push(...batchResults);
    }

    // Count results
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const connected = results.filter(r => r.success && r.status === 'connected').length;
    const disconnected = results.filter(r => r.success && r.status === 'disconnected').length;

    console.log(`[Sync WhatsApp Channels] Sync complete:`, {
      total: channels.length,
      successful,
      failed,
      connected,
      disconnected,
    });

    // Log failed syncs for debugging
    const failures = results.filter(r => !r.success);
    if (failures.length > 0) {
      console.log("[Sync WhatsApp Channels] Failed syncs:", failures);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Sync completed",
        stats: {
          total: channels.length,
          successful,
          failed,
          connected,
          disconnected,
        },
        failures: failures.length > 0 ? failures : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[Sync WhatsApp Channels] Unexpected error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
