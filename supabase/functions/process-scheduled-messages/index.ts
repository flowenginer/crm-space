import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildTemplateComponentsPayload,
  type TemplateComponent,
  type TemplatePayloadComponent,
} from '../_shared/meta-template-payload.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  created_by: string | null
  contact: { id: string; full_name: string; phone: string } | null
  // Meta template fields (when message_type === 'template')
  meta_template_id?: string | null
  template_name?: string | null
  template_language?: string | null
  template_components?: TemplateComponent[] | null
  template_header_media_url?: string | null
  variables?: Record<string, string> | null
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
  type?: string | null
  provider: WhatsAppProvider | WhatsAppProvider[] | null
}

// Send text message via Evolution API
async function sendEvolutionText(
  baseUrl: string,
  instanceName: string,
  apiKey: string,
  phone: string,
  content: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const cleanPhone = phone.replace(/\D/g, '')
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    
    const url = `${baseUrl}/message/sendText/${instanceName}`
    const body = { number: formattedPhone, text: content }
    
    console.log(`[Scheduled] Sending text via Evolution to ${formattedPhone}`)
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    console.log(`[Scheduled] Evolution text response:`, JSON.stringify(data))

    if (response.ok && data.key?.id) {
      return { success: true, messageId: data.key.id }
    } else {
      return { success: false, error: data.message || data.error || 'Unknown error' }
    }
  } catch (error) {
    console.error('[Scheduled] Evolution text send error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Network error' }
  }
}

// Send media message via Evolution API
async function sendEvolutionMedia(
  baseUrl: string,
  instanceName: string,
  apiKey: string,
  phone: string,
  messageType: string,
  mediaUrl: string,
  caption?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const cleanPhone = phone.replace(/\D/g, '')
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    
    let url: string
    let body: Record<string, unknown>
    
    console.log(`[Scheduled] Sending ${messageType} via Evolution to ${formattedPhone}`)
    console.log(`[Scheduled] Media URL: ${mediaUrl}`)

    // Determine the endpoint and body based on message type
    if (messageType === 'audio') {
      // Audio does NOT support caption in Evolution API
      url = `${baseUrl}/message/sendWhatsAppAudio/${instanceName}`
      body = {
        number: formattedPhone,
        audio: mediaUrl,
      }
    } else if (messageType === 'image') {
      url = `${baseUrl}/message/sendMedia/${instanceName}`
      body = {
        number: formattedPhone,
        mediatype: 'image',
        media: mediaUrl,
        caption: caption || undefined,
      }
    } else if (messageType === 'video') {
      url = `${baseUrl}/message/sendMedia/${instanceName}`
      body = {
        number: formattedPhone,
        mediatype: 'video',
        media: mediaUrl,
        caption: caption || undefined,
      }
    } else {
      // Document
      url = `${baseUrl}/message/sendMedia/${instanceName}`
      body = {
        number: formattedPhone,
        mediatype: 'document',
        media: mediaUrl,
        fileName: 'documento',
        caption: caption || undefined,
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
    console.log(`[Scheduled] Evolution media response:`, JSON.stringify(data))

    if (response.ok && data.key?.id) {
      return { success: true, messageId: data.key.id }
    } else {
      return { success: false, error: data.message || data.error || 'Unknown error' }
    }
  } catch (error) {
    console.error('[Scheduled] Evolution media send error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Network error' }
  }
}

// =====================================================
// UAZAPI V2 - Send text message
// Docs: https://docs.uazapi.com/endpoint/post/send~text
// =====================================================
async function sendUAZAPIText(
  baseUrl: string,
  instanceToken: string,
  phone: string,
  content: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const cleanPhone = phone.replace(/\D/g, '')
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    
    const url = `${baseUrl}/send/text`
    const body = { number: formattedPhone, text: content }
    
    console.log(`[Scheduled] Sending text via UAZAPI V2 to ${formattedPhone}`)
    console.log(`[Scheduled] UAZAPI URL: ${url}`)
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': instanceToken,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    console.log(`[Scheduled] UAZAPI V2 text response:`, JSON.stringify(data))

    if (response.ok || data.status === true || data.messageId) {
      return { success: true, messageId: data.messageId || data.id || data.key?.id }
    } else {
      return { success: false, error: data.message || data.error || 'Unknown error' }
    }
  } catch (error) {
    console.error('[Scheduled] UAZAPI V2 text send error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Network error' }
  }
}

