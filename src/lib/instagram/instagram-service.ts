import { InstagramAdapter } from './instagram-adapter';
import {
  InstagramNormalizedMessage,
  InstagramSendMessageResponse,
  InstagramConnectionStatus,
  InstagramWebhookPayload,
} from '@/types/instagram';
import { supabase } from '@/integrations/supabase/client';

class InstagramService {
  private adapters: Map<string, InstagramAdapter> = new Map();

  // =====================================================
  // INICIALIZAR CANAL
  // =====================================================
  async initializeChannel(channelId: string): Promise<InstagramAdapter | null> {
    try {
      const { data: channel, error } = await supabase
        .from('instagram_channels')
        .select('*')
        .eq('id', channelId)
        .single();

      if (error || !channel) {
        console.error('[Instagram] Channel not found:', channelId);
        return null;
      }

      const adapter = new InstagramAdapter({
        channelId: channel.id,
        instagramAccountId: channel.instagram_account_id,
        pageAccessToken: channel.page_access_token,
      });

      this.adapters.set(channelId, adapter);
      return adapter;
    } catch (error) {
      console.error('[Instagram] Initialize error:', error);
      return null;
    }
  }

  // =====================================================
  // OBTER ADAPTER
  // =====================================================
  async getAdapter(channelId: string): Promise<InstagramAdapter> {
    let adapter = this.adapters.get(channelId);

    if (!adapter) {
      adapter = await this.initializeChannel(channelId);
    }

    if (!adapter) {
      throw new Error(`Failed to initialize Instagram channel: ${channelId}`);
    }

    return adapter;
  }

  // =====================================================
  // ENVIAR MENSAGEM
  // =====================================================
  async sendMessage(
    channelId: string,
    recipientId: string,
    content: string,
    type: 'text' | 'image' | 'video' | 'audio' = 'text',
    options?: { mediaUrl?: string }
  ): Promise<InstagramSendMessageResponse> {
    const adapter = await this.getAdapter(channelId);

    switch (type) {
      case 'text':
        return adapter.sendText(recipientId, content);
      case 'image':
        return adapter.sendImage(recipientId, options?.mediaUrl || content);
      case 'video':
        return adapter.sendVideo(recipientId, options?.mediaUrl || content);
      case 'audio':
        return adapter.sendAudio(recipientId, options?.mediaUrl || content);
      default:
        return adapter.sendText(recipientId, content);
    }
  }

