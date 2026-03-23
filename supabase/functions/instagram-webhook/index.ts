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
  conversationId: string,
  accessToken: string
): Promise<string | null> {
  try {
    console.log(`[Instagram] Downloading media for conversation ${conversationId}`);

    const mediaResponse = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!mediaResponse.ok) {
      console.error('[Instagram] Failed to download media:', mediaResponse.status);
      return null;
    }

    const mediaBuffer = await mediaResponse.arrayBuffer();
    const contentType = mediaResponse.headers.get('content-type') || 'application/octet-stream';

    const extensionMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'audio/mp4': 'm4a',
      'audio/mpeg': 'mp3',
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
    console.error('[Instagram] Error downloading/uploading media:', error);
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

    // =====================================================
    // GET - Webhook verification from Meta
    // =====================================================
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('[Instagram] Webhook verification:', { mode, token, challenge });

      if (mode === 'subscribe' && token) {
        const { data: config } = await supabase
          .from('instagram_configs')
          .select('id, verify_token')
          .eq('verify_token', token)
          .eq('is_active', true)
          .single();

        if (config) {
          await supabase
            .from('instagram_configs')
            .update({ webhook_configured: true })
            .eq('id', config.id);

          console.log('[Instagram] Webhook verified for config:', config.id);
          return new Response(challenge, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
          });
        }
      }

      console.error('[Instagram] Webhook verification failed');
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    // =====================================================
    // POST - Incoming Instagram webhooks
    // =====================================================
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('[Instagram] Received webhook:', JSON.stringify(body, null, 2));

      const entries = body.entry || [];

      for (const entry of entries) {
        // Instagram webhooks use "messaging" array (not "changes")
        const messagingEvents = entry.messaging || [];
        // Also handle "changes" for some event types
        const changes = entry.changes || [];

        // Process messaging events (DMs)
        for (const event of messagingEvents) {
          await processMessagingEvent(supabase, event, entry.id);
        }

        // Process changes (stories, comments mentions etc - log only)
        for (const change of changes) {
          console.log('[Instagram] Change event:', change.field, JSON.stringify(change.value));
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  } catch (error) {
    console.error('[Instagram] Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processMessagingEvent(supabase: any, event: any, pageId: string) {
  const senderId = event.sender?.id;
  const recipientId = event.recipient?.id;
  const timestamp = event.timestamp ? new Date(event.timestamp * 1000) : new Date();

  if (!senderId || !recipientId) {
    console.log('[Instagram] Missing sender/recipient');
    return;
  }

  // Determine if this is an incoming message (from user) or echo (from page)
  const isEcho = event.message?.is_echo === true;
  const isFromMe = isEcho || senderId === recipientId;

  // Find config for this page
  const { data: config } = await supabase
    .from('instagram_configs')
    .select('id, tenant_id, channel_id, page_access_token, page_id, instagram_account_id')
    .eq('page_id', recipientId)
    .eq('is_active', true)
    .single();

  // If not found by recipient (incoming), try by sender (echo/outgoing)
  let activeConfig = config;
  if (!activeConfig && isEcho) {
    const { data: echoConfig } = await supabase
      .from('instagram_configs')
      .select('id, tenant_id, channel_id, page_access_token, page_id, instagram_account_id')
      .eq('page_id', senderId)
      .eq('is_active', true)
      .single();
    activeConfig = echoConfig;
  }

  if (!activeConfig) {
    console.log('[Instagram] No config found for page:', recipientId, 'or sender:', senderId);
    return;
  }

  // Log webhook
  await supabase.from('instagram_webhook_logs').insert({
    event_type: event.message ? 'message' : (event.postback ? 'postback' : 'unknown'),
    payload: event,
    sender_id: senderId,
    config_id: activeConfig.id,
    channel_id: activeConfig.channel_id,
    tenant_id: activeConfig.tenant_id,
  });

  // Skip echo messages (messages sent by the page itself)
  if (isEcho) {
    console.log('[Instagram] Skipping echo message');
    return;
  }

  // Handle message delivery/read receipts
  if (event.delivery || event.read) {
    console.log('[Instagram] Delivery/read receipt, skipping');
    return;
  }

  // Handle postbacks (quick reply buttons from ice breakers, etc)
  if (event.postback) {
    console.log('[Instagram] Postback:', event.postback);
    await processInstagramMessage(supabase, activeConfig, senderId, {
      mid: `postback_${Date.now()}`,
      text: event.postback.title || event.postback.payload || '[Postback]',
    }, timestamp);
    return;
  }

  // Handle regular messages
  if (event.message) {
    await processInstagramMessage(supabase, activeConfig, senderId, event.message, timestamp);
  }
}

async function processInstagramMessage(
  supabase: any,
  config: any,
  senderId: string,
  message: any,
  timestamp: Date
) {
  console.log('[Instagram] Processing message from:', senderId, 'type:', message.attachments?.[0]?.type || 'text');

  // Get channel department
  let channelDepartmentId: string | null = null;
  if (config.channel_id) {
    const { data: channelInfo } = await supabase
      .from('whatsapp_channels')
      .select('department_id')
      .eq('id', config.channel_id)
      .single();
    channelDepartmentId = channelInfo?.department_id || null;
  }

  // Get sender profile from Instagram Graph API
  let senderName = senderId;
  try {
    const profileResponse = await fetch(
      `https://graph.facebook.com/v21.0/${senderId}?fields=name,username,profile_pic&access_token=${config.page_access_token}`
    );
    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      senderName = profile.name || (profile.username ? `@${profile.username}` : senderId);
      console.log('[Instagram] Sender profile:', senderName);
    }
  } catch (e) {
    console.warn('[Instagram] Could not fetch sender profile:', e);
  }

  // Find or create contact using Instagram Scoped ID (IGSID)
  // We store the IGSID in the phone field with prefix "ig:" for identification
  const igPhone = `ig:${senderId}`;
  
  const { data: existingContact } = await supabase
    .from('contacts')
    .select('id, phone, assigned_to')
    .or(`phone.eq.${igPhone}`)
    .eq('tenant_id', config.tenant_id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  let contactId = existingContact?.id;

  if (!contactId) {
    console.log(`[Instagram] Creating new contact: ${senderName} (${igPhone})`);
    const { data: newContact } = await supabase
      .from('contacts')
      .insert({
        phone: igPhone,
        full_name: senderName,
        tenant_id: config.tenant_id,
        origin: 'instagram_direct',
      })
      .select('id')
      .single();
    contactId = newContact?.id;
  }

  if (!contactId) {
    console.error('[Instagram] Failed to create/find contact');
    return;
  }

  // Find or create conversation
  let conversationId: string | undefined;

  // 1. Check for existing open conversation on same channel
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id, channel_id')
    .eq('contact_id', contactId)
    .eq('channel_id', config.channel_id)
    .in('status', ['open', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingConv) {
    conversationId = existingConv.id;
  } else {
    // 2. Check for any open conversation for this contact
    const { data: anyConv } = await supabase
      .from('conversations')
      .select('id, channel_id, assigned_to, department_id, status')
      .eq('contact_id', contactId)
      .eq('tenant_id', config.tenant_id)
      .in('status', ['open', 'pending'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (anyConv) {
      // Migrate to current channel if different
      if (anyConv.channel_id !== config.channel_id) {
        console.log(`[Instagram] Migrating conversation ${anyConv.id} to Instagram channel`);
        await supabase
          .from('conversations')
          .update({ channel_id: config.channel_id, updated_at: new Date().toISOString() })
          .eq('id', anyConv.id);

        await supabase.from('conversation_events').insert({
          conversation_id: anyConv.id,
          event_type: 'channel_changed',
          tenant_id: config.tenant_id,
          data: {
            from_channel_id: anyConv.channel_id,
            to_channel_id: config.channel_id,
            reason: 'instagram_direct_message',
          },
        });
      }
      conversationId = anyConv.id;
    } else {
      // 3. Check for closed conversations to reopen
      const { data: closedConv } = await supabase
        .from('conversations')
        .select('id, assigned_to, department_id')
        .eq('contact_id', contactId)
        .eq('tenant_id', config.tenant_id)
        .eq('status', 'closed')
        .order('closed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (closedConv) {
        console.log(`[Instagram] Reopening closed conversation ${closedConv.id}`);
        await supabase
          .from('conversations')
          .update({
            status: closedConv.assigned_to ? 'open' : 'pending',
            channel_id: config.channel_id,
            reopened_at: new Date().toISOString(),
            reopen_count: supabase.rpc ? undefined : 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', closedConv.id);
        conversationId = closedConv.id;
      } else {
        // 4. Create new conversation
        console.log('[Instagram] Creating new conversation');
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({
            contact_id: contactId,
            channel_id: config.channel_id,
            tenant_id: config.tenant_id,
            status: 'pending',
            department_id: channelDepartmentId,
            referral_source: 'instagram_direct',
          })
          .select('id')
          .single();

        if (convError) {
          if (convError.code === '23505') {
            const { data: existing } = await supabase
              .from('conversations')
              .select('id')
              .eq('contact_id', contactId)
              .eq('channel_id', config.channel_id)
              .in('status', ['open', 'pending'])
              .limit(1)
              .single();
            conversationId = existing?.id;
          } else {
            console.error('[Instagram] Error creating conversation:', convError);
            return;
          }
        } else {
          conversationId = newConv?.id;
        }
      }
    }
  }

  if (!conversationId) {
    console.error('[Instagram] No conversation ID available');
    return;
  }

  // Extract message content
  let content = '';
  let mediaUrl: string | null = null;
  let messageType = 'text';

  if (message.text) {
    content = message.text;
    messageType = 'text';
  }

  if (message.attachments && message.attachments.length > 0) {
    const attachment = message.attachments[0];
    const attachType = attachment.type;

    switch (attachType) {
      case 'image':
        messageType = 'image';
        content = '[Imagem]';
        if (attachment.payload?.url) {
          mediaUrl = await downloadAndUploadMedia(
            supabase, attachment.payload.url, 'image', conversationId, config.page_access_token
          );
        }
        break;
      case 'video':
        messageType = 'video';
        content = '[Vídeo]';
        if (attachment.payload?.url) {
          mediaUrl = await downloadAndUploadMedia(
            supabase, attachment.payload.url, 'video', conversationId, config.page_access_token
          );
        }
        break;
      case 'audio':
        messageType = 'audio';
        content = '[Áudio]';
        if (attachment.payload?.url) {
          mediaUrl = await downloadAndUploadMedia(
            supabase, attachment.payload.url, 'audio', conversationId, config.page_access_token
          );
        }
        break;
      case 'file':
        messageType = 'document';
        content = '[Arquivo]';
        if (attachment.payload?.url) {
          mediaUrl = await downloadAndUploadMedia(
            supabase, attachment.payload.url, 'document', conversationId, config.page_access_token
          );
        }
        break;
      case 'share':
        // Shared post/reel/story
        messageType = 'text';
        content = attachment.payload?.url
          ? `📎 Compartilhou: ${attachment.payload.url}`
          : '[Compartilhamento]';
        break;
      case 'story_mention':
        messageType = 'text';
        content = '📖 Mencionou você nos Stories';
        if (attachment.payload?.url) {
          mediaUrl = await downloadAndUploadMedia(
            supabase, attachment.payload.url, 'image', conversationId, config.page_access_token
          );
        }
        break;
      default:
        content = `[${attachType}]`;
    }

    // If there's text alongside the attachment
    if (message.text && attachType !== 'share') {
      content = message.text;
    }
  }

  // Quick reply
  if (message.quick_reply) {
    content = message.text || message.quick_reply.payload || '[Resposta rápida]';
  }

  // Sticker (special case of image)
  if (message.sticker_id) {
    messageType = 'sticker';
    content = '[Sticker]';
  }

  // Story reply
  if (message.reply_to?.story) {
    content = `💬 Respondeu ao Story: ${content}`;
    if (message.reply_to.story.url) {
      // Could download story media too
    }
  }

  // Check idempotency
  const { data: existingMsg } = await supabase
    .from('messages')
    .select('id')
    .eq('whatsapp_message_id', message.mid)
    .maybeSingle();

  let insertedMessage: { id: string } | null = null;

  if (existingMsg) {
    console.log('[Instagram] Message already exists:', message.mid);
    insertedMessage = existingMsg;
  } else {
    const { data, error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      contact_id: contactId,
      tenant_id: config.tenant_id,
      content,
      message_type: messageType,
      media_url: mediaUrl,
      is_from_me: false,
      whatsapp_message_id: message.mid, // Reusing this field for Instagram message ID
    }).select('id').single();

    if (error) {
      console.error('[Instagram] Error inserting message:', error);
      return;
    }
    insertedMessage = data;
  }

  console.log('[Instagram] ✅ Message saved:', insertedMessage?.id);

  // Update conversation
  await supabase.rpc('increment_unread', { conv_id: conversationId });

  await supabase
    .from('conversations')
    .update({
      last_message_at: timestamp.toISOString(),
      last_message_preview: content.substring(0, 100),
      last_message_is_from_me: false,
      is_unread: true,
      last_client_message_at: timestamp.toISOString(),
    })
    .eq('id', conversationId);

  // Dispatch webhook
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const { data: contactData } = await supabase
      .from('contacts')
      .select('id, full_name, phone, email, lead_status, lead_score')
      .eq('id', contactId)
      .single();

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
              whatsapp_message_id: message.mid,
              type: messageType,
              content,
              media_url: mediaUrl,
              timestamp: timestamp.toISOString(),
              source: 'instagram_direct',
            },
            contact: {
              id: contactId,
              name: contactData?.full_name || senderName,
              phone: contactData?.phone || igPhone,
              email: contactData?.email || null,
            },
            conversation: { id: conversationId },
            channel: { id: config.channel_id },
          },
          context: {
            channel: { id: config.channel_id },
            tenant_id: config.tenant_id,
          },
        },
      }),
    });
  } catch (webhookError) {
    console.error('[Instagram] Webhook dispatch error:', webhookError);
  }

  // Trigger flow processing
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    await fetch(`${supabaseUrl}/functions/v1/process-flow-triggers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        type: 'message_received',
        tenant_id: config.tenant_id,
        data: {
          conversation_id: conversationId,
          contact_id: contactId,
          channel_id: config.channel_id,
          message_content: content,
          message_type: messageType,
        },
      }),
    });
  } catch (flowError) {
    console.error('[Instagram] Flow trigger error:', flowError);
  }
}
