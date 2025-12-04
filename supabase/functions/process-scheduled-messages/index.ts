import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Processing scheduled messages...')

    // Find messages that should be sent (scheduled_for <= now and status = 'scheduled')
    const now = new Date().toISOString()
    
    const { data: scheduledMessages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select(`
        *,
        contact:contacts(id, full_name, phone),
        conversation:conversations(id, contact_id)
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .limit(50) // Process in batches

    if (fetchError) {
      console.error('Error fetching scheduled messages:', fetchError)
      throw fetchError
    }

    console.log(`Found ${scheduledMessages?.length || 0} messages to process`)

    if (!scheduledMessages || scheduledMessages.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: 0,
          message: 'No scheduled messages to process' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    let processedCount = 0
    let errorCount = 0
    const results: { id: string; status: string; error?: string }[] = []

    for (const scheduled of scheduledMessages) {
      try {
        console.log(`Processing message ${scheduled.id} for contact ${scheduled.contact?.full_name}`)

        // Insert the message into the messages table
        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            conversation_id: scheduled.conversation_id,
            contact_id: scheduled.contact_id,
            content: scheduled.content,
            media_url: scheduled.media_url,
            message_type: scheduled.content ? 'text' : 'media',
            is_from_me: true,
            status: 'sent',
            created_at: new Date().toISOString()
          })

        if (insertError) {
          console.error(`Error inserting message ${scheduled.id}:`, insertError)
          
          // Update scheduled message with error
          await supabase
            .from('scheduled_messages')
            .update({ 
              status: 'failed',
              error_message: insertError.message,
              attempts: (scheduled.attempts || 0) + 1
            })
            .eq('id', scheduled.id)

          errorCount++
          results.push({ id: scheduled.id, status: 'failed', error: insertError.message })
          continue
        }

        // Update conversation with last message info
        await supabase
          .from('conversations')
          .update({
            last_message_at: new Date().toISOString(),
            last_message_preview: scheduled.content?.substring(0, 100) || '[Mídia]'
          })
          .eq('id', scheduled.conversation_id)

        // Mark scheduled message as sent
        const { error: updateError } = await supabase
          .from('scheduled_messages')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', scheduled.id)

        if (updateError) {
          console.error(`Error updating scheduled message ${scheduled.id}:`, updateError)
        }

        processedCount++
        results.push({ id: scheduled.id, status: 'sent' })

        console.log(`Successfully processed message ${scheduled.id}`)

      } catch (msgError) {
        console.error(`Error processing message ${scheduled.id}:`, msgError)
        errorCount++
        results.push({ 
          id: scheduled.id, 
          status: 'error', 
          error: msgError instanceof Error ? msgError.message : 'Unknown error' 
        })
      }
    }

    console.log(`Processing complete. Sent: ${processedCount}, Errors: ${errorCount}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedCount,
        errors: errorCount,
        total: scheduledMessages.length,
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in process-scheduled-messages:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
