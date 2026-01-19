import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Gera variações do telefone para busca (com e sem 9º dígito brasileiro)
function getPhoneVariations(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const variations: string[] = [digits];
  
  // Versão com código do país se não tiver
  if (!digits.startsWith('55') && digits.length >= 10) {
    variations.push(`55${digits}`);
  }
  
  // Versão sem código do país
  if (digits.startsWith('55')) {
    variations.push(digits.slice(2));
  }
  
  // Extrair DDD e resto do número
  const hasCountry = digits.startsWith('55');
  const baseNumber = hasCountry ? digits.slice(2) : digits;
  const ddd = baseNumber.slice(0, 2);
  const rest = baseNumber.slice(2);
  
  // Se tem 9 dígitos após DDD e começa com 9, tentar SEM o 9
  if (rest.length === 9 && rest.startsWith('9')) {
    const without9 = rest.slice(1);
    variations.push(`55${ddd}${without9}`);
    variations.push(`${ddd}${without9}`);
  }
  
  // Se tem 8 dígitos após DDD, tentar COM o 9 na frente
  if (rest.length === 8) {
    const with9 = `9${rest}`;
    variations.push(`55${ddd}${with9}`);
    variations.push(`${ddd}${with9}`);
  }
  
  return [...new Set(variations)];
}

