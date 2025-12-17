import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('[process-rescue-messages] Starting processing...')

    // Find pending messages that are due
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('rescue_scheduled_messages')
      .select(`
        *,
        rescue:active_rescues(
          id,
          conversation_id,
          contact_id,
          status,
          template_id,
          current_step,
          template:rescue_templates(steps, final_action, final_action_config)
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(50)

    if (fetchError) {
      console.error('[process-rescue-messages] Error fetching messages:', fetchError)
      throw fetchError
    }

    console.log(`[process-rescue-messages] Found ${pendingMessages?.length || 0} pending messages`)

    let processed = 0
    let errors = 0

    for (const msg of pendingMessages || []) {
      // Skip if rescue is no longer active
      if (msg.rescue?.status !== 'active') {
        await supabase
          .from('rescue_scheduled_messages')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', msg.id)
        continue
      }

      try {
        // Get conversation and channel info
        const { data: conversation } = await supabase
          .from('conversations')
          .select('channel_id, contact:contacts(phone)')
          .eq('id', msg.rescue.conversation_id)
          .single()

        const contactPhone = (conversation?.contact as any)?.[0]?.phone || (conversation?.contact as any)?.phone

        if (!conversation?.channel_id || !contactPhone) {
          console.error('[process-rescue-messages] Missing channel or phone for message:', msg.id)
          errors++
          continue
        }

        // Get channel config
        const { data: channel } = await supabase
          .from('whatsapp_channels')
          .select('*')
          .eq('id', conversation.channel_id)
          .single()

        if (!channel) {
          console.error('[process-rescue-messages] Channel not found:', conversation.channel_id)
          errors++
          continue
        }

        // Send message via WhatsApp API (simplified - you may need to adapt to your WhatsApp adapter)
        console.log(`[process-rescue-messages] Sending message to ${contactPhone}: ${msg.content.substring(0, 50)}...`)
        
        // Insert message into messages table
        const { error: msgError } = await supabase
          .from('messages')
          .insert({
            conversation_id: msg.rescue.conversation_id,
            contact_id: msg.rescue.contact_id,
            content: msg.content,
            is_from_me: true,
            message_type: 'text',
            status: 'sent',
          })

        if (msgError) {
          console.error('[process-rescue-messages] Error inserting message:', msgError)
          errors++
          continue
        }

        // Mark scheduled message as sent
        await supabase
          .from('rescue_scheduled_messages')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', msg.id)

        // Update rescue current_step
        const steps = msg.rescue.template?.steps || []
        const nextStep = msg.step_number + 1

        if (nextStep >= steps.length) {
          // Last message - execute final action
          const finalAction = msg.rescue.template?.final_action
          const finalConfig = msg.rescue.template?.final_action_config || {}

          if (finalAction === 'close') {
            await supabase
              .from('conversations')
              .update({
                status: 'closed',
                close_reason: finalConfig.close_reason_id || 'rescue_completed',
                closed_at: new Date().toISOString(),
              })
              .eq('id', msg.rescue.conversation_id)
          } else if (finalAction === 'transfer' && finalConfig.department_id) {
            await supabase
              .from('conversations')
              .update({
                department_id: finalConfig.department_id,
                assigned_to: null,
              })
              .eq('id', msg.rescue.conversation_id)
          }

          // Mark rescue as completed
          await supabase
            .from('active_rescues')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', msg.rescue.id)
        } else {
          // Update to next step
          const nextTimer = steps[nextStep]?.timer_minutes || 60
          const nextSendAt = new Date(Date.now() + nextTimer * 60 * 1000)

          await supabase
            .from('active_rescues')
            .update({ current_step: nextStep, next_send_at: nextSendAt.toISOString() })
            .eq('id', msg.rescue.id)
        }

        processed++
      } catch (err) {
        console.error('[process-rescue-messages] Error processing message:', msg.id, err)
        errors++
      }
    }

    console.log(`[process-rescue-messages] Done. Processed: ${processed}, Errors: ${errors}`)

    return new Response(
      JSON.stringify({ success: true, processed, errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    console.error('[process-rescue-messages] Fatal error:', error)
    return new Response(
      JSON.stringify({ error: error?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