  // =====================================================
  // CONECTAR CANAL
  // =====================================================
  async connect(channelId: string): Promise<{ status: InstagramConnectionStatus }> {
    const adapter = await this.getAdapter(channelId);
    const result = await adapter.connect();

    await supabase
      .from('instagram_channels')
      .update({
        status: result.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', channelId);

    return result;
  }

  // =====================================================
  // DESCONECTAR CANAL
  // =====================================================
  async disconnect(channelId: string): Promise<void> {
    const adapter = await this.getAdapter(channelId);
    await adapter.disconnect();

    await supabase
      .from('instagram_channels')
      .update({
        status: 'disconnected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', channelId);

    this.adapters.delete(channelId);
  }

  // =====================================================
  // PROCESSAR WEBHOOK
  // =====================================================
  async processWebhook(
    payload: Record<string, unknown>
  ): Promise<InstagramNormalizedMessage | null> {
    const data = payload as unknown as InstagramWebhookPayload;

    if (data.object !== 'instagram') {
      return null;
    }

    const entry = data.entry?.[0];
    if (!entry) return null;

    const instagramAccountId = entry.id;

    // Buscar canal pelo instagram_account_id
    const { data: channel } = await supabase
      .from('instagram_channels')
      .select('id')
      .eq('instagram_account_id', instagramAccountId)
      .eq('is_deleted', false)
      .maybeSingle();

    if (!channel) {
      console.error('[Instagram] Channel not found for account:', instagramAccountId);
      return null;
    }

    const adapter = await this.getAdapter(channel.id);
    const normalizedMessage = adapter.normalizeWebhook(payload);

    if (normalizedMessage && !normalizedMessage.isFromMe) {
      await this.saveIncomingMessage(channel.id, normalizedMessage);
    }

    return normalizedMessage;
  }

  // =====================================================
  // SALVAR MENSAGEM RECEBIDA
  // =====================================================
  private async saveIncomingMessage(channelId: string, msg: InstagramNormalizedMessage): Promise<void> {
    try {
      // 1. Buscar ou criar contato pelo IGSID
      // Instagram usa IGSID, não telefone. Guardamos no campo instagram_id do contato.
      let { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('instagram_id', msg.from)
        .maybeSingle();

      if (!contact) {
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            instagram_id: msg.from,
            full_name: msg.fromName || msg.fromUsername || `Instagram ${msg.from.slice(-6)}`,
            instagram_username: msg.fromUsername || null,
            origin: 'instagram',
          } as any)
          .select('id')
          .single();

        if (contactError) {
          // Se duplicata, buscar existente
          if (contactError.code === '23505') {
            const { data: existing } = await supabase
              .from('contacts')
              .select('id')
              .eq('instagram_id', msg.from)
              .maybeSingle();
            contact = existing;
          } else {
            console.error('[Instagram] Error creating contact:', contactError);
            return;
          }
        } else {
          contact = newContact;
        }
      }

      if (!contact) {
        console.error('[Instagram] Failed to create/find contact');
        return;
      }

      // 2. Buscar ou criar conversa
      let { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contact.id)
        .eq('instagram_channel_id', channelId)
        .eq('status', 'open')
        .maybeSingle();

      if (!conversation) {
        const { data: newConversation } = await supabase
          .from('conversations')
          .insert({
            contact_id: contact.id,
            instagram_channel_id: channelId,
            channel_type: 'instagram',
            status: 'open',
            last_message_at: msg.timestamp.toISOString(),
            last_message_preview: msg.content.substring(0, 100),
          } as any)
          .select('id')
          .single();
        conversation = newConversation;
      }

      if (!conversation) {
        console.error('[Instagram] Failed to create/find conversation');
        return;
      }

      // 3. Mapear tipo de mensagem do Instagram para tipo genérico
      const messageType = this.mapMessageType(msg.type);

      // 4. Salvar mensagem
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        contact_id: contact.id,
        content: msg.content,
        message_type: messageType,
        media_url: msg.mediaUrl,
        is_from_me: msg.isFromMe,
        instagram_message_id: msg.originalId,
        status: 'delivered',
        created_at: msg.timestamp.toISOString(),
        tenant_id: null, // Auto-filled by trigger
      } as any);

      // 5. Atualizar conversa
      const { data: currentConv } = await supabase
        .from('conversations')
        .select('unread_count')
        .eq('id', conversation.id)
        .single();

      const preview = this.getMessagePreview(msg);

      await supabase
        .from('conversations')
        .update({
          last_message_at: msg.timestamp.toISOString(),
          last_message_preview: preview,
          last_message_is_from_me: msg.isFromMe,
          unread_count: (currentConv?.unread_count || 0) + 1,
          is_unread: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversation.id);

    } catch (error) {
      console.error('[Instagram] Save message error:', error);
    }
  }

  private mapMessageType(type: string): string {
    const map: Record<string, string> = {
      text: 'text',
      image: 'image',
      video: 'video',
      audio: 'audio',
      sticker: 'sticker',
      story_reply: 'text',
      story_mention: 'image',
      reel_reply: 'text',
    };
    return map[type] || 'text';
  }

  private getMessagePreview(msg: InstagramNormalizedMessage): string {
    switch (msg.type) {
      case 'image': return '📷 Imagem';
      case 'video': return '🎬 Vídeo';
      case 'audio': return '🎵 Áudio';
      case 'sticker': return '🎭 Sticker';
      case 'story_reply': return '📱 Resposta ao Story';
      case 'story_mention': return '📱 Menção no Story';
      case 'reel_reply': return '🎬 Resposta ao Reel';
      default: return msg.content.substring(0, 100);
    }
  }

  // =====================================================
  // LIMPAR CACHE
  // =====================================================
  clearCache(channelId?: string): void {
    if (channelId) {
      this.adapters.delete(channelId);
    } else {
      this.adapters.clear();
    }
  }
}

// Singleton export
export const instagramService = new InstagramService();