// Download media from Facebook and upload to Supabase Storage
async function downloadAndUploadMedia(
  supabase: any, 
  mediaId: string, 
  messageType: string, 
  conversationId: string,
  accessToken: string
): Promise<string | null> {
  try {
    console.log(`[CloudAPI] Downloading media: ${mediaId} for conversation ${conversationId}`);
    
    // 1. Get download URL from Facebook
    const mediaInfoResponse = await fetch(
      `https://graph.facebook.com/v19.0/${mediaId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const mediaInfo = await mediaInfoResponse.json();
    
    if (!mediaInfo.url) {
      console.error('[CloudAPI] No URL in media info:', mediaInfo);
      return null;
    }
    
    console.log(`[CloudAPI] Got media URL, mime_type: ${mediaInfo.mime_type}`);
    
    // 2. Download the file
    const mediaResponse = await fetch(mediaInfo.url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!mediaResponse.ok) {
      console.error('[CloudAPI] Failed to download media:', mediaResponse.status);
      return null;
    }
    
    const mediaBuffer = await mediaResponse.arrayBuffer();
    
    // 3. Determine extension from mime type
    const mimeType = mediaInfo.mime_type || 'application/octet-stream';
    const extensionMap: Record<string, string> = {
      'audio/ogg': 'ogg',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/amr': 'amr',
      'audio/aac': 'aac',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/3gpp': '3gp',
      'application/pdf': 'pdf',
    };
    
    let extension = extensionMap[mimeType.split(';')[0]] || mimeType.split('/')[1]?.split(';')[0] || 'bin';
    const fileName = `${conversationId}/${Date.now()}_${mediaId}.${extension}`;
    
    // 4. Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('conversation-attachments')
      .upload(fileName, mediaBuffer, {
        contentType: mimeType,
        cacheControl: '3600'
      });
    
    if (uploadError) {
      console.error('[CloudAPI] Upload error:', uploadError);
      return null;
    }
    
    // 5. Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('conversation-attachments')
      .getPublicUrl(fileName);
    
    console.log(`[CloudAPI] Media uploaded successfully: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('[CloudAPI] Error downloading/uploading media:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    
    // Webhook verification (GET request from Meta)
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('Webhook verification request:', { mode, token, challenge });

      if (mode === 'subscribe' && token) {
        // Find config with matching verify_token
        const { data: config } = await supabase
          .from('cloudapi_configs')
          .select('id, verify_token')
          .eq('verify_token', token)
          .eq('is_active', true)
          .single();

        if (config) {
          // Mark webhook as configured
          await supabase
            .from('cloudapi_configs')
            .update({ webhook_configured: true })
            .eq('id', config.id);

          console.log('Webhook verified for config:', config.id);
          return new Response(challenge, { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });
        }
      }

      console.error('Webhook verification failed: Invalid token');
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    // Handle incoming webhooks (POST)
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('Received webhook:', JSON.stringify(body, null, 2));

      // Process each entry
      const entries = body.entry || [];
      
      for (const entry of entries) {
        const changes = entry.changes || [];
        
        for (const change of changes) {
          const field = change.field;
          const value = change.value;

          // Log the webhook
          await supabase.from('cloudapi_webhook_logs').insert({
            event_type: field,
            payload: change,
            processed: false,
          });

          // A Meta envia status com field="messages" mas com array "statuses" no value
          // Verificar o conteúdo do payload ao invés de confiar apenas no field
          if (value.statuses && value.statuses.length > 0) {
            // Evento de status (sent, delivered, read, failed)
            console.log('[CloudAPI] Processing status update from webhook, count:', value.statuses.length);
            await processStatuses(supabase, value);
          } else if (value.messages && value.messages.length > 0) {
            // Mensagem nova recebida
            await processMessages(supabase, value);
          } else if (field === 'calls' || (value.calls && value.calls.length > 0)) {
            await processCalls(supabase, value);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processMessages(supabase: any, value: any) {
  const metadata = value.metadata;
  const messages = value.messages || [];
  const contacts = value.contacts || [];
  
  const phoneNumberId = metadata?.phone_number_id;

  // Find the channel/config for this phone_number_id
  const { data: config } = await supabase
    .from('cloudapi_configs')
    .select('id, tenant_id, channel_id, access_token')
    .eq('phone_number_id', phoneNumberId)
    .eq('is_active', true)
    .single();

  if (!config) {
    console.log('No config found for phone_number_id:', phoneNumberId);
    return;
  }

  // Buscar o department_id configurado no canal
  let channelDepartmentId: string | null = null;
  if (config.channel_id) {
    const { data: channelInfo } = await supabase
      .from('whatsapp_channels')
      .select('department_id')
      .eq('id', config.channel_id)
      .single();
    channelDepartmentId = channelInfo?.department_id || null;
    console.log('[CloudAPI] Channel department_id:', channelDepartmentId);
  }

  for (const message of messages) {
    const from = message.from;
    const messageType = message.type;
    const timestamp = new Date(parseInt(message.timestamp) * 1000);
    
    // Handle REACTIONS separately - they update existing messages, not create new ones
    if (messageType === 'reaction') {
      console.log('[CloudAPI] 🎯 Processing reaction:', {
        emoji: message.reaction?.emoji,
        target_message_id: message.reaction?.message_id,
        from,
      });
      
      await processReaction(supabase, message, from, config.tenant_id);
      continue; // Skip normal message processing for reactions
    }
    
    // Get contact name
    const contact = contacts.find((c: any) => c.wa_id === from);
    const contactName = contact?.profile?.name || from;
    
    // Detect Click-to-WhatsApp Ad referral (72h window)
    const referral = message.referral;
    const isCTWA = referral?.source_type === 'ad';
    
    if (referral) {
      console.log('[CloudAPI] 📢 Referral detected:', {
        source_type: referral.source_type,
        source_id: referral.source_id,
        headline: referral.headline,
        isCTWA,
      });
    }

    console.log('Processing message:', {
      from,
      type: messageType,
      timestamp,
      contactName,
      tenantId: config.tenant_id,
      hasReferral: !!referral,
      isCTWA,
    });

    // Find or create contact - COM MATCH FLEXÍVEL DE TELEFONE
    // Buscar contato por variações do telefone (com e sem 9º dígito brasileiro)
    const phoneVariations = getPhoneVariations(from);
    console.log('[CloudAPI] Phone variations for search:', phoneVariations);

    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, phone, assigned_to')
      .in('phone', phoneVariations)
      .eq('tenant_id', config.tenant_id)
      .order('created_at', { ascending: true }) // Pegar o mais antigo
      .limit(1)
      .maybeSingle();

    let contactId = existingContact?.id;

    if (existingContact) {
      console.log(`[CloudAPI] ✅ Found existing contact with phone ${existingContact.phone} (searched: ${from})`);
    }

    if (!contactId) {
      // Normalizar telefone para armazenamento (sempre com 55 e 9º dígito)
      let normalizedPhone = from.replace(/\D/g, '');
      if (!normalizedPhone.startsWith('55')) {
        normalizedPhone = `55${normalizedPhone}`;
      }
      // Se tem 12 dígitos (55 + DDD + 8), adicionar o 9
      if (normalizedPhone.length === 12) {
        const ddd = normalizedPhone.slice(2, 4);
        const rest = normalizedPhone.slice(4);
        normalizedPhone = `55${ddd}9${rest}`;
      }
      
      console.log(`[CloudAPI] Creating new contact with normalized phone: ${normalizedPhone} (original: ${from})`);
      const { data: newContact } = await supabase
        .from('contacts')
        .insert({
          phone: normalizedPhone,
          full_name: contactName,
          tenant_id: config.tenant_id,
        })
        .select('id')
        .single();
      contactId = newContact?.id;
    }

    // Find or create conversation - COM MIGRAÇÃO AUTOMÁTICA DE CANAL
    let conversationId: string | undefined;
    
    // 1. Primeiro, tentar encontrar conversa aberta existente NO MESMO CANAL
    const { data: existingConversation } = await supabase
      .from('conversations')
      .select('id, channel_id')
      .eq('contact_id', contactId)
      .eq('channel_id', config.channel_id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConversation?.id) {
      conversationId = existingConversation.id;
    } else {
      // 2. Se não encontrou, buscar conversa aberta EM QUALQUER CANAL para este contato
      const { data: anyChannelConversation } = await supabase
        .from('conversations')
        .select('id, channel_id, assigned_to, department_id, status')
        .eq('contact_id', contactId)
        .eq('tenant_id', config.tenant_id)
        .in('status', ['open', 'pending'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (anyChannelConversation) {
        // 3. Verificar se realmente houve mudança de canal
        const oldChannelId = anyChannelConversation.channel_id;
        const channelActuallyChanged = oldChannelId !== config.channel_id;
        
        if (channelActuallyChanged) {
          // Migrar a conversa para o novo canal (mantém atendente e departamento)
          console.log(`[CloudAPI] 🔄 Migrating conversation ${anyChannelConversation.id} from channel ${oldChannelId} to ${config.channel_id}`);
          
          await supabase
            .from('conversations')
            .update({
              channel_id: config.channel_id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', anyChannelConversation.id);

          // 4. Registrar evento de mudança de canal no histórico (APENAS se canal mudou)
          await supabase.from('conversation_events').insert({
            conversation_id: anyChannelConversation.id,
            event_type: 'channel_changed',
            tenant_id: config.tenant_id,
            data: {
              from_channel_id: oldChannelId,
              to_channel_id: config.channel_id,
              reason: 'client_message_from_different_channel',
              preserved: {
                assigned_to: anyChannelConversation.assigned_to,
                department_id: anyChannelConversation.department_id,
              }
            }
          });

          console.log(`[CloudAPI] ✅ Conversation migrated successfully - Agent and department preserved`);
        }

        conversationId = anyChannelConversation.id;
      } else {
        // 5. Nenhuma conversa encontrada - criar nova COM departamento do canal e dados CTWA
        console.log(`[CloudAPI] Creating new conversation with department_id: ${channelDepartmentId}, isCTWA: ${isCTWA}`);
        const { data: newConversation, error: convError } = await supabase
          .from('conversations')
          .insert({
            contact_id: contactId,
            channel_id: config.channel_id,
            tenant_id: config.tenant_id,
            status: 'open',
            department_id: channelDepartmentId, // Departamento configurado no canal
            referral_source: isCTWA ? 'ctwa_ad' : (referral?.source_type || null),
            referral_data: referral || null,
          })
          .select('id')
          .single();
        
        if (convError) {
          // Se erro de chave duplicada, buscar a conversa que foi criada por outro processo
          if (convError.code === '23505') {
            console.log('[CloudAPI] Duplicate key detected, fetching existing conversation');
            const { data: existingConv } = await supabase
              .from('conversations')
              .select('id')
              .eq('contact_id', contactId)
              .eq('channel_id', config.channel_id)
              .eq('status', 'open')
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            conversationId = existingConv?.id;
          } else {
            console.error('[CloudAPI] Error creating conversation:', convError);
          }
        } else {
          conversationId = newConversation?.id;
        }
      }
    }

    // If we have a referral and conversation exists, update referral data if not already set
    if (referral && conversationId) {
      const { error: referralUpdateError } = await supabase
        .from('conversations')
        .update({
          referral_source: isCTWA ? 'ctwa_ad' : referral.source_type,
          referral_data: referral,
        })
        .eq('id', conversationId)
        .is('referral_data', null); // Only if not already set
      
      if (!referralUpdateError) {
        console.log(`[CloudAPI] 📢 Updated conversation ${conversationId} with CTWA referral data`);
      }
    }

    let content = '';
    let mediaUrl = null;

    switch (messageType) {
      case 'text':
        content = message.text?.body || '';
        break;
      case 'image':
        content = message.image?.caption || '[Imagem]';
        if (message.image?.id && config.access_token) {
          mediaUrl = await downloadAndUploadMedia(supabase, message.image.id, 'image', conversationId!, config.access_token);
        }
        break;
      case 'audio':
        content = '[Áudio]';
        if (message.audio?.id && config.access_token) {
          mediaUrl = await downloadAndUploadMedia(supabase, message.audio.id, 'audio', conversationId!, config.access_token);
        }
        break;
      case 'video':
        content = message.video?.caption || '[Vídeo]';
        if (message.video?.id && config.access_token) {
          mediaUrl = await downloadAndUploadMedia(supabase, message.video.id, 'video', conversationId!, config.access_token);
        }
        break;
      case 'document':
        content = message.document?.filename || '[Documento]';
        if (message.document?.id && config.access_token) {
          mediaUrl = await downloadAndUploadMedia(supabase, message.document.id, 'document', conversationId!, config.access_token);
        }
        break;
      case 'sticker':
        content = '[Sticker]';
        if (message.sticker?.id && config.access_token) {
          mediaUrl = await downloadAndUploadMedia(supabase, message.sticker.id, 'sticker', conversationId!, config.access_token);
        }
        break;
      case 'interactive':
        // Quick reply button or list selection
        if (message.interactive?.button_reply) {
          content = message.interactive.button_reply.title || '[Botão]';
          console.log('[CloudAPI] Interactive button_reply:', message.interactive.button_reply);
        } else if (message.interactive?.list_reply) {
          content = message.interactive.list_reply.title || '[Lista]';
          console.log('[CloudAPI] Interactive list_reply:', message.interactive.list_reply);
        } else {
          content = '[Interativo]';
        }
        break;
      case 'button':
        // Simple button response (template button clicks)
        content = message.button?.text || '[Botão]';
        console.log('[CloudAPI] Button message:', message.button);
        break;
      case 'contacts':
        // vCard contact shared by client
        const vCardContact = message.contacts?.[0];
        if (vCardContact) {
          const contactNameVCard = vCardContact.name?.formatted_name || 
                            vCardContact.name?.first_name || 
                            'Contato';
          const contactPhoneVCard = vCardContact.phones?.[0]?.phone || 
                             vCardContact.phones?.[0]?.wa_id || '';
          content = `📇 ${contactNameVCard}${contactPhoneVCard ? ` (${contactPhoneVCard})` : ''}`;
          console.log('[CloudAPI] vCard contact received:', contactNameVCard, contactPhoneVCard);
        } else {
          content = '[Contato]';
        }
        break;
      case 'location':
        // Location shared by client
        const loc = message.location;
        if (loc) {
          const locName = loc.name || '';
          const locAddress = loc.address || '';
          content = `📍 ${locName || 'Localização'}${locAddress ? ` - ${locAddress}` : ''} (${loc.latitude}, ${loc.longitude})`;
          console.log('[CloudAPI] Location received:', loc);
        } else {
          content = '[Localização]';
        }
        break;
      default:
        content = `[${messageType}]`;
        console.log('[CloudAPI] Unknown message type:', messageType, JSON.stringify(message));
    }

    // Check for reply/quote context
    let replyToMessageId = null;
    if (message.context?.id) {
      console.log('[CloudAPI] Looking for quoted message:', message.context.id);
      const { data: quotedMsg } = await supabase
        .from('messages')
        .select('id')
        .eq('whatsapp_message_id', message.context.id)
        .single();
      
      if (quotedMsg) {
        replyToMessageId = quotedMsg.id;
        console.log('[CloudAPI] Found quoted message, reply_to_message_id:', replyToMessageId);
      } else {
        console.log('[CloudAPI] Quoted message not found in database');
      }
    }

    // Insert message (usando whatsapp_message_id que é a coluna correta)
    const { data: insertedMessage, error: insertError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      contact_id: contactId,
      tenant_id: config.tenant_id,
      content,
      message_type: messageType,
      media_url: mediaUrl,
      is_from_me: false,
      whatsapp_message_id: message.id,
      reply_to_message_id: replyToMessageId,
    }).select('id').single();

    if (insertError) {
      console.error('[CloudAPI] ❌ Error inserting message:', insertError.message, {
        messageType,
        conversationId,
        content: content.substring(0, 50),
        whatsapp_message_id: message.id,
      });
    } else if (insertedMessage) {
      console.log('[CloudAPI] ✅ Message inserted successfully:', insertedMessage.id, 'type:', messageType);
    }

    // Update conversation - incrementar unread_count usando SQL direto
    await supabase.rpc('increment_unread', { conv_id: conversationId });

    // Atualizar outros campos da conversa (incluindo last_client_message_at para abrir janela 24h)
    const { data: conversationData } = await supabase
      .from('conversations')
      .update({
        last_message_at: timestamp.toISOString(),
        last_message_preview: content.substring(0, 100),
        last_message_is_from_me: false,
        is_unread: true,
        last_client_message_at: timestamp.toISOString(), // Abre janela de 24 horas
      })
      .eq('id', conversationId)
      .select('department_id, assigned_to, status, priority, unread_count, created_at')
      .single();

    // Disparar webhook de mensagem recebida com dados enriquecidos
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      // Buscar dados completos do contato
      const { data: contactData } = await supabase
        .from('contacts')
        .select('id, full_name, phone, email, lead_status, lead_score')
        .eq('id', contactId)
        .single();

      // Buscar nome do departamento
      let departmentData = null;
      if (conversationData?.department_id) {
        const { data: dept } = await supabase
          .from('departments')
          .select('id, name')
          .eq('id', conversationData.department_id)
          .single();
        departmentData = dept;
      }

      // Buscar dados do agente atribuído
      let agentData = null;
      if (conversationData?.assigned_to) {
        const { data: agent } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('id', conversationData.assigned_to)
          .single();
        agentData = agent;
      }

      // Buscar nome do canal
      let channelData = null;
      if (config.channel_id) {
        const { data: channel } = await supabase
          .from('whatsapp_channels')
          .select('id, name, phone_number')
          .eq('id', config.channel_id)
          .single();
        channelData = channel;
      }
      
      await fetch(`${supabaseUrl}/functions/v1/dispatch-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          action: 'dispatch',
          event: {
            type: 'message.received',
            data: {
              message: {
                id: insertedMessage?.id,
                whatsapp_message_id: message.id,
                type: messageType,
                content,
                media_url: mediaUrl,
                timestamp: timestamp.toISOString(),
              },
              contact: {
                id: contactId,
                name: contactData?.full_name || contactName,
                phone: contactData?.phone || from,
                email: contactData?.email || null,
                lead_status: contactData?.lead_status || null,
                lead_score: contactData?.lead_score || null,
              },
              conversation: {
                id: conversationId,
                status: conversationData?.status || 'open',
                priority: conversationData?.priority || null,
                unread_count: conversationData?.unread_count || 0,
                created_at: conversationData?.created_at || null,
              },
              department: {
                id: conversationData?.department_id || null,
                name: departmentData?.name || null,
              },
              channel: {
                id: config.channel_id,
                name: channelData?.name || null,
                phone_number: channelData?.phone_number || null,
              },
              agent: agentData ? {
                id: agentData.id,
                name: agentData.full_name,
                email: agentData.email,
              } : null,
            },
            context: {
              department: { id: conversationData?.department_id },
              channel: { id: config.channel_id },
              assigned_to: conversationData?.assigned_to,
              tenant_id: config.tenant_id,
            },
          },
        }),
      });
      console.log('[CloudAPI] Webhook dispatched for message.received');
    } catch (webhookError) {
      console.error('[CloudAPI] Error dispatching webhook:', webhookError);
    }
  }
}

async function processStatuses(supabase: any, value: any) {
  const statuses = value.statuses || [];
  
  console.log(`[CloudAPI] Processing ${statuses.length} status updates`);
  
  for (const status of statuses) {
    const messageId = status.id;
    const statusValue = status.status; // sent, delivered, read, failed
    const timestamp = new Date(parseInt(status.timestamp) * 1000);

    console.log('[CloudAPI] Updating message status:', { 
      whatsappMessageId: messageId, 
      status: statusValue, 
      timestamp: timestamp.toISOString() 
    });

    // Map Cloud API status to our status
    const statusMap: Record<string, string> = {
      'sent': 'sent',
      'delivered': 'delivered',
      'read': 'read',
      'failed': 'failed',
    };

    // Usar whatsapp_message_id que é a coluna correta
    const { error } = await supabase
      .from('messages')
      .update({ status: statusMap[statusValue] || statusValue })
      .eq('whatsapp_message_id', messageId);

    if (error) {
      console.error('[CloudAPI] Error updating message status:', error);
    } else {
      console.log('[CloudAPI] Message status updated successfully:', statusValue);
    }
  }
}

async function processCalls(supabase: any, value: any) {
  const metadata = value.metadata;
  const calls = value.calls || [];
  const phoneNumberId = metadata?.phone_number_id;

  // Find the config for this phone_number_id
  const { data: config } = await supabase
    .from('cloudapi_configs')
    .select('id, tenant_id, channel_id, calling_enabled')
    .eq('phone_number_id', phoneNumberId)
    .eq('is_active', true)
    .single();

  if (!config) {
    console.log('[Calls] No config found for phone_number_id:', phoneNumberId);
    return;
  }

  if (!config.calling_enabled) {
    console.log('[Calls] Calling not enabled for config:', config.id);
    return;
  }
  
  for (const call of calls) {
    const callId = call.id;
    const from = call.from;
    const to = call.to;
    const status = call.status; // ringing, accepted, rejected, terminated, completed, failed
    const direction = call.direction; // user_initiated, business_initiated
    const timestamp = new Date(parseInt(call.timestamp) * 1000);
    const duration = call.duration; // in seconds
    const errorCode = call.error?.code;
    const mediaType = call.media_type; // audio, video
    const session = call.session; // Contains SDP offer/answer

    console.log('[Calls] Processing call event:', { 
      callId, 
      from, 
      to, 
      status, 
      direction, 
      duration,
      mediaType,
      hasSDP: !!session?.sdp,
      timestamp 
    });

    // Find contact
    const phone = direction === 'user_initiated' ? from : to;
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, full_name, avatar_url')
      .eq('phone', phone)
      .eq('tenant_id', config.tenant_id)
      .single();

    // Find existing call log
    const { data: existingCall } = await supabase
      .from('call_logs')
      .select('id, start_time, user_id, conversation_id')
      .eq('whatsapp_call_id', callId)
      .single();

    let callLogId = existingCall?.id;

    if (existingCall) {
      // Update existing call
      const updates: Record<string, any> = {
        call_status: status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'completed' || status === 'terminated') {
        updates.end_time = timestamp.toISOString();
        if (duration) {
          updates.duration_seconds = duration;
        }
      }

      if (errorCode) {
        updates.error_code = errorCode;
      }

      await supabase
        .from('call_logs')
        .update(updates)
        .eq('id', existingCall.id);
    } else if (contact) {
      // Create new call log
      const { data: newCallLog } = await supabase
        .from('call_logs')
        .insert({
          contact_id: contact.id,
          tenant_id: config.tenant_id,
          channel_id: config.channel_id,
          whatsapp_call_id: callId,
          call_type: 'whatsapp',
          direction: direction === 'user_initiated' ? 'inbound' : 'outbound',
          call_status: status,
          start_time: timestamp.toISOString(),
          call_date: timestamp.toISOString().split('T')[0],
          call_time: timestamp.toTimeString().split(' ')[0],
          user_id: null, // Will be set when agent answers
        })
        .select('id')
        .single();

      callLogId = newCallLog?.id;
    }

    // Broadcast incoming calls via Realtime
    if (status === 'ringing' && direction === 'user_initiated') {
      console.log('[Calls] Broadcasting incoming call to agents');
      
      await supabase.channel('incoming-calls').send({
        type: 'broadcast',
        event: 'incoming_call',
        payload: {
          callId,
          callLogId,
          phone: from,
          contactId: contact?.id,
          contactName: contact?.full_name || from,
          contactAvatar: contact?.avatar_url,
          channelId: config.channel_id,
          tenantId: config.tenant_id,
          mediaType: mediaType || 'audio',
          sdpOffer: session?.sdp || null,
          sdpType: session?.sdp_type || null,
          timestamp: timestamp.toISOString(),
        },
      });
    }
    
    // Broadcast call state changes for active calls
    if (['accepted', 'rejected', 'terminated', 'completed', 'failed'].includes(status)) {
      console.log('[Calls] Broadcasting call state change:', status);
      
      await supabase.channel('call-events').send({
        type: 'broadcast',
        event: 'call_state_changed',
        payload: {
          callId,
          callLogId,
          status,
          duration,
          timestamp: timestamp.toISOString(),
        },
      });
    }
  }
}

// Process reactions from Cloud API - update existing message reactions
async function processReaction(supabase: any, message: any, from: string, tenantId: string) {
  const reaction = message.reaction;
  if (!reaction) {
    console.log('[CloudAPI] No reaction data in message');
    return;
  }

  const emoji = reaction.emoji || '';
  const targetMessageId = reaction.message_id;

  if (!targetMessageId) {
    console.log('[CloudAPI] No target message_id for reaction');
    return;
  }

  // Find the original message by whatsapp_message_id
  const { data: targetMessage, error: findError } = await supabase
    .from('messages')
    .select('id, reactions, conversation_id, contact_id')
    .eq('whatsapp_message_id', targetMessageId)
    .eq('tenant_id', tenantId)
    .single();

  if (findError || !targetMessage) {
    console.log('[CloudAPI] Target message not found for reaction:', targetMessageId, findError?.message);
    return;
  }

  console.log('[CloudAPI] Found target message:', targetMessage.id, 'for reaction');

  // Get current reactions or initialize empty array
  let currentReactions: any[] = targetMessage.reactions || [];
  
  // Use contact_id as the user_id for reactions from contacts
  const reactionUserId = targetMessage.contact_id;

  if (!emoji) {
    // Empty emoji = remove reaction from this user
    console.log('[CloudAPI] Removing reaction from user:', reactionUserId);
    currentReactions = currentReactions.filter(
      (r: any) => !(r.from_contact === true && r.user_id === reactionUserId)
    );
  } else {
    // Check if user already has a reaction
    const existingIndex = currentReactions.findIndex(
      (r: any) => r.from_contact === true && r.user_id === reactionUserId
    );

    const newReaction = {
      emoji,
      user_id: reactionUserId,
      from_contact: true,
      created_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      // Update existing reaction
      currentReactions[existingIndex] = newReaction;
      console.log('[CloudAPI] Updated existing reaction to:', emoji);
    } else {
      // Add new reaction
      currentReactions.push(newReaction);
      console.log('[CloudAPI] Added new reaction:', emoji);
    }
  }

  // Update the message with new reactions array
  const { error: updateError } = await supabase
    .from('messages')
    .update({ reactions: currentReactions })
    .eq('id', targetMessage.id);

  if (updateError) {
    console.error('[CloudAPI] ❌ Error updating reactions:', updateError.message);
  } else {
    console.log('[CloudAPI] ✅ Reactions updated successfully, total:', currentReactions.length);
  }
}
