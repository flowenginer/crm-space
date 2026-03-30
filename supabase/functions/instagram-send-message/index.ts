import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GRAPH_API_VERSION = 'v21.0';
const GRAPH_API_URL = 'https://graph.instagram.com';

interface SendMessagePayload {
  channelId: string;
  recipientId: string; // IGSID (Instagram Scoped User ID)
  type: 'text' | 'image' | 'video' | 'audio';
  content?: string;
  mediaUrl?: string;
  conversationId?: string;
  quickReplies?: Array<{ title: string; payload: string }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    let isAuthorized = false;

    // Validate as user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (!authError && user) {
      isAuthorized = true;
    }

    // Internal calls from other edge functions
    if (!isAuthorized) {
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (token === serviceRoleKey) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      throw new Error('Unauthorized');
    }

    const payload: SendMessagePayload = await req.json();
    const { channelId, type, content, mediaUrl, conversationId, quickReplies } = payload;
    // Strip "ig:" prefix from recipientId — contacts store Instagram IDs as "ig:123"
    // but the Instagram Graph API expects the raw numeric IGSID
    let recipientId = payload.recipientId;

    if (!channelId || !recipientId) {
      throw new Error('channelId and recipientId are required');
    }

    if (recipientId.startsWith('ig:')) {
      recipientId = recipientId.substring(3);
      console.log('[Instagram Send] Stripped ig: prefix from recipientId:', recipientId);
    }

    // Buscar canal Instagram - tenta múltiplas estratégias de lookup
    let channel = null;
    const configFields = 'id, page_id, page_access_token, instagram_account_id, tenant_id, channel_id';

    // 1. Tenta buscar por channel_id (vindo do whatsapp_channels)
    const { data: channelByChannelId } = await supabase
      .from('instagram_configs')
      .select(configFields)
      .eq('channel_id', channelId)
      .eq('is_active', true)
      .single();

    if (channelByChannelId) {
      channel = channelByChannelId;
    }

    // 2. Fallback: busca por id da própria tabela instagram_configs
    if (!channel) {
      const { data: channelById } = await supabase
        .from('instagram_configs')
        .select(configFields)
        .eq('id', channelId)
        .eq('is_active', true)
        .single();

      if (channelById) {
        channel = channelById;
      }
    }

    // 3. Fallback: busca via whatsapp_channels do tipo instagram e vincula
    if (!channel) {
      const { data: waChannel } = await supabase
        .from('whatsapp_channels')
        .select('id, phone, type')
        .eq('id', channelId)
        .eq('type', 'instagram')
        .single();

      if (waChannel) {
        // Busca instagram_configs por page_id ou instagram_account_id
        // O phone do canal instagram pode conter o username com prefixo "ig:"
        const { data: configByPhone } = await supabase
          .from('instagram_configs')
          .select(configFields)
          .eq('is_active', true)
          .is('channel_id', null)
          .limit(1);

        if (configByPhone && configByPhone.length > 0) {
          // Encontrou config sem channel_id vinculado - vincular automaticamente
          channel = configByPhone[0];
          console.log(`[Instagram Send] Auto-linking instagram_config ${channel.id} to whatsapp_channel ${channelId}`);
          await supabase
            .from('instagram_configs')
            .update({ channel_id: channelId, updated_at: new Date().toISOString() })
            .eq('id', channel.id);
          channel.channel_id = channelId;
        } else {
          // Busca qualquer config ativa do mesmo tenant
          const { data: anyConfig } = await supabase
            .from('instagram_configs')
            .select(configFields)
            .eq('is_active', true)
            .limit(1);

          if (anyConfig && anyConfig.length > 0) {
            channel = anyConfig[0];
            console.log(`[Instagram Send] Found instagram_config ${channel.id} for channel ${channelId} (channel_id mismatch, using tenant fallback)`);
          }
        }
      }
    }

    if (!channel) {
      console.error('[Instagram Send] Channel not found. channelId:', channelId);
      throw new Error('Instagram channel not found or inactive');
    }

    if (!channel.page_access_token) {
      throw new Error('Page access token not configured');
    }

    // Construir payload da mensagem para a Instagram Send API
    let messagePayload: Record<string, unknown> = {};

    switch (type) {
      case 'text':
        if (quickReplies && quickReplies.length > 0) {
          messagePayload = {
            text: content || '',
            quick_replies: quickReplies.map(qr => ({
              content_type: 'text',
              title: qr.title,
              payload: qr.payload,
            })),
          };
        } else {
          messagePayload = { text: content || '' };
        }
        break;

      case 'image':
        messagePayload = {
          attachment: {
            type: 'image',
            payload: { url: mediaUrl || content, is_reusable: true },
          },
        };
        break;

      case 'video':
        messagePayload = {
          attachment: {
            type: 'video',
            payload: { url: mediaUrl || content, is_reusable: true },
          },
        };
        break;

      case 'audio':
        messagePayload = {
          attachment: {
            type: 'audio',
            payload: { url: mediaUrl || content, is_reusable: true },
          },
        };
        break;

      default:
        messagePayload = { text: content || '' };
    }

    // Enviar via Instagram Send API (usa Page ID, não Instagram Account ID)
    console.log('[Instagram Send] Sending message:', {
      recipientId,
      type,
      channelId: channel.id,
    });

    let accessToken = channel.page_access_token;

    const sendToInstagram = async (token: string) => {
      return fetch(
        `${GRAPH_API_URL}/${GRAPH_API_VERSION}/${channel.page_id}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient: { id: recipientId },
            message: messagePayload,
          }),
        }
      );
    };

    let response = await sendToInstagram(accessToken);
    let result = await response.json();

    // Se o token estiver inválido, tentar renovar automaticamente
    if (!response.ok && result.error?.code === 190 || result.error?.message?.includes('access token')) {
      console.log('[Instagram Send] Token inválido, tentando renovar...');

      try {
        const refreshRes = await fetch(
          `https://graph.instagram.com/refresh_access_token?` +
          `grant_type=ig_refresh_token` +
          `&access_token=${accessToken}`
        );
        const refreshData = await refreshRes.json();

        if (refreshData.access_token) {
          accessToken = refreshData.access_token;
          const tokenExpiresAt = new Date(
            Date.now() + (refreshData.expires_in || 5184000) * 1000
          ).toISOString();

          // Salvar novo token no banco
          await supabase
            .from('instagram_configs')
            .update({
              page_access_token: accessToken,
              token_expires_at: tokenExpiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq('id', channel.id);

          console.log('[Instagram Send] Token renovado, reenviando mensagem...');

          // Reenviar com novo token
          response = await sendToInstagram(accessToken);
          result = await response.json();
        } else {
          console.error('[Instagram Send] Falha ao renovar token:', refreshData.error);
        }
      } catch (refreshErr) {
        console.error('[Instagram Send] Erro ao renovar token:', refreshErr);
      }
    }

    if (!response.ok || result.error) {
      console.error('[Instagram Send] Error:', result.error || result);
      throw new Error(result.error?.message || 'Failed to send Instagram message');
    }

    console.log('[Instagram Send] ✅ Message sent:', result);

    const instagramMessageId = result.message_id || null;
    const now = new Date().toISOString();

    // Atualizar timestamp do canal
    await supabase
      .from('instagram_configs')
      .update({
        updated_at: now,
      })
      .eq('id', channel.id);

    // Salvar mensagem enviada na tabela messages para aparecer no CRM
    let resolvedConversationId = conversationId || null;
    let resolvedContactId: string | null = null;

    // Buscar contato pelo IGSID (armazenado como "ig:{recipientId}" no campo phone)
    const igPhone = `ig:${recipientId}`;
    const { data: contact } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone', igPhone)
      .eq('tenant_id', channel.tenant_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (contact) {
      resolvedContactId = contact.id;

      // Se não temos conversationId, buscar conversa aberta/pendente do contato
      if (!resolvedConversationId) {
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('contact_id', contact.id)
          .eq('channel_id', channel.channel_id || channelId)
          .in('status', ['open', 'pending'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingConv) {
          resolvedConversationId = existingConv.id;
        } else {
          // Fallback: buscar qualquer conversa aberta/pendente do contato no tenant
          const { data: anyConv } = await supabase
            .from('conversations')
            .select('id')
            .eq('contact_id', contact.id)
            .eq('tenant_id', channel.tenant_id)
            .in('status', ['open', 'pending'])
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (anyConv) {
            resolvedConversationId = anyConv.id;
          }
        }
      }
    } else {
      console.warn('[Instagram Send] Contact not found for igPhone:', igPhone);
    }

    // Inserir mensagem na tabela messages
    if (resolvedConversationId) {
      const messageContent = type === 'text' ? (content || '') : '';
      const messageMediaUrl = type !== 'text' ? (mediaUrl || content || null) : null;

      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: resolvedConversationId,
          contact_id: resolvedContactId,
          tenant_id: channel.tenant_id,
          content: messageContent,
          message_type: type,
          media_url: messageMediaUrl,
          is_from_me: true,
          status: 'sent',
          whatsapp_message_id: instagramMessageId,
        });

      if (msgError) {
        console.error('[Instagram Send] Error saving message to DB:', msgError);
      } else {
        console.log('[Instagram Send] ✅ Message saved to DB for conversation:', resolvedConversationId);
      }

      // Atualizar metadados da conversa
      const preview = type === 'text' ? (content || '').substring(0, 100) : `📎 ${type}`;
      await supabase
        .from('conversations')
        .update({
          last_message_at: now,
          last_message_preview: preview,
          last_message_is_from_me: true,
          updated_at: now,
        })
        .eq('id', resolvedConversationId);
    } else if (conversationId) {
      // Fallback: se conversationId foi passado mas não encontramos contato, ainda atualizar conversa
      const preview = type === 'text' ? (content || '').substring(0, 100) : `📎 ${type}`;
      await supabase
        .from('conversations')
        .update({
          last_message_at: now,
          last_message_preview: preview,
          last_message_is_from_me: true,
          updated_at: now,
        })
        .eq('id', conversationId);
    } else {
      console.warn('[Instagram Send] Could not save message to DB: no conversation found for recipient', recipientId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: instagramMessageId,
        recipientId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Instagram Send] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        hint: errorMessage.includes('channel not found')
          ? 'Verify that channelId matches an active instagram_configs.channel_id, instagram_configs.id, or a whatsapp_channels.id of type instagram'
          : undefined,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
