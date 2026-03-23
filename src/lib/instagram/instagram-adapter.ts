import {
  InstagramNormalizedMessage,
  InstagramSendMessageResponse,
  InstagramConnectionStatus,
  InstagramMessageType,
  InstagramWebhookPayload,
  InstagramWebhookMessaging,
} from '@/types/instagram';
import { supabase } from '@/integrations/supabase/client';

interface InstagramAdapterConfig {
  channelId: string;
  instagramAccountId: string;
  pageAccessToken?: string;
}

export class InstagramAdapter {
  private config: InstagramAdapterConfig;
  private graphApiVersion = 'v21.0';
  private graphApiBaseUrl = 'https://graph.facebook.com';

  constructor(config: InstagramAdapterConfig) {
    this.config = config;
  }

  // =====================================================
  // CONEXÃO (Instagram usa OAuth, sem QR Code)
  // =====================================================
  async connect(): Promise<{ status: InstagramConnectionStatus }> {
    return { status: 'connected' };
  }

  async disconnect(): Promise<void> {
    console.log('[Instagram] Disconnect requested');
  }

  async getStatus(): Promise<InstagramConnectionStatus> {
    return 'connected';
  }

  // =====================================================
  // ENVIO DE MENSAGENS
  // =====================================================
  private async sendMessage(
    recipientId: string,
    message: Record<string, unknown>
  ): Promise<InstagramSendMessageResponse> {
    try {
      // Buscar token atualizado do canal
      const token = await this.getAccessToken();
      if (!token) {
        return { success: false, error: 'Access token não encontrado' };
      }

      const response = await fetch(
        `${this.graphApiBaseUrl}/${this.graphApiVersion}/me/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient: { id: recipientId },
            message,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || result.error) {
        return {
          success: false,
          error: result.error?.message || 'Falha ao enviar mensagem',
        };
      }

      return {
        success: true,
        messageId: result.message_id,
        recipientId: result.recipient_id,
      };
    } catch (error) {
      console.error('[Instagram Adapter] Send error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  async sendText(recipientId: string, text: string): Promise<InstagramSendMessageResponse> {
    return this.sendMessage(recipientId, { text });
  }

  async sendImage(recipientId: string, imageUrl: string): Promise<InstagramSendMessageResponse> {
    return this.sendMessage(recipientId, {
      attachment: {
        type: 'image',
        payload: { url: imageUrl, is_reusable: true },
      },
    });
  }

  async sendVideo(recipientId: string, videoUrl: string): Promise<InstagramSendMessageResponse> {
    return this.sendMessage(recipientId, {
      attachment: {
        type: 'video',
        payload: { url: videoUrl, is_reusable: true },
      },
    });
  }

  async sendAudio(recipientId: string, audioUrl: string): Promise<InstagramSendMessageResponse> {
    return this.sendMessage(recipientId, {
      attachment: {
        type: 'audio',
        payload: { url: audioUrl, is_reusable: true },
      },
    });
  }

  // Quick Replies (botões de resposta rápida)
  async sendQuickReplies(
    recipientId: string,
    text: string,
    quickReplies: Array<{ title: string; payload: string }>
  ): Promise<InstagramSendMessageResponse> {
    return this.sendMessage(recipientId, {
      text,
      quick_replies: quickReplies.map(qr => ({
        content_type: 'text',
        title: qr.title,
        payload: qr.payload,
      })),
    });
  }

  // Generic Template (cards com botões)
  async sendGenericTemplate(
    recipientId: string,
    elements: Array<{
      title: string;
      subtitle?: string;
      imageUrl?: string;
      buttons?: Array<{ type: string; title: string; url?: string; payload?: string }>;
    }>
  ): Promise<InstagramSendMessageResponse> {
    return this.sendMessage(recipientId, {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements: elements.map(el => ({
            title: el.title,
            subtitle: el.subtitle,
            image_url: el.imageUrl,
            buttons: el.buttons,
          })),
        },
      },
    });
  }

  // =====================================================
  // WEBHOOK NORMALIZATION
  // =====================================================
  normalizeWebhook(payload: unknown): InstagramNormalizedMessage | null {
    try {
      const data = payload as InstagramWebhookPayload;

      if (data.object !== 'instagram') {
        return null;
      }

      const entry = data.entry?.[0];
      if (!entry?.messaging?.[0]) {
        return null;
      }

      const messaging = entry.messaging[0];

      // Ignorar echoes (mensagens enviadas por nós)
      if (messaging.message?.is_echo) {
        return null;
      }

      // Só processar se tiver mensagem (não reactions/reads)
      if (!messaging.message && !messaging.postback) {
        return null;
      }

      return this.normalizeMessaging(messaging, entry.id);
    } catch (error) {
      console.error('[Instagram Adapter] Normalize error:', error);
      return null;
    }
  }

  private normalizeMessaging(
    messaging: InstagramWebhookMessaging,
    instagramAccountId: string
  ): InstagramNormalizedMessage {
    const isFromMe = messaging.sender.id === instagramAccountId;

    // Determinar tipo e conteúdo
    let type: InstagramMessageType = 'text';
    let content = '';
    let mediaUrl: string | undefined;
    let storyUrl: string | undefined;
    let reelUrl: string | undefined;

    if (messaging.postback) {
      type = 'text';
      content = messaging.postback.title;
    } else if (messaging.message) {
      const msg = messaging.message;

      if (msg.attachments && msg.attachments.length > 0) {
        const attachment = msg.attachments[0];

        switch (attachment.type) {
          case 'image':
            type = 'image';
            content = msg.text || '[Imagem]';
            mediaUrl = attachment.payload.url;
            break;
          case 'video':
            type = 'video';
            content = '[Vídeo]';
            mediaUrl = attachment.payload.url;
            break;
          case 'audio':
            type = 'audio';
            content = '[Áudio]';
            mediaUrl = attachment.payload.url;
            break;
          case 'story_mention':
            type = 'story_mention';
            content = '[Menção no Story]';
            storyUrl = attachment.payload.url;
            mediaUrl = attachment.payload.url;
            break;
          case 'reel':
            type = 'reel_reply';
            content = msg.text || '[Resposta ao Reel]';
            reelUrl = attachment.payload.url;
            mediaUrl = attachment.payload.url;
            break;
          default:
            type = 'text';
            content = msg.text || `[${attachment.type}]`;
        }
      } else {
        type = 'text';
        content = msg.text || '';
      }

      // Verificar se é resposta a story
      if (msg.reply_to?.story) {
        type = 'story_reply';
        storyUrl = msg.reply_to.story.url;
        if (!content) content = '[Resposta ao Story]';
      }
    }

    return {
      id: messaging.message?.mid || messaging.postback?.mid || '',
      instanceId: instagramAccountId,
      from: messaging.sender.id,
      isFromMe,
      type,
      content,
      mediaUrl,
      storyUrl,
      reelUrl,
      timestamp: new Date(messaging.timestamp),
      status: 'delivered',
      originalId: messaging.message?.mid || messaging.postback?.mid || '',
    };
  }

  // =====================================================
  // UTILITÁRIOS
  // =====================================================
  private async getAccessToken(): Promise<string | null> {
    const { data } = await supabase
      .from('instagram_channels')
      .select('page_access_token')
      .eq('id', this.config.channelId)
      .single();

    return data?.page_access_token || this.config.pageAccessToken || null;
  }

  // Buscar informações do perfil Instagram
  async getProfileInfo(): Promise<{
    username?: string;
    name?: string;
    profilePicture?: string;
    followersCount?: number;
  } | null> {
    try {
      const token = await this.getAccessToken();
      if (!token) return null;

      const response = await fetch(
        `${this.graphApiBaseUrl}/${this.graphApiVersion}/${this.config.instagramAccountId}?fields=username,name,profile_picture_url,followers_count`,
        {
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      return {
        username: data.username,
        name: data.name,
        profilePicture: data.profile_picture_url,
        followersCount: data.followers_count,
      };
    } catch {
      return null;
    }
  }
}