// =====================================================
// UAZAPI V2 - Send media message
// Docs: https://docs.uazapi.com/endpoint/post/send~media
// =====================================================
async function sendUAZAPIMedia(
  baseUrl: string,
  instanceToken: string,
  phone: string,
  messageType: string,
  mediaUrl: string,
  caption?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const cleanPhone = phone.replace(/\D/g, '')
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    
    // UAZAPI V2: Mapear tipo para formato correto
    let uazapiType = messageType
    if (messageType === 'audio') uazapiType = 'ptt' // Push-to-Talk (mensagem de voz)
    
    const url = `${baseUrl}/send/media`
    const body: Record<string, unknown> = {
      number: formattedPhone,
      type: uazapiType,
      file: mediaUrl,
    }
    
    // Áudio não suporta caption
    if (caption && messageType !== 'audio') {
      body.caption = caption
    }
    
    if (messageType === 'document') {
      body.filename = 'documento'
    }
    
    console.log(`[Scheduled] Sending ${messageType} via UAZAPI V2 to ${formattedPhone}`)
    console.log(`[Scheduled] UAZAPI URL: ${url}`)
    console.log(`[Scheduled] UAZAPI body: ${JSON.stringify(body)}`)
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': instanceToken,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    console.log(`[Scheduled] UAZAPI V2 media response:`, JSON.stringify(data))

    if (response.ok || data.status === true || data.messageId) {
      return { success: true, messageId: data.messageId || data.id || data.key?.id }
    } else {
      return { success: false, error: data.message || data.error || 'Unknown error' }
    }
  } catch (error) {
    console.error('[Scheduled] UAZAPI V2 media send error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Network error' }
  }
}

