import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScheduledMessage {
  id: string
  content: string
  media_url: string | null
  message_type: string | null
  scheduled_for: string
  channel_id: string
  contact_id: string
  conversation_id: string
  attempts: number
  contact: { id: string; full_name: string; phone: string } | null
}

interface WhatsAppProvider {
  code: string
  base_url: string
  api_key: string | null
  admin_token: string | null
}

interface WhatsAppChannel {
  id: string
  instance_id: string
  instance_token: string
  provider: WhatsAppProvider | WhatsAppProvider[] | null
}

// Send message via Evolution API - supports text, audio, image, document
async function sendEvolutionMessage(
  baseUrl: string,
  instanceName: string,
  apiKey: string,
  phone: string,
  content: string,
  messageType: string,
  mediaUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const cleanPhone = phone.replace(/\D/g, '')
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    
    let url: string
    let body: Record<string, unknown>
    
    console.log(`[Scheduled] Sending ${messageType} via Evolution to ${formattedPhone}`)
    console.log(`[Scheduled] Media URL: ${mediaUrl || 'none'}`)

    // Determine the endpoint and body based on message type
    if (mediaUrl && messageType === 'audio') {
      url = `${baseUrl}/message/sendWhatsAppAudio/${instanceName}`
      body = {
        number: formattedPhone,
        audio: mediaUrl,
      }
    } else if (mediaUrl && messageType === 'image') {
      url = `${baseUrl}/message/sendMedia/${instanceName}`
      body = {
        number: formattedPhone,
        mediatype: 'image',
        media: mediaUrl,
        caption: content || undefined,
      }
    } else if (mediaUrl && messageType === 'video') {
      url = `${baseUrl}/message/sendMedia/${instanceName}`
      body = {
        number: formattedPhone,
        mediatype: 'video',
        media: mediaUrl,
        caption: content || undefined,
      }
    } else if (mediaUrl && messageType === 'document') {
      url = `${baseUrl}/message/sendMedia/${instanceName}`
      body = {
        number: formattedPhone,
        mediatype: 'document',
        media: mediaUrl,
        fileName: 'documento',
        caption: content || undefined,
      }
    } else {
      // Default: send text
      url = `${baseUrl}/message/sendText/${instanceName}`
      body = {
        number: formattedPhone,
        text: content,
      }
    }

    console.log(`[Scheduled] Evolution URL: ${url}`)
    console.log(`[Scheduled] Evolution body: ${JSON.stringify(body)}`)
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    console.log(`[Scheduled] Evolution response:`, JSON.stringify(data))

    if (response.ok && data.key?.id) {
      return { success: true, messageId: data.key.id }
    } else {
      return { success: false, error: data.message || data.error || 'Unknown error' }
    }
  } catch (error) {
    console.error('[Scheduled] Evolution send error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Network error' }
  }
}

