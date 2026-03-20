import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration for batch processing
const MAX_CONTACTS_PER_BATCH = 5; // Process max 5 contacts per invocation
const MAX_EXECUTION_TIME_MS = 45000; // 45 seconds max per invocation (leave buffer before 60s timeout)

// Schedule configuration interface
interface ScheduleConfig {
  enabled: boolean;
  start: string;
  end: string;
  days: number[];
  timezone: string;
}

interface BusinessHourDay {
  enabled: boolean;
  start: string;
  end: string;
}

interface BusinessHours {
  [key: string]: BusinessHourDay;
}

function timeToMinutes(hhmm: string): number {
  const [hRaw, mRaw] = hhmm.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

// Helper function to get greeting based on time of day
function getGreeting(): string {
  const now = new Date();
  const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const hour = brasiliaTime.getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Helper function to get current date in pt-BR format
function getCurrentDate(): string {
  const now = new Date();
  const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return brasiliaTime.toLocaleDateString('pt-BR');
}

// Helper function to replace variables in message
function replaceVariables(
  text: string,
  contact: { full_name?: string; phone?: string; email?: string },
  agentName?: string
): string {
  return text
    .replace(/\{\{nome\}\}/gi, contact.full_name || '')
    .replace(/\{\{telefone\}\}/gi, contact.phone || '')
    .replace(/\{\{email\}\}/gi, contact.email || '')
    .replace(/\{\{data\}\}/gi, getCurrentDate())
    .replace(/\{\{saudacao\}\}/gi, getGreeting())
    .replace(/\{\{atendente\}\}/gi, agentName || '');
}

// RescueStep interface (Follow-up campaigns)
interface RescueStep {
  message: string;
  timer_minutes: number;
  audio_url?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
}

// MarketingStep interface (Marketing campaigns)
interface MarketingStep {
  message: string;
  timer_minutes: number;
  audio_url?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  on_reply_actions?: { type: string; config: Record<string, unknown> }[];
  on_no_reply_actions?: { type: string; config: Record<string, unknown> }[];
}

// Function to generate randomized interval (±30% variation)
function getRandomizedInterval(baseMs: number): number {
  const variationPercent = 0.3;
  const minMs = Math.floor(baseMs * (1 - variationPercent));
  const maxMs = Math.floor(baseMs * (1 + variationPercent));
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

// Helper to check if a channel is Cloud API (official)
async function isCloudAPIChannel(supabase: any, channelId: string): Promise<boolean> {
  const { data } = await supabase
    .from('cloudapi_configs')
    .select('id')
    .eq('channel_id', channelId)
    .eq('is_active', true)
    .maybeSingle();
  return !!data;
}

// Send a single message via the correct channel (Cloud API or whatsapp-instance)
async function sendViaSingleChannel(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  channelId: string,
  phone: string,
  content: string,
  type: string,
  mediaUrl?: string | null,
  isCloudAPI?: boolean,
  conversationId?: string,
): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  if (isCloudAPI) {
    const sendRes = await fetch(`${supabaseUrl}/functions/v1/cloudapi-send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        channelId,
        phone,
        type,
        content: type === 'text' ? content : undefined,
        mediaUrl: mediaUrl || undefined,
        conversationId,
      }),
    });
    const result = await sendRes.json();
    return {
      ok: sendRes.ok && result?.success !== false,
      messageId: result?.messageId || result?.messages?.[0]?.id,
      error: result?.error,
    };
  } else {
    const sendRes = await fetch(`${supabaseUrl}/functions/v1/whatsapp-instance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        action: 'send',
        channelId,
        phone,
        content: type === 'text' ? content : undefined,
        type,
        mediaUrl: mediaUrl || undefined,
      }),
    });
    const result = await sendRes.json();
    return {
      ok: sendRes.ok,
      messageId: result?.messageId,
      error: result?.error,
    };
  }
}

// Function to send message directly via whatsapp-instance or cloudapi-send-message
async function sendMessageDirectly(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  channelId: string,
  conversationId: string,
  contactId: string,
  phone: string,
  content: string,
  audioUrl?: string | null,
  attachmentUrl?: string | null,
  tenantId?: string | null,
  attachmentType?: string | null
): Promise<void> {
  console.log(`[BulkDispatch] Sending message directly to ${phone}`);

  // Detect if channel is Cloud API (official) - check once for all messages
  const cloudAPI = await isCloudAPIChannel(supabase, channelId);
  if (cloudAPI) {
    console.log(`[BulkDispatch] Channel ${channelId} is Cloud API, routing to cloudapi-send-message`);
  }

  // Send text message if content exists
  if (content?.trim()) {
    // Create message record
    const { data: msgData, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        contact_id: contactId,
        content: content,
        is_from_me: true,
        message_type: 'text',
        status: 'pending',
        tenant_id: tenantId,
      })
      .select('id')
      .single();

    if (msgError) {
      console.error(`[BulkDispatch] Error creating message:`, msgError);
      throw new Error(`Failed to create message: ${msgError.message}`);
    }

    const result = await sendViaSingleChannel(
      supabase, supabaseUrl, supabaseServiceKey, channelId,
      phone, content, 'text', null, cloudAPI, conversationId,
    );
    console.log(`[BulkDispatch] Send result:`, result);

    // Update message status
    await supabase
      .from('messages')
      .update({
        whatsapp_message_id: result.messageId || null,
        status: result.ok ? 'sent' : 'error',
      })
      .eq('id', msgData.id);

    if (!result.ok) {
      console.error(`[BulkDispatch] Failed to send message:`, result);
      throw new Error(result.error || 'Failed to send message');
    }
  }

  // Send audio if exists
  if (audioUrl) {
    const { data: audioMsgData } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        contact_id: contactId,
        content: '',
        is_from_me: true,
        message_type: 'audio',
        media_url: audioUrl,
        status: 'pending',
        tenant_id: tenantId,
      })
      .select('id')
      .single();

    const audioResult = await sendViaSingleChannel(
      supabase, supabaseUrl, supabaseServiceKey, channelId,
      phone, '', 'audio', audioUrl, cloudAPI, conversationId,
    );

    await supabase
      .from('messages')
      .update({
        whatsapp_message_id: audioResult.messageId || null,
        status: audioResult.ok ? 'sent' : 'error',
      })
      .eq('id', audioMsgData?.id);
  }

  // Send attachment if exists
  if (attachmentUrl) {
    const effectiveAttachmentType = attachmentType || 'document';
    const { data: attachMsgData } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        contact_id: contactId,
        content: '',
        is_from_me: true,
        message_type: effectiveAttachmentType,
        media_url: attachmentUrl,
        status: 'pending',
        tenant_id: tenantId,
      })
      .select('id')
      .single();

    const attachResult = await sendViaSingleChannel(
      supabase, supabaseUrl, supabaseServiceKey, channelId,
      phone, '', effectiveAttachmentType, attachmentUrl, cloudAPI, conversationId,
    );
    
    await supabase
      .from('messages')
      .update({
        whatsapp_message_id: attachResult?.messageId || null,
        status: attachResult.ok ? 'sent' : 'error',
      })
      .eq('id', attachMsgData?.id);
  }

  console.log(`[BulkDispatch] Message sent directly to ${phone}`);
}

