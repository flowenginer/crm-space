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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
        console.log(`[process-rescue-messages] Rescue ${msg.rescue?.id} not active, cancelling message`)
        await supabase
          .from('rescue_scheduled_messages')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', msg.id)
        continue
      }

      try {
        // Get conversation and channel info
        const { data: conversation, error: convError } = await supabase
          .from('conversations')
          .select('channel_id')
          .eq('id', msg.rescue.conversation_id)
          .single()

        if (convError || !conversation?.channel_id) {
          console.error('[process-rescue-messages] Missing channel for message:', msg.id, convError)
          errors++
          continue
        }

        // Get contact phone
        const { data: contact, error: contactError } = await supabase
          .from('contacts')
          .select('phone')
          .eq('id', msg.rescue.contact_id)
          .single()

        if (contactError || !contact?.phone) {
          console.error('[process-rescue-messages] Missing phone for message:', msg.id, contactError)
          errors++
          continue
        }

        // Determine message type and media URL
        let messageType = 'text'
        let mediaUrl: string | null = null
        
        if (msg.audio_url) {
          messageType = 'audio'
          mediaUrl = msg.audio_url
        } else if (msg.attachment_url) {
          messageType = msg.attachment_type || 'document'
          mediaUrl = msg.attachment_url
        }
        
        console.log(`[process-rescue-messages] Sending ${messageType} message to ${contact.phone}: ${msg.content?.substring(0, 50) || '(media)'}...`)
        
        // SEND MESSAGE VIA WHATSAPP API
        const sendResponse = await fetch(`${supabaseUrl}/functions/v1/whatsapp-instance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            action: 'send',
            channelId: conversation.channel_id,
            phone: contact.phone,
            content: msg.content || '',
            type: messageType,
            mediaUrl: mediaUrl,
          }),
        })

        const sendResult = await sendResponse.json()
        
        if (!sendResponse.ok || sendResult.error) {
          console.error('[process-rescue-messages] Error sending via WhatsApp:', sendResult)
          errors++
          continue
        }

        console.log('[process-rescue-messages] WhatsApp message sent:', sendResult)

        // Insert message into messages table
        const { error: msgError } = await supabase
          .from('messages')
          .insert({
            conversation_id: msg.rescue.conversation_id,
            contact_id: msg.rescue.contact_id,
            content: msg.content || '',
            is_from_me: true,
            message_type: messageType,
            media_url: mediaUrl,
            status: 'sent',
            whatsapp_message_id: sendResult?.messageId,
          })

        if (msgError) {
          console.error('[process-rescue-messages] Error inserting message:', msgError)
          // Continue anyway, message was sent
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
          console.log('[process-rescue-messages] Last message sent, executing final action')
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
            console.log('[process-rescue-messages] Conversation closed')
          } else if (finalAction === 'transfer' && finalConfig.department_id) {
            await supabase
              .from('conversations')
              .update({
                department_id: finalConfig.department_id,
                assigned_to: null,
              })
              .eq('id', msg.rescue.conversation_id)
            console.log('[process-rescue-messages] Conversation transferred to department:', finalConfig.department_id)
          }

          // Mark rescue as completed
          await supabase
            .from('active_rescues')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', msg.rescue.id)
        } else {
          // Update to next step
          const nextTimer = (steps[nextStep] as any)?.timer_minutes || 60
          const nextSendAt = new Date(Date.now() + nextTimer * 60 * 1000)

          await supabase
            .from('active_rescues')
            .update({ current_step: nextStep, next_send_at: nextSendAt.toISOString() })
            .eq('id', msg.rescue.id)
          
          console.log(`[process-rescue-messages] Updated to step ${nextStep}, next send at: ${nextSendAt.toISOString()}`)
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
