import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RescueStep {
  message: string;
  timer_minutes: number;
  audio_url?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
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

// Function to generate randomized interval (±30% variation)
function getRandomizedInterval(baseMs: number): number {
  const variationPercent = 0.3;
  const minMs = Math.floor(baseMs * (1 - variationPercent));
  const maxMs = Math.floor(baseMs * (1 + variationPercent));
  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

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
            content: firstStep.message,
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
