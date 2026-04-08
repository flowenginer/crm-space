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
  mimeType?: string; // MIME type do arquivo, para validação de formato
  quickReplies?: Array<{ title: string; payload: string }>;
  skipDbInsert?: boolean; // Se true, não insere na tabela messages (frontend já salvou)
  frontendMessageId?: string; // ID da mensagem já salva pelo frontend
}

// Janela da Meta para responder DMs sem message tag: 24h desde a última msg do usuário
const META_24H_WINDOW_MS = 24 * 60 * 60 * 1000;
// Timeout do fetch pra Meta Graph API
const META_FETCH_TIMEOUT_MS = 15_000;

// Formatos de áudio aceitos pelo Instagram Messaging API
// Ref: https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message
const INSTAGRAM_SUPPORTED_AUDIO_MIMES = [
  'audio/aac', 'audio/m4a', 'audio/x-m4a', 'audio/mp4',
  'audio/wav', 'audio/x-wav', 'audio/wave',
];
const INSTAGRAM_REJECTED_AUDIO_EXTENSIONS = ['mp3', 'ogg', 'webm', 'opus'];

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
    const { channelId, type, content, mediaUrl, conversationId, quickReplies, mimeType } = payload;
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

    // 3. Fallback: busca via whatsapp_channels do tipo instagram e vincula.
    //    SEMPRE filtrando por tenant_id do canal — nunca pegar config de outro tenant.
    if (!channel) {
      const { data: waChannel } = await supabase
        .from('whatsapp_channels')
        .select('id, tenant_id, phone, type')
        .eq('id', channelId)
        .eq('type', 'instagram')
        .single();

      if (waChannel) {
        // 3a. Config sem channel_id vinculado, MAS do mesmo tenant — vincular automaticamente
        const { data: configByPhone } = await supabase
          .from('instagram_configs')
          .select(configFields)
          .eq('tenant_id', waChannel.tenant_id)
          .eq('is_active', true)
          .is('channel_id', null)
          .limit(1);

        if (configByPhone && configByPhone.length > 0) {
          channel = configByPhone[0];
          console.log(`[Instagram Send] Auto-linking instagram_config ${channel.id} to whatsapp_channel ${channelId} (tenant ${waChannel.tenant_id})`);
          await supabase
            .from('instagram_configs')
            .update({ channel_id: channelId, updated_at: new Date().toISOString() })
            .eq('id', channel.id);
          channel.channel_id = channelId;
        } else {
          // 3b. Qualquer config ativa do MESMO tenant (fallback de último recurso).
          //     Filtrar por tenant_id é crítico pra não vazar config entre tenants.
          const { data: anyConfig } = await supabase
            .from('instagram_configs')
            .select(configFields)
            .eq('tenant_id', waChannel.tenant_id)
            .eq('is_active', true)
            .limit(1);

          if (anyConfig && anyConfig.length > 0) {
            channel = anyConfig[0];
            console.log(`[Instagram Send] Using tenant-scoped fallback config ${channel.id} for channel ${channelId} (tenant ${waChannel.tenant_id})`);
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

    // Hardening: page_id vem do DB mas é interpolado direto em URL da Graph API.
    // Validar que é só dígitos evita qualquer tentativa de path traversal caso
    // a config seja corrompida ou manipulada por vetor externo futuro.
    if (!/^\d+$/.test(String(channel.page_id))) {
      console.error('[Instagram Send] Invalid page_id format:', channel.page_id);
      throw new Error('Configuração Instagram inválida: page_id mal formatado');
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

      case 'audio': {
        // Instagram supports audio in aac, m4a, wav, mp4 (max 25MB)
        // Validate format before calling Meta API
        const audioUrl = mediaUrl || content;
        if (!audioUrl) {
          throw new Error('URL do áudio é obrigatória');
        }

        // Check by mimeType if provided
        if (mimeType) {
          const isSupported = INSTAGRAM_SUPPORTED_AUDIO_MIMES.includes(mimeType.toLowerCase());
          if (!isSupported) {
            throw new Error(
              `Formato de áudio "${mimeType}" não é aceito pelo Instagram. ` +
              `Formatos aceitos: AAC, M4A, WAV, MP4. ` +
              `Para mais informações: https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message`
            );
          }
        }

        // Check by file extension as fallback
        if (!mimeType && audioUrl) {
          const urlPath = audioUrl.split('?')[0].toLowerCase();
          const hasRejectedExt = INSTAGRAM_REJECTED_AUDIO_EXTENSIONS.some(ext => urlPath.endsWith(`.${ext}`));
          if (hasRejectedExt) {
            throw new Error(
              `Esse formato de áudio não é aceito pelo Instagram. ` +
              `Formatos aceitos: AAC, M4A, WAV, MP4. ` +
              `Para mais informações: https://developers.facebook.com/docs/messenger-platform/instagram/features/send-message`
            );
          }
        }

        messagePayload = {
          attachment: {
            type: 'audio',
            payload: { url: audioUrl, is_reusable: true },
          },
        };
        break;
      }
    }

    // ============================================================
    // Verificação da janela 24h da Meta.
    // A Meta só permite enviar mensagem livre (sem message tag) se o
    // usuário enviou alguma msg nas últimas 24h. Fora disso, a API
    // retorna erro genérico — é melhor bloquear ANTES de chamar.
    // Pular se mensagem já for parte de uma automação usando message tag
    // (não implementado ainda, mas a estrutura fica pronta).
    // ============================================================
    if (recipientId) {
      const contactIgPhone = `ig:${recipientId}`;
      const { data: contactForWindow } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone', contactIgPhone)
        .eq('tenant_id', channel.tenant_id)
        .maybeSingle();

      if (contactForWindow) {
        const { data: lastInbound } = await supabase
          .from('messages')
          .select('created_at')
          .eq('contact_id', contactForWindow.id)
          .eq('is_from_me', false)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastInbound?.created_at) {
          const lastInboundMs = new Date(lastInbound.created_at).getTime();
          const ageMs = Date.now() - lastInboundMs;
          if (ageMs > META_24H_WINDOW_MS) {
            const hoursOld = Math.round(ageMs / 3_600_000);
            console.warn(`[Instagram Send] 24h window closed — last inbound ${hoursOld}h ago for contact ${contactForWindow.id}`);
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Janela de 24h da Meta expirada. O Instagram só permite responder mensagens enviadas pelo contato nas últimas 24 horas.',
                errorCode: 'OUTSIDE_24H_WINDOW',
                hoursSinceLastInbound: hoursOld,
              }),
              { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
    }

    // Enviar via Instagram Send API (usa Page ID, não Instagram Account ID)
    console.log('[Instagram Send] Sending message:', {
      recipientId,
      type,
      channelId: channel.id,
    });

    const accessToken = channel.page_access_token;

    // fetch com AbortController pra não segurar a edge function em caso de
    // hang de rede. Meta normalmente responde em <2s; 15s é margem generosa.
    const sendToInstagram = async (token: string): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), META_FETCH_TIMEOUT_MS);
      try {
        return await fetch(
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
            signal: controller.signal,
          }
        );
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Um único retry em caso de erro transiente (timeout ou 5xx).
    // Não retenta 4xx — erros de negócio (token ruim, janela fechada, payload inválido).
    let response: Response;
    let result: { message_id?: string; error?: { code?: number; message?: string; fbtrace_id?: string; error_subcode?: number; type?: string } };
    try {
      response = await sendToInstagram(accessToken);
      result = await response.json();
      if (!response.ok && response.status >= 500) {
        console.warn(`[Instagram Send] Meta returned ${response.status}, retrying once after 1s...`);
        await new Promise((r) => setTimeout(r, 1000));
        response = await sendToInstagram(accessToken);
        result = await response.json();
      }
    } catch (netErr) {
      const msg = netErr instanceof Error ? netErr.message : 'network error';
      console.warn(`[Instagram Send] Network/timeout error (${msg}), retrying once after 1s...`);
      await new Promise((r) => setTimeout(r, 1000));
      response = await sendToInstagram(accessToken);
      result = await response.json();
    }

    // Token inválido (code 190): NÃO tentar refresh automático.
    // O endpoint ig_refresh_token é pra long-lived USER token, não pra PAGE access token.
    // Page access tokens precisam ser re-emitidos via OAuth — disparar alerta e falhar.
    const isTokenError =
      !response.ok &&
      (result.error?.code === 190 ||
        (typeof result.error?.message === 'string' && result.error.message.toLowerCase().includes('access token')));

    if (isTokenError) {
      console.error('[Instagram Send] Page access token inválido/expirado. Re-autenticação via OAuth necessária.', {
        channelId: channel.id,
        errorCode: result.error?.code,
        errorMessage: result.error?.message,
        fbtraceId: result.error?.fbtrace_id,
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Token do Instagram expirado. É necessário reconectar a página no painel de canais.',
          errorCode: 'IG_TOKEN_EXPIRED',
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok || result.error) {
      console.error('[Instagram Send] Error from Meta Graph API:', {
        status: response.status,
        errorCode: result.error?.code,
        errorSubcode: result.error?.error_subcode,
        errorType: result.error?.type,
        errorMessage: result.error?.message,
        fbtraceId: result.error?.fbtrace_id,
        channelId: channel.id,
        recipientId,
      });
      throw new Error(result.error?.message || `Failed to send Instagram message (status ${response.status})`);
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

    // Inserir mensagem na tabela messages (pular se frontend já salvou)
    const skipInsert = payload.skipDbInsert === true;
    const frontendMsgId = payload.frontendMessageId;
    // sender_id: usa o user autenticado pra auditoria. Fica NULL se a chamada for
    // via service_role (automações) — aceitável porque automações não têm "autor humano".
    const senderUserId = user?.id || null;

    if (skipInsert && frontendMsgId && instagramMessageId) {
      // Frontend já salvou — apenas atualizar com o ID do Instagram e o sender_id
      // (caso o frontend não tenha populado).
      const updatePayload: { whatsapp_message_id: string; status: string; sender_id?: string } = {
        whatsapp_message_id: instagramMessageId,
        status: 'sent',
      };
      if (senderUserId) updatePayload.sender_id = senderUserId;

      const { error: updErr } = await supabase
        .from('messages')
        .update(updatePayload)
        .eq('id', frontendMsgId);
      if (updErr) {
        console.error('[Instagram Send] Error updating frontend message:', updErr);
      } else {
        console.log('[Instagram Send] ✅ Updated frontend message', frontendMsgId, 'with IG ID:', instagramMessageId);
      }
    } else if (!skipInsert && resolvedConversationId) {
      const messageContent = type === 'text' ? (content || '') : '';
      const messageMediaUrl = type !== 'text' ? (mediaUrl || content || null) : null;

      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: resolvedConversationId,
          contact_id: resolvedContactId,
          tenant_id: channel.tenant_id,
          sender_id: senderUserId,
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
      // Fallback: se conversationId foi passado mas não encontramos contato
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