// Function to send Meta template message via Cloud API
async function sendMetaTemplateMessage(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  channelId: string,
  conversationId: string,
  contactId: string,
  phone: string,
  metaTemplate: any,
  metaVariables: Record<string, string> | null,
  contact: { full_name?: string; phone?: string; email?: string }
): Promise<void> {
  console.log(`[BulkDispatch] Sending Meta template to ${phone} using template: ${metaTemplate.name}`);
  
  // Replace dynamic variables in the template variables
  const processedVariables: Record<string, string> = {};
  if (metaVariables) {
    for (const [key, value] of Object.entries(metaVariables)) {
      processedVariables[key] = replaceVariables(value, contact);
    }
  }

  console.log(`[BulkDispatch] Raw variables keys:`, Object.keys(processedVariables));

  // Build template payload
  const templatePayload: any = {
    name: metaTemplate.name,
    language: { code: metaTemplate.language || 'pt_BR' },
  };

  // Build components array from variables
  const components: any[] = [];

  // Detect header format from the Meta template components (IMAGE, VIDEO, DOCUMENT, TEXT)
  let headerFormat: string | null = null;
  let headerVarCount = 0;
  if (metaTemplate.components && Array.isArray(metaTemplate.components)) {
    const headerComponent = metaTemplate.components.find(
      (c: any) => c.type === 'HEADER'
    );
    if (headerComponent?.format) {
      headerFormat = headerComponent.format.toUpperCase();
    }
    // Count variables in header text
    if (headerComponent?.text) {
      const headerMatches = headerComponent.text.match(/\{\{(\d+)\}\}/g);
      headerVarCount = headerMatches ? headerMatches.length : 0;
    }
  }

  // ---- REMAP {{N}} variables to header_/body_ prefixes ----
  const hasLegacyPrefixes = Object.keys(processedVariables).some(
    k => k.startsWith('header_') || k.startsWith('body_') || k.startsWith('button_')
  );
  const hasBracketKeys = Object.keys(processedVariables).some(k => /^\{\{\d+\}\}$/.test(k));

  // Remapped variables (header_N / body_N format)
  let remappedVars: Record<string, string> = {};

  if (hasBracketKeys && !hasLegacyPrefixes) {
    // Remap {{N}} → header_N / body_N based on template component analysis
    console.log(`[BulkDispatch] Remapping {{N}} vars. headerVarCount=${headerVarCount}`);
    
    // Collect all numbered vars sorted
    const numberedEntries = Object.entries(processedVariables)
      .filter(([k]) => /^\{\{\d+\}\}$/.test(k))
      .map(([k, v]) => ({ num: parseInt(k.replace(/[{}]/g, '')), value: v }))
      .sort((a, b) => a.num - b.num);

    for (const entry of numberedEntries) {
      if (entry.num <= headerVarCount) {
        remappedVars[`header_${entry.num}`] = entry.value;
      } else {
        const bodyIndex = entry.num - headerVarCount;
        remappedVars[`body_${bodyIndex}`] = entry.value;
      }
    }
  } else {
    // Already has prefixed keys or no bracket keys — use as-is
    remappedVars = { ...processedVariables };
  }

  // Extract header_media_url (special key from UI)
  const headerMediaUrl = processedVariables['header_media_url'] || remappedVars['header_media_url'] || null;
  delete remappedVars['header_media_url'];

  console.log(`[BulkDispatch] Remapped vars:`, Object.keys(remappedVars), `headerMediaUrl: ${headerMediaUrl ? 'present' : 'none'}`);

  // Handle header variables / media
  const headerVars = Object.entries(remappedVars)
    .filter(([k]) => k.startsWith('header_'))
    .sort(([a], [b]) => a.localeCompare(b));

  if (headerFormat === 'IMAGE' || headerFormat === 'VIDEO' || headerFormat === 'DOCUMENT') {
    // Media header: use header_media_url from dispatch variables, or from template's stored permanent URL
    let mediaUrl = headerMediaUrl || (headerVars.length > 0 ? headerVars[0][1] : null);

    // Use permanent Storage URL from template if not provided by user
    if (!mediaUrl && metaTemplate.header_media_url) {
      mediaUrl = metaTemplate.header_media_url;
      console.log(`[BulkDispatch] Using permanent Storage URL from template`);
    }

    if (mediaUrl) {
      const mediaType = headerFormat.toLowerCase();
      components.push({
        type: 'header',
        parameters: [{
          type: mediaType,
          [mediaType]: { link: mediaUrl },
        }],
      });
      console.log(`[BulkDispatch] Header media (${mediaType}): ${mediaUrl.substring(0, 80)}...`);
    } else if (headerVarCount === 0) {
      console.log(`[BulkDispatch] ERROR: Media header template requires media URL but none available`);
      throw new Error(`Template com cabeçalho de mídia requer uma URL de mídia`);
    } else {
      console.log(`[BulkDispatch] WARNING: Media header has ${headerVarCount} variables but no media URL provided`);
    }
  } else if (headerVars.length > 0) {
    // Text header with variables
    components.push({
      type: 'header',
      parameters: headerVars.map(([, v]) => ({ type: 'text', text: v })),
    });
  }

  // Handle body variables
  const bodyVars = Object.entries(remappedVars)
    .filter(([k]) => k.startsWith('body_'))
    .sort(([a], [b]) => a.localeCompare(b));
  
  if (bodyVars.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyVars.map(([, v]) => ({ type: 'text', text: v })),
    });
  }

  // Handle button variables
  const buttonVars = Object.entries(remappedVars)
    .filter(([k]) => k.startsWith('button_'))
    .sort(([a], [b]) => a.localeCompare(b));
  
  for (const [key, value] of buttonVars) {
    const match = key.match(/button_(\d+)_/);
    if (match) {
      const buttonIndex = parseInt(match[1]);
      components.push({
        type: 'button',
        sub_type: 'url',
        index: buttonIndex,
        parameters: [{ type: 'text', text: value }],
      });
    }
  }

  if (components.length > 0) {
    templatePayload.components = components;
  }

  // Get Cloud API config for this channel
  const { data: cloudConfig } = await supabase
    .from('cloudapi_configs')
    .select('*')
    .eq('channel_id', channelId)
    .eq('is_active', true)
    .single();

  if (!cloudConfig) {
    throw new Error('Cloud API config not found for channel');
  }

  // Extract body text from template components for better preview
  let templatePreview = `Template: ${metaTemplate.name}`;
  if (metaTemplate.components && Array.isArray(metaTemplate.components)) {
    const bodyComponent = metaTemplate.components.find(
      (c: any) => c.type === 'BODY'
    );
    if (bodyComponent?.text) {
      templatePreview = bodyComponent.text;
    }
  } else if (metaTemplate.preview_text) {
    templatePreview = metaTemplate.preview_text;
  }

  // Create message record with full template content
  const { data: msgData, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      contact_id: contactId,
      content: templatePreview,
      is_from_me: true,
      message_type: 'template',
      status: 'pending',
    })
    .select('id')
    .single();

  if (msgError) {
    console.error(`[BulkDispatch] Error creating message:`, msgError);
    throw new Error(`Failed to create message: ${msgError.message}`);
  }

  // Send via cloudapi-send-message
  const sendRes = await fetch(`${supabaseUrl}/functions/v1/cloudapi-send-message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      channelId,
      phone,
      type: 'template',
      template: templatePayload,
    }),
  });

  const result = await sendRes.json();
  console.log(`[BulkDispatch] Cloud API send result:`, result);

  // Update message status
  await supabase
    .from('messages')
    .update({
      whatsapp_message_id: result?.messageId || result?.messages?.[0]?.id || null,
      status: sendRes.ok && result?.success !== false ? 'sent' : 'error',
    })
    .eq('id', msgData.id);

  if (!sendRes.ok || result?.success === false) {
    console.error(`[BulkDispatch] Failed to send Meta template:`, result);
    throw new Error(result?.error || 'Failed to send Meta template');
  }

  console.log(`[BulkDispatch] Meta template sent to ${phone}`);
}

// Get schedule configuration from dispatch or company settings
async function getScheduleConfig(supabase: any, dispatch: any): Promise<ScheduleConfig> {
  // If schedule is disabled for this dispatch, return disabled config
  if (dispatch.schedule_enabled === false) {
    return { enabled: false, start: '00:00', end: '23:59', days: [0, 1, 2, 3, 4, 5, 6], timezone: 'America/Sao_Paulo' };
  }

  // If dispatch has override, use it
  if (dispatch.schedule_override) {
    const override = dispatch.schedule_override;
    return {
      enabled: true,
      start: override.start || '08:00',
      end: override.end || '18:00',
      days: override.days || [1, 2, 3, 4, 5],
      timezone: override.timezone || 'America/Sao_Paulo',
    };
  }

  // Fallback to company settings
  const { data: companySettings } = await supabase
    .from('company_settings')
    .select('business_hours, timezone')
    .eq('tenant_id', dispatch.tenant_id)
    .single();

  if (companySettings?.business_hours) {
    const businessHours = companySettings.business_hours as BusinessHours;
    const dayMap: { [key: string]: number } = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6
    };

    // Find enabled days and their hours
    const enabledDays: number[] = [];
    let start = '08:00';
    let end = '18:00';

    for (const [dayName, config] of Object.entries(businessHours)) {
      if (config.enabled && dayMap[dayName] !== undefined) {
        enabledDays.push(dayMap[dayName]);
        // Use first enabled day's hours as reference
        if (enabledDays.length === 1) {
          start = config.start;
          end = config.end;
        }
      }
    }

    return {
      enabled: true,
      start,
      end,
      days: enabledDays.length > 0 ? enabledDays : [1, 2, 3, 4, 5],
      timezone: companySettings.timezone || 'America/Sao_Paulo',
    };
  }

  // Default: enabled Mon-Fri 08:00-18:00
  return {
    enabled: true,
    start: '08:00',
    end: '18:00',
    days: [1, 2, 3, 4, 5],
    timezone: 'America/Sao_Paulo',
  };
}

// Check if current time is within schedule
function isWithinSchedule(config: ScheduleConfig): boolean {
  if (!config.enabled) return true;

  const now = new Date();
  const tzTime = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
  
  const currentDay = tzTime.getDay();
  const currentHour = tzTime.getHours();
  const currentMinute = tzTime.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;
  const startMinutes = timeToMinutes(config.start);
  const endMinutes = timeToMinutes(config.end);

  // Check if today is an allowed day
  if (!config.days.includes(currentDay)) {
    return false;
  }

  // Check if current time is within allowed hours
  return currentTimeMinutes >= startMinutes && currentTimeMinutes < endMinutes;
}

// Calculate wait time until next valid schedule slot (in ms)
function calculateWaitTime(config: ScheduleConfig): number {
  const now = new Date();
  const tzTime = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
  
  const currentDay = tzTime.getDay();
  const currentHour = tzTime.getHours();
  const currentMinute = tzTime.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;
  const startMinutes = timeToMinutes(config.start);

  // If today is a valid day and we're before start time, wait until start
  if (config.days.includes(currentDay) && currentTimeMinutes < startMinutes) {
    const waitMinutes = startMinutes - currentTimeMinutes;
    return waitMinutes * 60 * 1000;
  }

  // Find next valid day
  let daysToWait = 1;
  for (let i = 1; i <= 7; i++) {
    const nextDay = (currentDay + i) % 7;
    if (config.days.includes(nextDay)) {
      daysToWait = i;
      break;
    }
  }

  // Calculate time until start of next valid day
  const hoursUntilMidnight = 24 - currentHour;
  const minutesUntilMidnight = hoursUntilMidnight * 60 - currentMinute;
  const totalMinutes = minutesUntilMidnight + (daysToWait - 1) * 24 * 60 + startMinutes;

  return totalMinutes * 60 * 1000;
}

// Self-reinvoke the function to continue processing
async function scheduleNextBatch(supabaseUrl: string, supabaseKey: string, dispatchId: string, delayMs: number): Promise<void> {
  console.log(`[BulkDispatch] Scheduling next batch in ${delayMs}ms for dispatch ${dispatchId}`);
  
  // Use setTimeout to delay, then invoke
  await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 5000))); // Max 5s delay for scheduling
  
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/process-bulk-dispatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ dispatchId }),
    });
    
    if (!response.ok) {
      console.error(`[BulkDispatch] Failed to schedule next batch:`, await response.text());
    } else {
      console.log(`[BulkDispatch] Next batch scheduled successfully for dispatch ${dispatchId}`);
    }
  } catch (err) {
    console.error(`[BulkDispatch] Error scheduling next batch:`, err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // @ts-ignore - Ignore type checking for Supabase client in edge functions
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { dispatchId } = await req.json();

    if (!dispatchId) {
      return new Response(JSON.stringify({ error: 'dispatchId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[BulkDispatch] Starting batch processing for dispatch: ${dispatchId}`);

    // Fetch dispatch with both template (rescue), marketing_campaign and meta_template
    const { data: dispatch, error: dispatchError } = await supabase
      .from('bulk_dispatches')
      .select('*, template:rescue_templates(*), channel:whatsapp_channels(*), marketing_campaign:marketing_campaigns(*), meta_template:meta_message_templates(*)')
      .eq('id', dispatchId)
      .single();

    if (dispatchError || !dispatch) {
      return new Response(JSON.stringify({ error: 'Dispatch not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (dispatch.status !== 'running') {
      console.log(`[BulkDispatch] Dispatch ${dispatchId} is not running (status: ${dispatch.status}), skipping`);
      return new Response(JSON.stringify({ message: 'Dispatch is not running', status: dispatch.status }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Process batch synchronously (not in background)
    const result = await processDispatchBatch(supabase, dispatch, supabaseUrl, supabaseKey);

    return new Response(JSON.stringify({ 
      message: 'Batch processed', 
      dispatchId,
      processed: result.processed,
      hasMore: result.hasMore,
      nextBatchScheduled: result.nextBatchScheduled
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const error = err as Error;
    console.error('[BulkDispatch] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// Generate contacts from filters if not already generated - uses server-side RPC
async function generateContactsFromFilters(supabase: any, dispatch: any): Promise<number> {
  const filters = dispatch.filters || {};
  const tenantId = dispatch.tenant_id;

  console.log(`[BulkDispatch] Generating contacts from filters using RPC:`, JSON.stringify(filters));

  // Resolve leadStatusIds to lead_status names
  let leadStatusNames: string[] = [];
  if (filters.leadStatusIds && filters.leadStatusIds.length > 0) {
    const { data: statuses } = await supabase
      .from('lead_statuses')
      .select('name')
      .in('id', filters.leadStatusIds);
    leadStatusNames = statuses?.map((s: { name: string }) => s.name) || [];
    console.log(`[BulkDispatch] Resolved lead status names:`, leadStatusNames);
  }

  // Use the RPC function to get contacts with all filters applied server-side
  // This handles all complex filtering including lastClientMessageDaysAgo
  const PAGE_SIZE = 500;
  let offset = 0;
  let allContactIds: string[] = [];
  let hasMore = true;

  while (hasMore) {
    const { data: contacts, error } = await supabase.rpc('get_bulk_dispatch_preview_contacts', {
      p_tenant_id: tenantId,
      p_lead_status_names: leadStatusNames.length > 0 ? leadStatusNames : null,
      p_last_client_message_days_ago: filters.lastClientMessageDaysAgo || null,
      p_tag_ids: filters.tagIds?.length ? filters.tagIds : null,
      p_conversation_statuses: filters.conversationStatus?.length ? filters.conversationStatus : null,
      p_segment_id: filters.segmentId || null,
      p_origin: filters.origin || null,
      p_assigned_to: filters.assignedTo?.length ? filters.assignedTo : null,
      p_department_ids: filters.departmentIds?.length ? filters.departmentIds : null,
      p_contact_type: filters.contactType || null,
      p_include_blocked: filters.includeBlocked || false,
      p_first_contact_start: filters.firstContactStart || null,
      p_first_contact_end: filters.firstContactEnd ? filters.firstContactEnd + 'T23:59:59' : null,
      p_close_reason_ids: filters.closeReasonIds?.length ? filters.closeReasonIds : null,
      p_offset_val: offset,
      p_limit_val: PAGE_SIZE,
    });

    if (error) {
      console.error(`[BulkDispatch] Error calling RPC:`, error);
      return 0;
    }

    if (contacts && contacts.length > 0) {
      allContactIds = [...allContactIds, ...contacts.map((c: { id: string }) => c.id)];
      offset += PAGE_SIZE;
      hasMore = contacts.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  if (allContactIds.length === 0) {
    console.log(`[BulkDispatch] No contacts found matching filters`);
    return 0;
  }

  console.log(`[BulkDispatch] Found ${allContactIds.length} contacts matching filters`);

  // Insert contacts into bulk_dispatch_contacts in batches
  const contactRecords = allContactIds.map((id: string) => ({
    dispatch_id: dispatch.id,
    contact_id: id,
    tenant_id: tenantId,
    status: 'pending',
  }));

  const batchSize = 500;
  for (let i = 0; i < contactRecords.length; i += batchSize) {
    const batch = contactRecords.slice(i, i + batchSize);
    const { error: insertError } = await supabase.from('bulk_dispatch_contacts').insert(batch);
    if (insertError) {
      console.error(`[BulkDispatch] Error inserting contacts batch:`, insertError);
    }
  }

  console.log(`[BulkDispatch] Generated ${allContactIds.length} contacts from filters`);
  return allContactIds.length;
}

interface BatchResult {
  processed: number;
  hasMore: boolean;
  nextBatchScheduled: boolean;
}

// @ts-ignore - Using any types for edge function flexibility
async function processDispatchBatch(supabase: any, dispatch: any, supabaseUrl: string, supabaseKey: string): Promise<BatchResult> {
  const startTime = Date.now();
  const baseIntervalMs = dispatch.interval_seconds * 1000;
  const channel = dispatch.channel;

  // Determine campaign type
  const isMarketingCampaign = dispatch.campaign_type === 'marketing';
  const isMetaTemplateCampaign = dispatch.campaign_type === 'template_meta';
  const isFollowupCampaign = dispatch.campaign_type === 'followup' || (!isMarketingCampaign && !isMetaTemplateCampaign);
  const template = dispatch.template;
  const marketingCampaign = dispatch.marketing_campaign;
  const metaTemplate = dispatch.meta_template;

  console.log(`[BulkDispatch] Campaign type: ${dispatch.campaign_type}, isMarketing: ${isMarketingCampaign}, isMetaTemplate: ${isMetaTemplateCampaign}`);

  // Check if contacts already generated, if not generate from filters
  const { count: existingCount } = await supabase
    .from('bulk_dispatch_contacts')
    .select('*', { count: 'exact', head: true })
    .eq('dispatch_id', dispatch.id);

  console.log(`[BulkDispatch] Existing contacts in bulk_dispatch_contacts: ${existingCount}`);

  if (!existingCount || existingCount === 0) {
    console.log(`[BulkDispatch] No contacts found, generating from filters...`);
    const generatedCount = await generateContactsFromFilters(supabase, dispatch);

    if (generatedCount === 0) {
      console.log(`[BulkDispatch] No contacts match filters, marking as completed`);
      await supabase
        .from('bulk_dispatches')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', dispatch.id);
      return { processed: 0, hasMore: false, nextBatchScheduled: false };
    }

    // Update total_contacts with actual count
    await supabase
      .from('bulk_dispatches')
      .update({ total_contacts: generatedCount })
      .eq('id', dispatch.id);

    dispatch.total_contacts = generatedCount;
  }

  // Validate we have the correct data for the campaign type
  if (isMarketingCampaign && !marketingCampaign) {
    console.error(`[BulkDispatch] Marketing campaign not found for dispatch ${dispatch.id}`);
    await supabase
      .from('bulk_dispatches')
      .update({ status: 'error', completed_at: new Date().toISOString() })
      .eq('id', dispatch.id);
    return { processed: 0, hasMore: false, nextBatchScheduled: false };
  }

  if (isMetaTemplateCampaign && !metaTemplate) {
    console.error(`[BulkDispatch] Meta template not found for dispatch ${dispatch.id}`);
    await supabase
      .from('bulk_dispatches')
      .update({ status: 'error', completed_at: new Date().toISOString() })
      .eq('id', dispatch.id);
    return { processed: 0, hasMore: false, nextBatchScheduled: false };
  }

  if (isFollowupCampaign && !template) {
    console.error(`[BulkDispatch] Rescue template not found for dispatch ${dispatch.id}`);
    await supabase
      .from('bulk_dispatches')
      .update({ status: 'error', completed_at: new Date().toISOString() })
      .eq('id', dispatch.id);
    return { processed: 0, hasMore: false, nextBatchScheduled: false };
  }

  // For Meta template campaigns, we don't need steps
  let steps: (RescueStep | MarketingStep)[] = [];
  let firstStep: RescueStep | MarketingStep | null = null;
  
  if (!isMetaTemplateCampaign) {
    // Get steps based on campaign type
    steps = isMarketingCampaign 
      ? (marketingCampaign.steps as MarketingStep[]) || []
      : (template.steps as RescueStep[]) || [];

    firstStep = steps[0] || null;
    if (!firstStep) {
      console.error(`[BulkDispatch] No steps found in ${isMarketingCampaign ? 'marketing campaign' : 'template'}`);
      await supabase
        .from('bulk_dispatches')
        .update({ status: 'error', completed_at: new Date().toISOString() })
        .eq('id', dispatch.id);
      return { processed: 0, hasMore: false, nextBatchScheduled: false };
    }
  }

  // channel_id "vazio" (null/undefined) indica que deve usar o canal da conversa existente
  const useExistingChannel = !dispatch.channel_id || dispatch.channel_id === '__existing__';

  console.log(
    `[BulkDispatch] Dispatch ${dispatch.id} channel_id=${String(dispatch.channel_id)} | useExistingChannel=${useExistingChannel}`,
  );

  // Get schedule configuration
  const scheduleConfig = await getScheduleConfig(supabase, dispatch);
  console.log(`[BulkDispatch] Schedule config: enabled=${scheduleConfig.enabled}, days=${scheduleConfig.days.join(',')}, hours=${scheduleConfig.start}-${scheduleConfig.end}, tz=${scheduleConfig.timezone}`);

  // Check if within schedule
  if (scheduleConfig.enabled && !isWithinSchedule(scheduleConfig)) {
    const waitMs = calculateWaitTime(scheduleConfig);
    console.log(`[BulkDispatch] Outside schedule. Will retry in ${Math.round(waitMs / 60000)} minutes`);
    
    // Schedule next batch for when schedule allows (max 30 minutes from now to keep checking)
    const nextCheckMs = Math.min(waitMs, 30 * 60 * 1000);
    scheduleNextBatch(supabaseUrl, supabaseKey, dispatch.id, nextCheckMs);
    
    return { processed: 0, hasMore: true, nextBatchScheduled: true };
  }

  let processedCount = 0;

  while (processedCount < MAX_CONTACTS_PER_BATCH) {
    // Check execution time
    const elapsed = Date.now() - startTime;
    if (elapsed > MAX_EXECUTION_TIME_MS) {
      console.log(`[BulkDispatch] Approaching timeout (${elapsed}ms), scheduling next batch`);
      break;
    }

    // Check if dispatch is still running
    const { data: currentDispatch } = await supabase
      .from('bulk_dispatches')
      .select('status')
      .eq('id', dispatch.id)
      .single();

    if (!currentDispatch || currentDispatch.status !== 'running') {
      console.log(`[BulkDispatch] Dispatch ${dispatch.id} stopped (status: ${currentDispatch?.status})`);
      return { processed: processedCount, hasMore: false, nextBatchScheduled: false };
    }

    // Get next pending contact
    const { data: pendingContacts } = await supabase
      .from('bulk_dispatch_contacts')
      .select('*, contact:contacts(*)')
      .eq('dispatch_id', dispatch.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);

    if (!pendingContacts || pendingContacts.length === 0) {
      console.log(`[BulkDispatch] No more pending contacts for dispatch ${dispatch.id}`);
      await supabase
        .from('bulk_dispatches')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', dispatch.id);
      return { processed: processedCount, hasMore: false, nextBatchScheduled: false };
    }

    const dispatchContact = pendingContacts[0];
    const contact = dispatchContact.contact;

    console.log(`[BulkDispatch] Processing contact: ${contact.full_name} (${contact.phone})`);

    try {
      // === DEDUPLICATION: Skip if same template was sent to this number recently ===
      if (isMetaTemplateCampaign && metaTemplate) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: recentlySent } = await supabase
          .from('bulk_dispatch_contacts')
          .select('id')
          .neq('dispatch_id', dispatch.id)
          .eq('contact_id', contact.id)
          .eq('status', 'sent')
          .gte('sent_at', oneHourAgo)
          .limit(1);

        // Check if the recent dispatch used the same meta_template_id
        if (recentlySent && recentlySent.length > 0) {
          const { data: recentDispatch } = await supabase
            .from('bulk_dispatch_contacts')
            .select('dispatch:bulk_dispatches!bulk_dispatch_contacts_dispatch_id_fkey(meta_template_id)')
            .eq('id', recentlySent[0].id)
            .single();

          const recentMetaTemplateId = (recentDispatch as any)?.dispatch?.meta_template_id;
          if (recentMetaTemplateId === dispatch.meta_template_id) {
            console.log(`[BulkDispatch] SKIPPING contact ${contact.full_name} - same template sent within last hour`);
            await supabase
              .from('bulk_dispatch_contacts')
              .update({ status: 'skipped', error_message: 'Template já enviado recentemente para este contato' })
              .eq('id', dispatchContact.id);

            await supabase
              .from('bulk_dispatches')
              .update({
                processed_count: dispatch.processed_count + 1,
                skipped_count: (dispatch.skipped_count || 0) + 1,
              })
              .eq('id', dispatch.id);

            dispatch.processed_count++;
            dispatch.skipped_count = (dispatch.skipped_count || 0) + 1;
            processedCount++;
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
        }
      }

      // Mark as sending
      await supabase
        .from('bulk_dispatch_contacts')
        .update({ status: 'sending' })
        .eq('id', dispatchContact.id);

      // Determine which channel to use
      let effectiveChannelId = channel?.id;

      if (useExistingChannel) {
        // Find existing conversation for this contact WITH channel status
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id, channel_id, channel:whatsapp_channels(id, status)')
          .eq('contact_id', contact.id)
          .not('channel_id', 'is', null)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .single();

        if (existingConv?.channel_id) {
          // Check if the channel is connected
          const channelStatus = existingConv.channel?.status;
          if (channelStatus !== 'connected') {
            console.log(`[BulkDispatch] Channel ${existingConv.channel_id} is disconnected (status: ${channelStatus}), skipping contact ${contact.id}`);
            await supabase
              .from('bulk_dispatch_contacts')
              .update({ status: 'skipped', error_message: 'Canal desconectado' })
              .eq('id', dispatchContact.id);

            await supabase
              .from('bulk_dispatches')
              .update({
                processed_count: dispatch.processed_count + 1,
                skipped_count: (dispatch.skipped_count || 0) + 1,
              })
              .eq('id', dispatch.id);

            dispatch.processed_count++;
            dispatch.skipped_count = (dispatch.skipped_count || 0) + 1;
            processedCount++;
            
            // Short delay before next contact
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }

          effectiveChannelId = existingConv.channel_id;
          console.log(`[BulkDispatch] Using existing channel ${effectiveChannelId} for contact ${contact.id}`);
        } else {
          // No existing conversation with channel - skip this contact
          console.log(`[BulkDispatch] Contact ${contact.id} has no existing conversation with channel, skipping`);
          await supabase
            .from('bulk_dispatch_contacts')
            .update({ status: 'skipped', error_message: 'Contato sem conversa existente com canal' })
            .eq('id', dispatchContact.id);

          await supabase
            .from('bulk_dispatches')
            .update({
              processed_count: dispatch.processed_count + 1,
              skipped_count: (dispatch.skipped_count || 0) + 1,
            })
            .eq('id', dispatch.id);

          dispatch.processed_count++;
          dispatch.skipped_count = (dispatch.skipped_count || 0) + 1;
          processedCount++;
          
          // Short delay before next contact
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
      }

      if (!effectiveChannelId) {
        throw new Error('No channel available for sending');
      }

      // Get or create conversation
      let conversationId = dispatchContact.conversation_id;

      if (!conversationId) {
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contact.id)
          .eq('channel_id', effectiveChannelId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existingConv) {
          conversationId = existingConv.id;
        } else {
          // Fetch original conversation from any channel to inherit attributes
          const { data: originalConv } = await supabase
            .from('conversations')
            .select('assigned_to, department_id')
            .eq('contact_id', contact.id)
            .not('channel_id', 'is', null)
            .order('last_message_at', { ascending: false })
            .limit(1)
            .single();

          // Also fetch contact data as fallback for attributes
          const { data: contactData } = await supabase
            .from('contacts')
            .select('assigned_to, department_id')
            .eq('id', contact.id)
            .single();

          // Determine inherited attributes (prioritize original conversation, then contact)
          const inheritedAssignedTo = originalConv?.assigned_to || contactData?.assigned_to || null;
          const inheritedDepartmentId = originalConv?.department_id || contactData?.department_id || null;

          console.log(`[BulkDispatch] Creating new conversation for contact ${contact.id} - inheriting assigned_to: ${inheritedAssignedTo}, department_id: ${inheritedDepartmentId}`);

          const { data: newConv } = await supabase
            .from('conversations')
            .insert({ 
              contact_id: contact.id, 
              channel_id: effectiveChannelId, 
              status: 'open',
              assigned_to: inheritedAssignedTo,
              department_id: inheritedDepartmentId
            })
            .select()
            .single();
          conversationId = newConv?.id;
        }

        await supabase
          .from('bulk_dispatch_contacts')
          .update({ conversation_id: conversationId })
          .eq('id', dispatchContact.id);
      }

      let activeRecordId: string | null = null;

      // Handle Meta Template campaign - simple send without steps/follow-up
      if (isMetaTemplateCampaign) {
        console.log(`[BulkDispatch] Sending Meta template: ${metaTemplate.name}`);
        
        await sendMetaTemplateMessage(
          supabase,
          supabaseUrl,
          supabaseKey,
          effectiveChannelId,
          conversationId,
          contact.id,
          contact.phone,
          metaTemplate,
          dispatch.meta_template_variables,
          contact
        );

        console.log(`[BulkDispatch] Meta template sent successfully to ${contact.phone}`);
      } else if (isMarketingCampaign) {
        console.log(`[BulkDispatch] Marketing campaign config - initial_department_id: ${marketingCampaign.initial_department_id}, initial_user_id: ${marketingCampaign.initial_user_id}`);
        
        // Build update object for both department and user transfer
        const updateData: Record<string, any> = {};
        
        // Apply initial department transfer if configured
        if (marketingCampaign.initial_department_id) {
          updateData.department_id = marketingCampaign.initial_department_id;
        }
        
        // Apply initial user transfer if configured
        if (marketingCampaign.initial_user_id) {
          updateData.assigned_to = marketingCampaign.initial_user_id;
        }
        
        // Apply both updates in a single query for consistency
        if (Object.keys(updateData).length > 0) {
          const { error: transferError } = await supabase
            .from('conversations')
            .update(updateData)
            .eq('id', conversationId);
          
          if (transferError) {
            console.error(`[BulkDispatch] Error transferring conversation:`, transferError);
          } else {
            if (updateData.department_id) {
              console.log(`[BulkDispatch] Transferred conversation ${conversationId} to department ${updateData.department_id}`);
            }
            if (updateData.assigned_to) {
              console.log(`[BulkDispatch] Assigned conversation ${conversationId} to user ${updateData.assigned_to}`);
            }
          }
        }

        // Create active marketing campaign
        const { data: activeMarketing, error: marketingError } = await supabase
          .from('active_marketing_campaigns')
          .insert({
            campaign_id: marketingCampaign.id,
            contact_id: contact.id,
            conversation_id: conversationId,
            dispatch_id: dispatch.id,
            tenant_id: dispatch.tenant_id,
            current_step: 0,
            status: 'active',
            next_send_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (marketingError) {
          console.error(`[BulkDispatch] Error creating active marketing campaign:`, marketingError);
          throw new Error(`Failed to create active marketing campaign: ${marketingError.message}`);
        }

        activeRecordId = activeMarketing?.id;
        console.log(`[BulkDispatch] Created active marketing campaign: ${activeRecordId}`);

        if (activeMarketing && firstStep) {
          const messageContent = replaceVariables(firstStep.message, contact, '');
          
          // SEND FIRST MESSAGE IMMEDIATELY
          await sendMessageDirectly(
            supabase,
            supabaseUrl,
            supabaseKey,
            effectiveChannelId,
            conversationId,
            contact.id,
            contact.phone,
            messageContent,
            firstStep.audio_url,
            firstStep.attachment_url,
            dispatch.tenant_id,
            firstStep.attachment_type
          );

          // Record as already sent in marketing_scheduled_messages
          const { error: scheduleError } = await supabase
            .from('marketing_scheduled_messages')
            .insert({
              active_campaign_id: activeMarketing.id,
              step_number: 0,
              scheduled_for: new Date().toISOString(),
              status: 'sent',
              sent_at: new Date().toISOString(),
              content: messageContent,
              audio_url: firstStep.audio_url || null,
              attachment_url: firstStep.attachment_url || null,
              attachment_type: firstStep.attachment_type || null,
              tenant_id: dispatch.tenant_id,
            });

          if (scheduleError) {
            console.error(`[BulkDispatch] Error recording marketing message:`, scheduleError);
          } else {
            console.log(`[BulkDispatch] Sent first marketing message for campaign ${activeMarketing.id}`);
          }
        }
      } else if (isFollowupCampaign && firstStep) {
        // Create active rescue (follow-up)
        const { data: activeRescue, error: rescueError } = await supabase
          .from('active_rescues')
          .insert({
            conversation_id: conversationId,
            contact_id: contact.id,
            template_id: template.id,
            status: 'active',
            current_step: 0,
            next_send_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (rescueError) {
          console.error(`[BulkDispatch] Error creating active rescue:`, rescueError);
          throw new Error(`Failed to create active rescue: ${rescueError.message}`);
        }

        activeRecordId = activeRescue?.id;
        console.log(`[BulkDispatch] Created active rescue: ${activeRecordId}`);

        if (activeRescue) {
          const messageContent = replaceVariables(firstStep.message, contact, '');
          
          // SEND FIRST MESSAGE IMMEDIATELY
          await sendMessageDirectly(
            supabase,
            supabaseUrl,
            supabaseKey,
            effectiveChannelId,
            conversationId,
            contact.id,
            contact.phone,
            messageContent,
            firstStep.audio_url,
            firstStep.attachment_url,
            dispatch.tenant_id,
            firstStep.attachment_type
          );

          // Record as already sent in rescue_scheduled_messages
          const { error: scheduleError } = await supabase
            .from('rescue_scheduled_messages')
            .insert({
              rescue_id: activeRescue.id,
              step_number: 0,
              scheduled_for: new Date().toISOString(),
              status: 'sent',
              sent_at: new Date().toISOString(),
              content: messageContent,
              audio_url: firstStep.audio_url || null,
              attachment_url: firstStep.attachment_url || null,
              attachment_type: firstStep.attachment_type || null,
            });

          if (scheduleError) {
            console.error(`[BulkDispatch] Error recording rescue message:`, scheduleError);
          } else {
            console.log(`[BulkDispatch] Sent first rescue message for rescue ${activeRescue.id}`);
          }
        }
      }

      // Update contact as sent
      await supabase
        .from('bulk_dispatch_contacts')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          active_rescue_id: isFollowupCampaign ? activeRecordId : null,
        })
        .eq('id', dispatchContact.id);

      // Update metrics
      await supabase
        .from('bulk_dispatches')
        .update({
          processed_count: dispatch.processed_count + 1,
          sent_count: dispatch.sent_count + 1,
        })
        .eq('id', dispatch.id);

      dispatch.processed_count++;
      dispatch.sent_count++;
      processedCount++;

      console.log(`[BulkDispatch] Successfully processed contact: ${contact.full_name} (${isMetaTemplateCampaign ? 'meta_template' : isMarketingCampaign ? 'marketing' : 'rescue'})`);

    } catch (err) {
      const error = err as Error;
      console.error(`[BulkDispatch] Error processing contact ${contact.id}:`, error);

      await supabase
        .from('bulk_dispatch_contacts')
        .update({ status: 'error', error_message: error.message })
        .eq('id', dispatchContact.id);

      await supabase
        .from('bulk_dispatches')
        .update({
          processed_count: dispatch.processed_count + 1,
          error_count: dispatch.error_count + 1,
        })
        .eq('id', dispatch.id);

      dispatch.processed_count++;
      dispatch.error_count++;
      processedCount++;
    }

    // Wait interval between contacts (use randomized but capped at 10 seconds per contact within batch)
    const intervalForBatch = Math.min(getRandomizedInterval(baseIntervalMs), 10000);
    console.log(`[BulkDispatch] Waiting ${intervalForBatch}ms before next contact in batch`);
    await new Promise(resolve => setTimeout(resolve, intervalForBatch));
  }

  // Check if there are more pending contacts
  const { count: remainingCount } = await supabase
    .from('bulk_dispatch_contacts')
    .select('*', { count: 'exact', head: true })
    .eq('dispatch_id', dispatch.id)
    .eq('status', 'pending');

  const hasMore = (remainingCount || 0) > 0;

  if (hasMore) {
    console.log(`[BulkDispatch] ${remainingCount} contacts remaining, scheduling next batch`);
    
    // Calculate delay for next batch based on interval setting
    // If interval is longer than 10s, we need to respect it
    const nextBatchDelay = Math.max(baseIntervalMs - 10000, 1000); // At least 1 second
    
    // Schedule next batch (this will be async after response)
    scheduleNextBatch(supabaseUrl, supabaseKey, dispatch.id, nextBatchDelay);
    
    return { processed: processedCount, hasMore: true, nextBatchScheduled: true };
  }

  // All done
  console.log(`[BulkDispatch] Finished processing dispatch ${dispatch.id}`);
  await supabase
    .from('bulk_dispatches')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', dispatch.id);

  return { processed: processedCount, hasMore: false, nextBatchScheduled: false };
}
