import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Download media from Instagram and upload to Supabase Storage
async function downloadAndUploadMedia(
  supabase: any,
  mediaUrl: string,
  messageType: string,
  conversationId: string
): Promise<string | null> {
  try {
    console.log(`[Instagram] Downloading media for conversation ${conversationId}`);

    const mediaResponse = await fetch(mediaUrl);
    if (!mediaResponse.ok) {
      console.error('[Instagram] Failed to download media:', mediaResponse.status);
      return null;
    }

    const contentType = mediaResponse.headers.get('content-type') || 'application/octet-stream';
    const mediaBuffer = await mediaResponse.arrayBuffer();

    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/ogg': 'ogg',
    };

    const extension = extensionMap[contentType.split(';')[0]] || 'bin';
    const fileName = `${conversationId}/${Date.now()}_ig_${messageType}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('conversation-attachments')
      .upload(fileName, mediaBuffer, {
        contentType,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('[Instagram] Upload error:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('conversation-attachments')
      .getPublicUrl(fileName);

    console.log(`[Instagram] Media uploaded: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('[Instagram] Media download/upload error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);

    // =========================================================
    // WEBHOOK VERIFICATION (GET) - Meta envia para validar
    // =========================================================
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('[Instagram Webhook] Verification request:', { mode, token, challenge });

      if (mode === 'subscribe' && token) {
        // Buscar canal com verify_token correspondente
        const { data: channel } = await supabase
          .from('instagram_channels')
          .select('id, verify_token')
          .eq('verify_token', token)
          .eq('is_active', true)
          .eq('is_deleted', false)
          .single();

        if (channel) {
          await supabase
            .from('instagram_channels')
            .update({ webhook_configured: true, updated_at: new Date().toISOString() })
            .eq('id', channel.id);

          console.log('[Instagram Webhook] Verified for channel:', channel.id);
          return new Response(challenge, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
          });
        }
      }

      console.error('[Instagram Webhook] Verification failed: invalid token');
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    // =========================================================
    // INCOMING WEBHOOKS (POST) - Mensagens recebidas
    // =========================================================
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('[Instagram Webhook] Received:', JSON.stringify(body, null, 2));

      // Instagram webhook always has object: 'instagram'
      if (body.object !== 'instagram') {
        console.log('[Instagram Webhook] Ignoring non-instagram object:', body.object);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const entries = body.entry || [];

      for (const entry of entries) {
        const instagramAccountId = entry.id;
        const messagingEvents = entry.messaging || [];

        // Buscar canal pelo instagram_account_id
        const { data: channel } = await supabase
          .from('instagram_channels')
          .select('id, tenant_id, page_id, page_access_token, department_id, instagram_account_id')
          .eq('instagram_account_id', instagramAccountId)
          .eq('is_active', true)
          .eq('is_deleted', false)
          .single();

        if (!channel) {
          console.log('[Instagram Webhook] No channel found for account:', instagramAccountId);
          continue;
        }

        // Log do webhook
        await supabase.from('instagram_webhook_logs').insert({
          tenant_id: channel.tenant_id,
          channel_id: channel.id,
          event_type: 'messaging',
          payload: entry,
          processed: false,
        });

        for (const event of messagingEvents) {
          try {
            await processMessagingEvent(supabase, channel, event);
          } catch (eventError) {
            console.error('[Instagram Webhook] Error processing event:', eventError);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error('[Instagram Webhook] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// =========================================================
// PROCESSAR EVENTO DE MENSAGEM
// =========================================================
async function processMessagingEvent(
  supabase: any,
  channel: any,
  event: any
) {
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();

  // Ignorar echoes (mensagens enviadas por nós)
  if (event.message?.is_echo) {
    console.log('[Instagram] Ignoring echo message');
    // Atualizar status da mensagem se tivermos o mid
    if (event.message?.mid) {
      await supabase
        .from('messages')
        .update({ status: 'sent' })
        .eq('instagram_message_id', event.message.mid);
    }
    return;
  }

  // Processar read receipts
  if (event.read) {
    console.log('[Instagram] Read receipt:', event.read);
    // Marcar mensagens como lidas até o watermark
    return;
  }

  // Processar reactions
  if (event.reaction) {
    console.log('[Instagram] Reaction:', event.reaction);
    return;
  }

  // Só processar messages e postbacks
  if (!event.message && !event.postback) {
    console.log('[Instagram] Ignoring non-message event');
    return;
  }

  // Verificar se o remetente é o próprio Instagram (page/bot)
  const isFromMe = senderId === channel.instagram_account_id || senderId === channel.page_id;
  if (isFromMe) {
    console.log('[Instagram] Message from self, skipping');
    return;
  }

  console.log('[Instagram] Processing message:', {
    senderId,
    recipientId,
    hasMessage: !!event.message,
    hasPostback: !!event.postback,
    tenantId: channel.tenant_id,
  });

  // =========================================================
  // 1. BUSCAR OU CRIAR CONTATO POR IGSID
  // =========================================================
  let contactId: string | null = null;
  let senderName: string | null = null;

  // Tentar obter nome do remetente via Graph API
  try {
    if (channel.page_access_token) {
      const profileResponse = await fetch(
        `https://graph.facebook.com/v21.0/${senderId}?fields=name,username,profile_pic&access_token=${channel.page_access_token}`
      );
      if (profileResponse.ok) {
        const profile = await profileResponse.json();
        senderName = profile.name || profile.username || null;

        // Atualizar username do contato se disponível
        if (profile.username) {
          await supabase
            .from('contacts')
            .update({ instagram_username: profile.username })
            .eq('instagram_id', senderId)
            .eq('tenant_id', channel.tenant_id);
        }
      }
    }
  } catch (profileError) {
    console.log('[Instagram] Could not fetch sender profile:', profileError);
  }

  // Buscar contato existente pelo instagram_id
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, full_name, instagram_username')
    .eq('instagram_id', senderId)
    .eq('tenant_id', channel.tenant_id)
    .maybeSingle();

  if (existingContact) {
    contactId = existingContact.id;
    // Atualizar nome se estava genérico
    if (senderName && existingContact.full_name?.startsWith('Instagram ')) {
      await supabase
        .from('contacts')
        .update({ full_name: senderName })
        .eq('id', contactId);
    }
  } else {
    // Criar novo contato
    const { data: newContact, error: contactError } = await supabase
      .from('contacts')
      .insert({
        instagram_id: senderId,
        full_name: senderName || `Instagram ${senderId.slice(-6)}`,
        origin: 'instagram',
        tenant_id: channel.tenant_id,
      })
      .select('id')
      .single();

    if (contactError) {
      if (contactError.code === '23505') {
        // Duplicata - buscar existente
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('instagram_id', senderId)
          .eq('tenant_id', channel.tenant_id)
          .maybeSingle();
        contactId = existing?.id || null;
      } else {
        console.error('[Instagram] Error creating contact:', contactError);
        return;
      }
    } else {
      contactId = newContact?.id || null;
    }
  }

  if (!contactId) {
    console.error('[Instagram] Failed to resolve contact for sender:', senderId);
    return;
  }

  // =========================================================
  // 2. BUSCAR OU CRIAR CONVERSA
  // =========================================================
  let conversationId: string | null = null;
  let isNewConversation = false;

  // Buscar conversa aberta para este contato neste canal Instagram
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId)
    .eq('instagram_channel_id', channel.id)
    .eq('channel_type', 'instagram')
    .in('status', ['open', 'pending'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    // Buscar conversa aberta em qualquer canal Instagram
    const { data: anyIgConv } = await supabase
      .from('conversations')
      .select('id, instagram_channel_id')
      .eq('contact_id', contactId)
      .eq('channel_type', 'instagram')
      .eq('tenant_id', channel.tenant_id)
      .in('status', ['open', 'pending'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (anyIgConv) {
      // Migrar conversa para o canal atual
      if (anyIgConv.instagram_channel_id !== channel.id) {
        await supabase
          .from('conversations')
          .update({
            instagram_channel_id: channel.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', anyIgConv.id);
      }
      conversationId = anyIgConv.id;
    } else {
      // Criar nova conversa
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          contact_id: contactId,
          instagram_channel_id: channel.id,
          channel_type: 'instagram',
          tenant_id: channel.tenant_id,
          status: 'open',
          department_id: channel.department_id || null,
          last_message_at: timestamp.toISOString(),
        })
        .select('id')
        .single();

      if (convError) {
        if (convError.code === '23505') {
          const { data: dup } = await supabase
            .from('conversations')
            .select('id')
            .eq('contact_id', contactId)
            .eq('instagram_channel_id', channel.id)
            .eq('channel_type', 'instagram')
            .in('status', ['open', 'pending'])
            .limit(1)
            .maybeSingle();
          conversationId = dup?.id || null;
        } else {
          console.error('[Instagram] Error creating conversation:', convError);
          return;
        }
      } else {
        conversationId = newConv?.id || null;
        isNewConversation = true;
      }
    }
  }

  if (!conversationId) {
    console.error('[Instagram] Failed to resolve conversation');
    return;
  }

  // =========================================================
  // 3. EXTRAIR CONTEÚDO DA MENSAGEM
  // =========================================================
  let content = '';
  let messageType = 'text';
  let mediaUrl: string | null = null;

  if (event.postback) {
    content = event.postback.title || '[Postback]';
    messageType = 'text';
  } else if (event.message) {
    const msg = event.message;

    if (msg.attachments && msg.attachments.length > 0) {
      const attachment = msg.attachments[0];
      const attachmentType = attachment.type;
      const attachmentUrl = attachment.payload?.url;

      switch (attachmentType) {
        case 'image':
          messageType = 'image';
          content = msg.text || '[Imagem]';
          if (attachmentUrl) {
            mediaUrl = await downloadAndUploadMedia(supabase, attachmentUrl, 'image', conversationId);
          }
          break;
        case 'video':
          messageType = 'video';
          content = '[Vídeo]';
          if (attachmentUrl) {
            mediaUrl = await downloadAndUploadMedia(supabase, attachmentUrl, 'video', conversationId);
          }
          break;
        case 'audio':
          messageType = 'audio';
          content = '[Áudio]';
          if (attachmentUrl) {
            mediaUrl = await downloadAndUploadMedia(supabase, attachmentUrl, 'audio', conversationId);
          }
          break;
        case 'story_mention':
          messageType = 'image';
          content = '[Menção no Story]';
          if (attachmentUrl) {
            mediaUrl = await downloadAndUploadMedia(supabase, attachmentUrl, 'story', conversationId);
          }
          break;
        case 'reel':
          messageType = 'video';
          content = msg.text || '[Resposta ao Reel]';
          if (attachmentUrl) {
            mediaUrl = await downloadAndUploadMedia(supabase, attachmentUrl, 'reel', conversationId);
          }
          break;
        default:
          messageType = 'text';
          content = msg.text || `[${attachmentType}]`;
      }
    } else {
      messageType = 'text';
      content = msg.text || '';
    }

    // Story reply detection
    if (msg.reply_to?.story) {
      if (!content) content = '[Resposta ao Story]';
    }
  }

  // =========================================================
  // 4. SALVAR MENSAGEM
  // =========================================================
  const instagramMessageId = event.message?.mid || event.postback?.mid || null;

  // Check for duplicate
  if (instagramMessageId) {
    const { data: existingMsg } = await supabase
      .from('messages')
      .select('id')
      .eq('instagram_message_id', instagramMessageId)
      .maybeSingle();

    if (existingMsg) {
      console.log('[Instagram] Duplicate message, skipping:', instagramMessageId);
      return;
    }
  }

  const { error: msgError } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    contact_id: contactId,
    content,
    message_type: messageType,
    media_url: mediaUrl,
    is_from_me: false,
    instagram_message_id: instagramMessageId,
    status: 'delivered',
    tenant_id: channel.tenant_id,
    created_at: timestamp.toISOString(),
  });

  if (msgError) {
    console.error('[Instagram] Error saving message:', msgError);
    return;
  }

  // =========================================================
  // 5. ATUALIZAR CONVERSA
  // =========================================================
  const preview = getMessagePreview(messageType, content);

  const { data: currentConv } = await supabase
    .from('conversations')
    .select('unread_count')
    .eq('id', conversationId)
    .single();

  await supabase
    .from('conversations')
    .update({
      last_message_at: timestamp.toISOString(),
      last_message_preview: preview,
      last_message_is_from_me: false,
      unread_count: (currentConv?.unread_count || 0) + 1,
      is_unread: true,
      status: 'open',
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId);

  // Atualizar estatísticas do canal
  await supabase.rpc('increment_field', {
    table_name: 'instagram_channels',
    field_name: 'messages_received',
    row_id: channel.id,
    increment_by: 1,
  }).catch(() => {
    // Se RPC não existir, atualizar diretamente
    supabase
      .from('instagram_channels')
      .update({
        messages_received: (channel.messages_received || 0) + 1,
        last_sync_at: new Date().toISOString(),
      })
      .eq('id', channel.id);
  });

  console.log(`[Instagram] ✅ Message saved: conv=${conversationId}, contact=${contactId}, type=${messageType}`);

  // =========================================================
  // 6. DISPARAR FLOW TRIGGERS (se configurado)
  // =========================================================
  if (isNewConversation) {
    try {
      await supabase.functions.invoke('process-flow-triggers', {
        body: {
          conversation_id: conversationId,
          contact_id: contactId,
          tenant_id: channel.tenant_id,
          trigger_type: 'first_message',
          message_content: content,
          channel_type: 'instagram',
        },
      });
    } catch (flowError) {
      console.log('[Instagram] Flow trigger error (non-critical):', flowError);
    }
  }
}

function getMessagePreview(type: string, content: string): string {
  switch (type) {
    case 'image': return '📷 Imagem';
    case 'video': return '🎬 Vídeo';
    case 'audio': return '🎵 Áudio';
    default: return content.substring(0, 100);
  }
}
