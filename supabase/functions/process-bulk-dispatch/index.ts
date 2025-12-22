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

// @ts-ignore - Using any types for edge function flexibility
async function processDispatch(supabase: any, dispatch: any) {
  const intervalMs = dispatch.interval_seconds * 1000;
  const template = dispatch.template;
  const channel = dispatch.channel;

  console.log(`[BulkDispatch] Processing dispatch ${dispatch.id} with ${dispatch.total_contacts} contacts`);

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

      // Get or create conversation
      let conversationId = dispatchContact.conversation_id;

      if (!conversationId) {
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contact.id)
          .eq('channel_id', channel.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existingConv) {
          conversationId = existingConv.id;
        } else {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({ contact_id: contact.id, channel_id: channel.id, status: 'open' })
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
        // Schedule first message
        await supabase
          .from('rescue_scheduled_messages')
          .insert({
            active_rescue_id: activeRescue.id,
            step_index: 0,
            scheduled_for: new Date().toISOString(),
            status: 'pending',
            message_text: firstStep.message,
            audio_url: firstStep.audio_url || null,
            attachment_url: firstStep.attachment_url || null,
            attachment_type: firstStep.attachment_type || null,
          });
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

    // Wait interval before next contact
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  console.log(`[BulkDispatch] Finished processing dispatch ${dispatch.id}`);
}