// Send text message via Z-API
async function sendZAPIText(
  instanceId: string,
  token: string,
  phone: string,
  content: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const cleanPhone = phone.replace(/\D/g, '')
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    
    const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`
    const body = { phone: formattedPhone, message: content }
    
    console.log(`[Scheduled] Sending text via Z-API to ${formattedPhone}`)
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    console.log(`[Scheduled] Z-API text response:`, JSON.stringify(data))

    if (response.ok && data.zapiMessageId) {
      return { success: true, messageId: data.zapiMessageId }
    } else {
      return { success: false, error: data.message || 'Unknown error' }
    }
  } catch (error) {
    console.error('[Scheduled] Z-API text send error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Network error' }
  }
}

// Send media message via Z-API
async function sendZAPIMedia(
  instanceId: string,
  token: string,
  phone: string,
  messageType: string,
  mediaUrl: string,
  caption?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const cleanPhone = phone.replace(/\D/g, '')
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
    
    let url: string
    let body: Record<string, unknown>
    
    console.log(`[Scheduled] Sending ${messageType} via Z-API to ${formattedPhone}`)

    if (messageType === 'audio') {
      // Audio does NOT support caption in Z-API
      url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-audio`
      body = { phone: formattedPhone, audio: mediaUrl }
    } else if (messageType === 'image') {
      url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-image`
      body = { phone: formattedPhone, image: mediaUrl, caption: caption || undefined }
    } else if (messageType === 'video') {
      url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-video`
      body = { phone: formattedPhone, video: mediaUrl, caption: caption || undefined }
    } else {
      // Document
      url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-document/pdf`
      body = { phone: formattedPhone, document: mediaUrl, fileName: 'documento' }
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    console.log(`[Scheduled] Z-API media response:`, JSON.stringify(data))

    if (response.ok && data.zapiMessageId) {
      return { success: true, messageId: data.zapiMessageId }
    } else {
      return { success: false, error: data.message || 'Unknown error' }
    }
  } catch (error) {
    console.error('[Scheduled] Z-API media send error:', error)
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
        contact:contacts(id, full_name, phone, email)
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

        // Get channel with provider info - OTIMIZAÇÃO: incluir type para verificar se é CloudAPI
        const { data: channel, error: channelError } = await supabase
          .from('whatsapp_channels')
          .select(`
            id,
            instance_id,
            instance_token,
            type,
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
        const channelType = typedChannel.type
        const isCloudAPI = channelType === 'cloudapi' || channelType === 'official'
        const isTemplateMessage = scheduled.message_type === 'template'

        // =====================================================
        // META TEMPLATE: requires CloudAPI channel. Short-circuit here.
        // =====================================================
        if (isTemplateMessage) {
          if (!isCloudAPI) {
            console.error(`[Scheduled] Template message ${scheduled.id} on non-CloudAPI channel (${channelType})`)
            await supabase
              .from('scheduled_messages')
              .update({
                status: 'failed',
                error_message: 'Templates Meta só podem ser enviados em canais Cloud API oficial',
                attempts: (scheduled.attempts || 0) + 1,
              })
              .eq('id', scheduled.id)
            errorCount++
            results.push({ id: scheduled.id, status: 'failed', error: 'Template requires CloudAPI channel' })
            continue
          }

          const contactPhoneTpl = scheduled.contact?.phone
          if (!contactPhoneTpl) {
            await supabase
              .from('scheduled_messages')
              .update({
                status: 'failed',
                error_message: 'Telefone do contato não encontrado',
                attempts: (scheduled.attempts || 0) + 1,
              })
              .eq('id', scheduled.id)
            errorCount++
            results.push({ id: scheduled.id, status: 'failed', error: 'Contact phone not found' })
            continue
          }

          const components = scheduled.template_components || []
          const variables = scheduled.variables || {}

          // Apply dynamic variable replacement inside each variable value (e.g. {{nome}})
          const expandedVars: Record<string, string> = {}
          let tplAgentName = ''
          if (scheduled.created_by) {
            const { data: agentProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', scheduled.created_by)
              .single()
            tplAgentName = agentProfile?.full_name || ''
          }
          for (const [k, v] of Object.entries(variables)) {
            expandedVars[k] = replaceVariables(
              String(v ?? ''),
              {
                full_name: scheduled.contact?.full_name,
                phone: scheduled.contact?.phone,
                email: (scheduled.contact as { email?: string } | null)?.email,
              },
              tplAgentName,
            )
          }

          let templatePayload: TemplatePayloadComponent[]
          try {
            templatePayload = buildTemplateComponentsPayload(
              components,
              expandedVars,
              scheduled.template_header_media_url || null,
            )
          } catch (buildError) {
            console.error(`[Scheduled] Template build error:`, buildError)
            await supabase
              .from('scheduled_messages')
              .update({
                status: 'failed',
                error_message: buildError instanceof Error ? buildError.message : 'Erro ao montar template',
                attempts: (scheduled.attempts || 0) + 1,
              })
              .eq('id', scheduled.id)
            errorCount++
            results.push({ id: scheduled.id, status: 'failed', error: 'Template build error' })
            continue
          }

          try {
            console.log(`[Scheduled] Sending template ${scheduled.template_name} via CloudAPI...`)
            const cloudResponse = await fetch(`${supabaseUrl}/functions/v1/cloudapi-send-message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                channelId: scheduled.channel_id,
                phone: contactPhoneTpl,
                type: 'template',
                conversationId: scheduled.conversation_id,
                template: {
                  name: scheduled.template_name,
                  language: scheduled.template_language || 'pt_BR',
                  components: templatePayload,
                },
              }),
            })

            const cloudResult = await cloudResponse.json()
            if (cloudResponse.ok && cloudResult.success) {
              console.log(`[Scheduled] Template sent! ID: ${cloudResult.messageId}`)
              await supabase
                .from('scheduled_messages')
                .update({
                  status: 'sent',
                  sent_at: new Date().toISOString(),
                  attempts: (scheduled.attempts || 0) + 1,
                })
                .eq('id', scheduled.id)
              processedCount++
              results.push({ id: scheduled.id, status: 'sent' })
            } else {
              const errMsg = cloudResult.error || 'Erro ao enviar template via CloudAPI'
              await supabase
                .from('scheduled_messages')
                .update({
                  status: 'failed',
                  error_message: errMsg,
                  attempts: (scheduled.attempts || 0) + 1,
                })
                .eq('id', scheduled.id)
              errorCount++
              results.push({ id: scheduled.id, status: 'failed', error: errMsg })
            }
          } catch (cloudError) {
            console.error(`[Scheduled] Template send error:`, cloudError)
            await supabase
              .from('scheduled_messages')
              .update({
                status: 'failed',
                error_message: cloudError instanceof Error ? cloudError.message : 'Erro de rede CloudAPI',
                attempts: (scheduled.attempts || 0) + 1,
              })
              .eq('id', scheduled.id)
            errorCount++
            results.push({ id: scheduled.id, status: 'failed', error: 'Network error' })
          }
          continue
        }
        
        // Para canais CloudAPI, não precisamos de provider tradicional
        // Provider pode vir como array ou objeto único
        const providerRaw = typedChannel.provider
        const provider: WhatsAppProvider | null = Array.isArray(providerRaw) ? providerRaw[0] : providerRaw

        // Verificar se temos provider (apenas para canais não-CloudAPI)
        if (!isCloudAPI && !provider) {
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
        let sendResult: { success: boolean; messageId?: string; error?: string } = { success: true }
        let lastMessageId: string | undefined

        // Para canais CloudAPI, usar edge function cloudapi-send-message
        if (isCloudAPI) {
          console.log(`[Scheduled] Sending via CloudAPI channel type: ${channelType}`)
        } else if (provider) {
          console.log(`[Scheduled] Sending via provider: ${provider.code}`)
        }
        
        // Use api_key or admin_token as fallback (apenas para não-CloudAPI)
        const apiKey = provider?.api_key || provider?.admin_token || ''
        if (!isCloudAPI) {
          console.log(`[Scheduled] Using API key: ${apiKey ? 'present' : 'missing'}`)
        }

        const msgType = scheduled.message_type || 'text'
        const hasText = scheduled.content && scheduled.content.trim().length > 0
        const hasMedia = scheduled.media_url && scheduled.media_url.length > 0
        
        // =====================================================
        // REPLACE VARIABLES: Substituir variáveis no conteúdo
        // =====================================================
        let processedContent = scheduled.content || ''
        let agentName = ''
        
        if (hasText && scheduled.contact) {
          // Buscar nome do agente se created_by existe
          if (scheduled.created_by) {
            const { data: agentProfile } = await supabase
              .from('profiles')
              .select('full_name, signature_name, signature_enabled')
              .eq('id', scheduled.created_by)
              .single()
            
            if (agentProfile) {
              agentName = agentProfile.full_name || ''
            }
          }
          
          // Substituir variáveis
          processedContent = replaceVariables(
            processedContent,
            { 
              full_name: scheduled.contact.full_name, 
              phone: scheduled.contact.phone, 
              email: (scheduled.contact as any).email 
            },
            agentName
          )
        }
        
        // =====================================================
        // ASSINATURA OBRIGATÓRIA: Adicionar assinatura do agente se for mensagem de texto
        // =====================================================
        let finalTextContent = processedContent
        if (msgType === 'text' && hasText && scheduled.created_by) {
          // Verificar se já tem assinatura (começa com *Algo*:)
          const hasSignature = /^\*[^*]+\*:\s*/.test(processedContent || '')
          
          if (!hasSignature) {
            // Buscar perfil do agente que criou a mensagem (já pode estar no cache)
            const { data: agentProfile } = await supabase
              .from('profiles')
              .select('full_name, signature_name, signature_enabled')
              .eq('id', scheduled.created_by)
              .single()
            
            // Só adiciona assinatura se signature_enabled !== false (default true)
            if (agentProfile && agentProfile.signature_enabled !== false) {
              const signatureName = agentProfile.signature_name || agentProfile.full_name
              if (signatureName) {
                finalTextContent = `*${signatureName}*:\n${processedContent}`
                console.log(`[Scheduled] Added signature from agent: ${signatureName}`)
              }
            }
          }
        }
        
        // For audio messages, we need to send text separately (audio doesn't support caption)
        // For image/video/document, we can include caption but still send text separately for reliability
        const needsSeparateTextMessage = hasText && hasMedia && (msgType === 'audio' || msgType === 'text')

        console.log(`[Scheduled] Has text: ${hasText}, Has media: ${hasMedia}, Type: ${msgType}, Separate text: ${needsSeparateTextMessage}, isCloudAPI: ${isCloudAPI}`)

        // =====================================================
        // ENVIO VIA CLOUDAPI (Meta Cloud API / Official)
        // =====================================================
        if (isCloudAPI) {
          try {
            // Enviar texto primeiro se necessário
            if (hasText && (needsSeparateTextMessage || !hasMedia)) {
              console.log(`[Scheduled] Sending text via CloudAPI...`)
              const cloudResponse = await fetch(`${supabaseUrl}/functions/v1/cloudapi-send-message`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  channelId: scheduled.channel_id,
                  phone: contactPhone,
                  message: finalTextContent,
                  type: 'text',
                }),
              })

              const cloudResult = await cloudResponse.json()
              if (cloudResponse.ok && cloudResult.success) {
                lastMessageId = cloudResult.messageId
                console.log(`[Scheduled] CloudAPI text sent successfully! ID: ${cloudResult.messageId}`)
              } else {
                sendResult = { success: false, error: cloudResult.error || 'Erro ao enviar via CloudAPI' }
              }
            }

            // Enviar mídia se necessário
            if (sendResult.success && hasMedia) {
              console.log(`[Scheduled] Sending media via CloudAPI...`)
              const caption = (msgType !== 'audio' && !needsSeparateTextMessage) ? finalTextContent : undefined
              
              const cloudResponse = await fetch(`${supabaseUrl}/functions/v1/cloudapi-send-message`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  channelId: scheduled.channel_id,
                  phone: contactPhone,
                  type: msgType,
                  mediaUrl: scheduled.media_url,
                  caption: caption,
                }),
              })

              const cloudResult = await cloudResponse.json()
              if (cloudResponse.ok && cloudResult.success) {
                lastMessageId = cloudResult.messageId
                console.log(`[Scheduled] CloudAPI media sent successfully! ID: ${cloudResult.messageId}`)
              } else {
                sendResult = { success: false, error: cloudResult.error || 'Erro ao enviar mídia via CloudAPI' }
              }
            }
          } catch (cloudError) {
            console.error(`[Scheduled] CloudAPI error:`, cloudError)
            sendResult = { success: false, error: cloudError instanceof Error ? cloudError.message : 'Erro de rede CloudAPI' }
          }
        }
        // =====================================================
        // ENVIO VIA PROVEDORES TRADICIONAIS
        // =====================================================
        else if (provider) {
          // Step 1: Send text message first if we have both text and media
          if (hasText && (needsSeparateTextMessage || !hasMedia)) {
            console.log(`[Scheduled] Sending text message...`)
            
            if (provider.code === 'evolution') {
              sendResult = await sendEvolutionText(
                provider.base_url,
                typedChannel.instance_id,
                apiKey,
                contactPhone,
                finalTextContent
              )
            } else if (provider.code === 'zapi') {
              sendResult = await sendZAPIText(
                typedChannel.instance_id,
                typedChannel.instance_token,
                contactPhone,
                finalTextContent
              )
            } else if (provider.code === 'uazapi') {
              // UAZAPI V2
              sendResult = await sendUAZAPIText(
                provider.base_url,
                typedChannel.instance_token,
                contactPhone,
                finalTextContent
              )
            } else {
              sendResult = { success: false, error: `Provider ${provider.code} not supported` }
            }

            if (sendResult.success) {
              lastMessageId = sendResult.messageId
              console.log(`[Scheduled] Text sent successfully! WhatsApp ID: ${sendResult.messageId}`)
            }
          }

          // Step 2: Send media if we have it and text was successful (or no text)
          if (sendResult.success && hasMedia) {
            console.log(`[Scheduled] Sending media message...`)
            
            // For image/video/document, include caption only if we didn't send text separately
            const caption = (msgType !== 'audio' && !needsSeparateTextMessage) ? finalTextContent : undefined
            
            if (provider.code === 'evolution') {
              sendResult = await sendEvolutionMedia(
                provider.base_url,
                typedChannel.instance_id,
                apiKey,
                contactPhone,
                msgType,
                scheduled.media_url!,
                caption
              )
            } else if (provider.code === 'zapi') {
              sendResult = await sendZAPIMedia(
                typedChannel.instance_id,
                typedChannel.instance_token,
                contactPhone,
                msgType,
                scheduled.media_url!,
                caption
              )
            } else if (provider.code === 'uazapi') {
              // UAZAPI V2
              sendResult = await sendUAZAPIMedia(
                provider.base_url,
                typedChannel.instance_token,
                contactPhone,
                msgType,
                scheduled.media_url!,
                caption
              )
            } else {
              sendResult = { success: false, error: `Provider ${provider.code} not supported` }
            }

            if (sendResult.success) {
              lastMessageId = sendResult.messageId
              console.log(`[Scheduled] Media sent successfully! WhatsApp ID: ${sendResult.messageId}`)
            }
          }
        } else {
          sendResult = { success: false, error: 'No valid provider or CloudAPI configuration' }
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

        console.log(`[Scheduled] All messages sent successfully!`)

        // Insert the message into the messages table
        const { error: insertError } = await supabase
          .from('messages')
          .insert({
            conversation_id: scheduled.conversation_id,
            contact_id: scheduled.contact_id,
            content: finalTextContent,
            media_url: scheduled.media_url,
            message_type: hasMedia ? msgType : 'text',
            is_from_me: true,
            status: 'sent',
            whatsapp_message_id: lastMessageId,
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
            last_message_preview: finalTextContent?.substring(0, 100) || '[Mídia]'
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
