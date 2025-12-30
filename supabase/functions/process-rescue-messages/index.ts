import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to execute an action
async function executeAction(
  supabase: any,
  action: string | null | undefined,
  config: any,
  conversationId: string,
  contactId: string
): Promise<boolean> {
  if (!action || action === 'none' || action === 'continue') {
    return false // No action executed
  }

  console.log(`[process-rescue-messages] Executing action: ${action}`, config)

  if (action === 'close') {
    await supabase
      .from('conversations')
      .update({
        status: 'closed',
        close_reason: config?.close_reason_id || 'rescue_completed',
        closed_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
    console.log('[process-rescue-messages] Conversation closed')
    return true
  }
  
  if ((action === 'transfer' || action === 'transfer_department') && config?.department_id) {
    await supabase
      .from('conversations')
      .update({
        department_id: config.department_id,
      })
      .eq('id', conversationId)
    console.log('[process-rescue-messages] Conversation transferred to department:', config.department_id)
    return true
  }
  
  if (action === 'transfer_agent' && config?.agent_id) {
    await supabase
      .from('conversations')
      .update({
        assigned_to: config.agent_id,
      })
      .eq('id', conversationId)
    console.log('[process-rescue-messages] Conversation transferred to agent:', config.agent_id)
    return true
  }
  
  if (action === 'add_tag' && config?.tag_id) {
    await supabase
      .from('contact_tags')
      .upsert({
        contact_id: contactId,
        tag_id: config.tag_id,
      }, { onConflict: 'contact_id,tag_id' })
    console.log('[process-rescue-messages] Tag added to contact:', config.tag_id)
    return true
  }
  
  if (action === 'change_lead_status' && config?.lead_status) {
    await supabase
      .from('contacts')
      .update({
        lead_status: config.lead_status,
      })
      .eq('id', contactId)
    console.log('[process-rescue-messages] Lead status changed to:', config.lead_status)
    return true
  }
  
  if (action === 'add_segment' && config?.segment_id) {
    await supabase
      .from('contacts')
      .update({
        segment_id: config.segment_id,
      })
      .eq('id', contactId)
    console.log('[process-rescue-messages] Segment added to contact:', config.segment_id)
    return true
  }

  return false
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

        // Send each media type SEPARATELY: text, audio, attachment
        // Using INSERT FIRST pattern to prevent race condition with webhook
        console.log(`[process-rescue-messages] Processing message for ${contact.phone}...`)
        
        // Helper function: INSERT first (pending) -> SEND to WhatsApp -> UPDATE with messageId
        const sendWithInsertFirst = async (type: string, content: string, mediaUrl: string | null) => {
          // 1. INSERT message first with status 'pending' (no whatsapp_message_id yet)
          const { data: insertedMsg, error: insertError } = await supabase
            .from('messages')
            .insert({
              conversation_id: msg.rescue.conversation_id,
              contact_id: msg.rescue.contact_id,
              content: content,
              is_from_me: true,
              message_type: type,
              media_url: mediaUrl,
              status: 'pending',
              whatsapp_message_id: null,
            })
            .select('id')
            .single()

          if (insertError) {
            console.error(`[process-rescue-messages] Error inserting ${type} message:`, insertError)
            throw new Error(`Failed to insert ${type} message`)
          }

          console.log(`[process-rescue-messages] Inserted pending ${type} message:`, insertedMsg.id)

          // 2. SEND to WhatsApp
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
              content: content,
              type: type,
              mediaUrl: mediaUrl,
            }),
          })

          const sendResult = await sendResponse.json()
          
          if (!sendResponse.ok || sendResult.error) {
            console.error(`[process-rescue-messages] Error sending ${type}:`, sendResult)
            // Rollback: delete the pending message
            await supabase.from('messages').delete().eq('id', insertedMsg.id)
            throw new Error(`Failed to send ${type}`)
          }

          console.log(`[process-rescue-messages] ${type} sent:`, sendResult)

          // 3. UPDATE message with whatsapp_message_id and status 'sent'
          const { error: updateError } = await supabase
            .from('messages')
            .update({
              whatsapp_message_id: sendResult?.messageId,
              status: 'sent',
            })
            .eq('id', insertedMsg.id)

          if (updateError) {
            console.error(`[process-rescue-messages] Error updating ${type} message:`, updateError)
          }

          console.log(`[process-rescue-messages] ${type} message updated with whatsapp_message_id`)
        }

        // 1. Send TEXT message first (if exists)
        if (msg.content?.trim()) {
          console.log('[process-rescue-messages] Sending text...')
          await sendWithInsertFirst('text', msg.content, null)
        }
        
        // 2. Send AUDIO (if exists)
        if (msg.audio_url) {
          console.log('[process-rescue-messages] Sending audio...')
          await sendWithInsertFirst('audio', '', msg.audio_url)
        }
        
        // 3. Send ATTACHMENT (if exists)
        if (msg.attachment_url) {
          console.log('[process-rescue-messages] Sending attachment...')
          const attachmentType = msg.attachment_type || 'document'
          await sendWithInsertFirst(attachmentType, '', msg.attachment_url)
        }

        // Mark scheduled message as sent
        await supabase
          .from('rescue_scheduled_messages')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', msg.id)

        // Get current step data from template
        const steps = msg.rescue.template?.steps || []
        const currentStepIndex = msg.step_number
        const currentStepData = steps[currentStepIndex] as any
        const nextStep = currentStepIndex + 1
        const isLastMessage = nextStep >= steps.length

        // Execute on_no_reply_action for this message (if configured)
        const onNoReplyAction = currentStepData?.on_no_reply_action
        const onNoReplyConfig = currentStepData?.on_no_reply_config || {}

        if (isLastMessage) {
          // Last message - execute the on_no_reply_action as final action
          console.log('[process-rescue-messages] Last message sent, executing final action from step')
          
          // If step has specific action, use it; otherwise fall back to template's final_action
          const finalAction = onNoReplyAction || msg.rescue.template?.final_action
          const finalConfig = onNoReplyAction ? onNoReplyConfig : (msg.rescue.template?.final_action_config || {})

          await executeAction(
            supabase,
            finalAction,
            finalConfig,
            msg.rescue.conversation_id,
            msg.rescue.contact_id
          )

          // Mark rescue as completed
          await supabase
            .from('active_rescues')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('id', msg.rescue.id)
        } else {
          // Not the last message - execute intermediate on_no_reply_action if configured
          if (onNoReplyAction && onNoReplyAction !== 'none' && onNoReplyAction !== 'continue') {
            console.log(`[process-rescue-messages] Executing intermediate action: ${onNoReplyAction}`)
            
            const shouldStop = await executeAction(
              supabase,
              onNoReplyAction,
              onNoReplyConfig,
              msg.rescue.conversation_id,
              msg.rescue.contact_id
            )

            // If action is 'close', stop the rescue
            if (onNoReplyAction === 'close') {
              await supabase
                .from('active_rescues')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', msg.rescue.id)
              processed++
              continue // Skip scheduling next message
            }
          }

          // Schedule next message
          const nextStepData = steps[nextStep] as any
          const nextTimer = nextStepData?.timer_minutes || 60
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
