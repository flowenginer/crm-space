import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// RescueStep interface
interface RescueStep {
  message: string;
  timer_minutes: number;
  audio_url?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
}

// Function to generate randomized interval (±30% variation)
function getRandomizedInterval(baseMs: number): number {
  const variationPercent = 0.3;
  const minMs = Math.floor(baseMs * (1 - variationPercent));
  const maxMs = Math.floor(baseMs * (1 + variationPercent));
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
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
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

  // Check if today is an allowed day
  if (!config.days.includes(currentDay)) {
    return false;
  }

  // Check if current time is within allowed hours
  return currentTimeStr >= config.start && currentTimeStr < config.end;
}

// Calculate wait time until next valid schedule slot (in ms)
function calculateWaitTime(config: ScheduleConfig): number {
  const now = new Date();
  const tzTime = new Date(now.toLocaleString('en-US', { timeZone: config.timezone }));
  
  const currentDay = tzTime.getDay();
  const currentHour = tzTime.getHours();
  const currentMinute = tzTime.getMinutes();
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

  // If today is a valid day and we're before start time, wait until start
  if (config.days.includes(currentDay) && currentTimeStr < config.start) {
    const [startHour, startMinute] = config.start.split(':').map(Number);
    const waitMinutes = (startHour - currentHour) * 60 + (startMinute - currentMinute);
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
  const [startHour, startMinute] = config.start.split(':').map(Number);
  const hoursUntilMidnight = 24 - currentHour;
  const totalHours = hoursUntilMidnight + (daysToWait - 1) * 24 + startHour;
  const totalMinutes = totalHours * 60 - currentMinute + startMinute;

  return totalMinutes * 60 * 1000;
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

    console.log(`[BulkDispatch] Starting processing for dispatch: ${dispatchId}`);

    const { data: dispatch, error: dispatchError } = await supabase
      .from('bulk_dispatches')
      .select('*, template:rescue_templates(*), channel:whatsapp_channels(*)')
      .eq('id', dispatchId)
      .single();

    if (dispatchError || !dispatch) {
      return new Response(JSON.stringify({ error: 'Dispatch not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (dispatch.status !== 'running') {
      return new Response(JSON.stringify({ message: 'Dispatch is not running', status: dispatch.status }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Process in background using async IIFE
    (async () => {
      await processDispatch(supabase, dispatch);
    })();

    return new Response(JSON.stringify({ message: 'Processing started', dispatchId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    const error = err as Error;
    console.error('[BulkDispatch] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

// @ts-ignore - Using any types for edge function flexibility
async function processDispatch(supabase: any, dispatch: any) {
  const baseIntervalMs = dispatch.interval_seconds * 1000;
  const template = dispatch.template;
  const channel = dispatch.channel;

  // channel_id "vazio" (null/undefined) indica que deve usar o canal da conversa existente
  const useExistingChannel = !dispatch.channel_id;

  console.log(
    `[BulkDispatch] Dispatch ${dispatch.id} channel_id=${String(dispatch.channel_id)} (type=${typeof dispatch.channel_id}) | useExistingChannel=${useExistingChannel}`,
  );

  // Get schedule configuration once at start
  const scheduleConfig = await getScheduleConfig(supabase, dispatch);
  console.log(`[BulkDispatch] Schedule config: enabled=${scheduleConfig.enabled}, days=${scheduleConfig.days.join(',')}, hours=${scheduleConfig.start}-${scheduleConfig.end}, tz=${scheduleConfig.timezone}`);

  while (true) {
    // Check if dispatch is still running
    const { data: currentDispatch } = await supabase
      .from('bulk_dispatches')
      .select('status')
      .eq('id', dispatch.id)
      .single();

    if (!currentDispatch || currentDispatch.status !== 'running') {
      console.log(`[BulkDispatch] Dispatch ${dispatch.id} stopped (status: ${currentDispatch?.status})`);
      break;
    }

    // Check if within schedule
    if (scheduleConfig.enabled && !isWithinSchedule(scheduleConfig)) {
      const waitMs = calculateWaitTime(scheduleConfig);
      // Cap wait time at 60 seconds to allow status checks
      const actualWaitMs = Math.min(waitMs, 60000);
      console.log(`[BulkDispatch] Outside schedule. Waiting ${Math.round(actualWaitMs / 1000)}s (full wait: ${Math.round(waitMs / 60000)} min)`);
      await new Promise(resolve => setTimeout(resolve, actualWaitMs));
      continue;
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
      break;
    }

    const dispatchContact = pendingContacts[0];
    const contact = dispatchContact.contact;

    console.log(`[BulkDispatch] Processing contact: ${contact.full_name} (${contact.phone})`);

    try {
      // Mark as sending
      await supabase
        .from('bulk_dispatch_contacts')
        .update({ status: 'sending' })
        .eq('id', dispatchContact.id);

      // Determine which channel to use
      let effectiveChannelId = channel?.id;

      if (useExistingChannel) {
        // Find existing conversation for this contact
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id, channel_id')
          .eq('contact_id', contact.id)
          .not('channel_id', 'is', null)
          .order('last_message_at', { ascending: false })
          .limit(1)
          .single();

        if (existingConv?.channel_id) {
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
            })
            .eq('id', dispatch.id);

      dispatch.processed_count++;
      const skipInterval = getRandomizedInterval(baseIntervalMs);
      console.log(`[BulkDispatch] Waiting ${skipInterval}ms before next contact`);
      await new Promise(resolve => setTimeout(resolve, skipInterval));
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
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({ contact_id: contact.id, channel_id: effectiveChannelId, status: 'open' })
            .select()
            .single();
          conversationId = newConv?.id;
        }

        await supabase
          .from('bulk_dispatch_contacts')
          .update({ conversation_id: conversationId })
          .eq('id', dispatchContact.id);
      }

      // Create active rescue
      const steps = (template.steps as RescueStep[]) || [];
      const firstStep = steps[0];

      if (!firstStep) {
        throw new Error('Template has no steps');
      }

      const { data: activeRescue } = await supabase
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

      if (activeRescue) {
        // Schedule first message - USING CORRECT COLUMN NAMES
        const { error: scheduleError } = await supabase
          .from('rescue_scheduled_messages')
          .insert({
            rescue_id: activeRescue.id,
            step_number: 0,
            scheduled_for: new Date().toISOString(),
            status: 'pending',
            content: replaceVariables(firstStep.message, contact, ''),
            audio_url: firstStep.audio_url || null,
            attachment_url: firstStep.attachment_url || null,
            attachment_type: firstStep.attachment_type || null,
          });

        if (scheduleError) {
          console.error(`[BulkDispatch] Error scheduling message:`, scheduleError);
        } else {
          console.log(`[BulkDispatch] Scheduled message for rescue ${activeRescue.id}`);
        }
      }

      // Update contact as sent
      await supabase
        .from('bulk_dispatch_contacts')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          active_rescue_id: activeRescue?.id,
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

      console.log(`[BulkDispatch] Successfully processed contact: ${contact.full_name}`);

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
    }

    // Wait randomized interval before next contact
    const randomInterval = getRandomizedInterval(baseIntervalMs);
    console.log(`[BulkDispatch] Waiting ${randomInterval}ms before next contact`);
    await new Promise(resolve => setTimeout(resolve, randomInterval));
  }

  console.log(`[BulkDispatch] Finished processing dispatch ${dispatch.id}`);
}