// Send message via Z-API - supports text, audio, image, document
async function sendZAPIMessage(
  instanceId: string,
  token: string,
  phone: string,
  content: string,
  messageType: string,
  mediaUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const cleanPhone = phone.replace(/\D/g, '')
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    
    let url: string
    let body: Record<string, unknown>
    
    console.log(`[Scheduled] Sending ${messageType} via Z-API to ${formattedPhone}`)

    if (mediaUrl && messageType === 'audio') {
      url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-audio`
      body = { phone: formattedPhone, audio: mediaUrl }
    } else if (mediaUrl && messageType === 'image') {
      url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-image`
      body = { phone: formattedPhone, image: mediaUrl, caption: content || undefined }
    } else if (mediaUrl && messageType === 'video') {
      url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-video`
      body = { phone: formattedPhone, video: mediaUrl, caption: content || undefined }
    } else if (mediaUrl && messageType === 'document') {
      url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-document/pdf`
      body = { phone: formattedPhone, document: mediaUrl, fileName: 'documento' }
    } else {
      url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`
      body = { phone: formattedPhone, message: content }
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    console.log(`[Scheduled] Z-API response:`, JSON.stringify(data))

    if (response.ok && data.zapiMessageId) {
      return { success: true, messageId: data.zapiMessageId }
    } else {
      return { success: false, error: data.message || 'Unknown error' }
    }
  } catch (error) {
    console.error('[Scheduled] Z-API send error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Network error' }
  }
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

    console.log('[Scheduled] Processing scheduled messages...')

    // Find messages that should be sent (scheduled_for <= now and status = 'scheduled')
    const now = new Date().toISOString()
    
    const { data: scheduledMessages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select(`
        *,
        contact:contacts(id, full_name, phone)
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .limit(50) // Process in batches

    if (fetchError) {
      console.error('[Scheduled] Error fetching messages:', fetchError)
      throw fetchError
    }

    console.log(`[Scheduled] Found ${scheduledMessages?.length || 0} messages to process`)

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

    for (const scheduled of scheduledMessages as ScheduledMessage[]) {
      try {
        console.log(`[Scheduled] Processing message ${scheduled.id} for contact ${scheduled.contact?.full_name}`)

        // Get channel with provider info
        const { data: channel, error: channelError } = await supabase
          .from('whatsapp_channels')
          .select(`
            id,
            instance_id,
            instance_token,
            provider:whatsapp_providers(code, base_url, api_key, admin_token)
          `)
          .eq('id', scheduled.channel_id)
          .single()

        if (channelError || !channel) {
          console.error(`[Scheduled] Channel not found for message ${scheduled.id}:`, channelError)
          
          await supabase
            .from('scheduled_messages')
            .update({ 
              status: 'failed',
              error_message: 'Canal WhatsApp não encontrado',
              attempts: (scheduled.attempts || 0) + 1
            })
            .eq('id', scheduled.id)

          errorCount++
          results.push({ id: scheduled.id, status: 'failed', error: 'Channel not found' })
          continue
        }

        const typedChannel = channel as WhatsAppChannel
        // Provider pode vir como array ou objeto único
        const providerRaw = typedChannel.provider
        const provider: WhatsAppProvider | null = Array.isArray(providerRaw) ? providerRaw[0] : providerRaw

        if (!provider) {
          console.error(`[Scheduled] Provider not found for channel ${scheduled.channel_id}`)
          
          await supabase
            .from('scheduled_messages')
            .update({ 
              status: 'failed',
              error_message: 'Provedor WhatsApp não configurado',
              attempts: (scheduled.attempts || 0) + 1
            })
            .eq('id', scheduled.id)

          errorCount++
          results.push({ id: scheduled.id, status: 'failed', error: 'Provider not found' })
          continue
        }

        // Get contact phone
        const contactPhone = scheduled.contact?.phone
        if (!contactPhone) {
          console.error(`[Scheduled] Contact phone not found for message ${scheduled.id}`)
          
          await supabase
            .from('scheduled_messages')
            .update({ 
              status: 'failed',
              error_message: 'Telefone do contato não encontrado',
              attempts: (scheduled.attempts || 0) + 1
            })
            .eq('id', scheduled.id)

          errorCount++
          results.push({ id: scheduled.id, status: 'failed', error: 'Contact phone not found' })
          continue
        }

        // Send message via WhatsApp API
        let sendResult: { success: boolean; messageId?: string; error?: string }

        console.log(`[Scheduled] Sending via provider: ${provider.code}`)
        
        // Use api_key or admin_token as fallback
        const apiKey = provider.api_key || provider.admin_token || ''
        console.log(`[Scheduled] Using API key: ${apiKey ? 'present' : 'missing'}`)

        const msgType = scheduled.message_type || 'text'

        if (provider.code === 'evolution') {
          sendResult = await sendEvolutionMessage(
            provider.base_url,
            typedChannel.instance_id,
            apiKey,
            contactPhone,
            scheduled.content,
            msgType,
            scheduled.media_url || undefined
          )
        } else if (provider.code === 'zapi') {
          sendResult = await sendZAPIMessage(
            typedChannel.instance_id,
            typedChannel.instance_token,
            contactPhone,
            scheduled.content,
            msgType,
            scheduled.media_url || undefined
          )
        } else {
          sendResult = { success: false, error: `Provider ${provider.code} not supported` }
        }

        if (!sendResult.success) {
          console.error(`[Scheduled] Failed to send message ${scheduled.id}:`, sendResult.error)
          
          await supabase
            .from('scheduled_messages')
            .update({ 
              status: 'failed',
              error_message: sendResult.error || 'Falha ao enviar mensagem',
              attempts: (scheduled.attempts || 0) + 1
            })
            .eq('id', scheduled.id)

          errorCount++
          results.push({ id: scheduled.id, status: 'failed', error: sendResult.error })
          continue
        }

        console.log(`[Scheduled] Message sent successfully! WhatsApp ID: ${sendResult.messageId}`)

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
            whatsapp_message_id: sendResult.messageId,
            created_at: new Date().toISOString()
          })

        if (insertError) {
          console.error(`[Scheduled] Error inserting message ${scheduled.id}:`, insertError)
          // Message was sent but not saved - still mark as sent
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
          console.error(`[Scheduled] Error updating scheduled message ${scheduled.id}:`, updateError)
        }

        processedCount++
        results.push({ id: scheduled.id, status: 'sent' })

        console.log(`[Scheduled] Successfully processed message ${scheduled.id}`)

      } catch (msgError) {
        console.error(`[Scheduled] Error processing message ${scheduled.id}:`, msgError)
        
        await supabase
          .from('scheduled_messages')
          .update({ 
            status: 'failed',
            error_message: msgError instanceof Error ? msgError.message : 'Erro desconhecido',
            attempts: (scheduled.attempts || 0) + 1
          })
          .eq('id', scheduled.id)

        errorCount++
        results.push({ 
          id: scheduled.id, 
          status: 'error', 
          error: msgError instanceof Error ? msgError.message : 'Unknown error' 
        })
      }
    }

    console.log(`[Scheduled] Processing complete. Sent: ${processedCount}, Errors: ${errorCount}`)

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
    console.error('[Scheduled] Error in process-scheduled-messages:', error)
    
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
