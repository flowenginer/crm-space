import { ZAPIAdapter } from './zapi-adapter';
import { UAZAPIAdapter } from './uazapi-adapter';
import { EvolutionAdapter } from './evolution-adapter';
import { CloudAPIAdapter } from './cloudapi-adapter';
import { WhatsAppAdapter } from './base-adapter';
import { 
  WhatsAppProvider, 
  SendMessageResponse, 
  NormalizedMessage,
  ConnectionStatus 
} from '@/types/whatsapp';
import { supabase } from '@/integrations/supabase/client';

interface ChannelConfig {
  instanceId: string;
  token: string;
  baseUrl: string;
  apiKey?: string;
  clientToken?: string;
}

class WhatsAppService {
  private adapters: Map<string, WhatsAppAdapter> = new Map();

  // =====================================================
  // INICIALIZAR CANAL
  // =====================================================
  async initializeChannel(channelId: string): Promise<WhatsAppAdapter | null> {
    try {
      const { data: channel, error } = await supabase
        .from('whatsapp_channels')
        .select(`
          *,
          provider:whatsapp_providers(*)
        `)
        .eq('id', channelId)
        .single();

      if (error || !channel) {
        console.error('[WhatsApp] Channel not found:', channelId);
        return null;
      }

      const provider = channel.provider as { code: string; base_url: string; api_key?: string; api_secret?: string } | null;
      if (!provider) {
        console.error('[WhatsApp] Provider not found for channel:', channelId);
        return null;
      }

      const adapter = this.createAdapter(
        provider.code as WhatsAppProvider,
        {
          instanceId: channel.instance_id || '',
          token: channel.instance_token || '',
          baseUrl: provider.base_url,
          apiKey: provider.api_key || undefined,
          clientToken: provider.api_secret || undefined,
        }
      );

      this.adapters.set(channelId, adapter);
      return adapter;
    } catch (error) {
      console.error('[WhatsApp] Initialize error:', error);
      return null;
    }
  }

  private createAdapter(provider: WhatsAppProvider, config: ChannelConfig & { channelId?: string }): WhatsAppAdapter {
    switch (provider) {
      case 'zapi':
        return new ZAPIAdapter({
          instanceId: config.instanceId,
          token: config.token,
          clientToken: config.clientToken,
        });
        
      case 'uazapi':
        return new UAZAPIAdapter({
          instanceId: config.instanceId,
          token: config.token,
          baseUrl: config.baseUrl,
        });
        
      case 'evolution':
        return new EvolutionAdapter({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey || '',
          instanceName: config.instanceId,
        });

      case 'cloudapi':
        return new CloudAPIAdapter({
          channelId: config.channelId || config.instanceId,
        });
        
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  // =====================================================
  // OBTER ADAPTER
  // =====================================================
  async getAdapter(channelId: string): Promise<WhatsAppAdapter> {
    let adapter = this.adapters.get(channelId);
    
    if (!adapter) {
      adapter = await this.initializeChannel(channelId);
    }
    
    if (!adapter) {
      throw new Error(`Failed to initialize channel: ${channelId}`);
    }
    
    return adapter;
  }

  // =====================================================
  // ENVIAR MENSAGEM
  // =====================================================
  async sendMessage(
    channelId: string,
    phone: string,
    content: string,
    type: 'text' | 'image' | 'audio' | 'video' | 'document' = 'text',
    options?: { mediaUrl?: string; caption?: string; filename?: string }
  ): Promise<SendMessageResponse> {
    const adapter = await this.getAdapter(channelId);

    switch (type) {
      case 'text':
        return adapter.sendText(phone, content);
      case 'image':
        return adapter.sendImage(phone, options?.mediaUrl || content, options?.caption);
      case 'audio':
        return adapter.sendAudio(phone, options?.mediaUrl || content);
      case 'video':
        return adapter.sendVideo(phone, options?.mediaUrl || content, options?.caption);
      case 'document':
        return adapter.sendDocument(phone, options?.mediaUrl || content, options?.filename || 'documento');
      default:
        return adapter.sendText(phone, content);
    }
  }

  // =====================================================
  // CONECTAR CANAL
  // =====================================================
  async connect(channelId: string): Promise<{ qrCode?: string; status: ConnectionStatus }> {
    const adapter = await this.getAdapter(channelId);
    const result = await adapter.connect();

    await supabase
      .from('whatsapp_channels')
      .update({
        status: result.status === 'connected' ? 'connected' : 'disconnected',
        qr_code: result.qrCode || null,
        qr_expires_at: result.qrCode ? new Date(Date.now() + 60000).toISOString() : null,
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
      .from('whatsapp_channels')
      .update({
        status: 'disconnected',
        qr_code: null,
        qr_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', channelId);

    this.adapters.delete(channelId);
  }

  // =====================================================
  // STATUS DO CANAL
  // =====================================================
  async getStatus(channelId: string): Promise<ConnectionStatus> {
    const adapter = await this.getAdapter(channelId);
    return adapter.getStatus();
  }

  // =====================================================
  // PROCESSAR WEBHOOK
  // =====================================================
  async processWebhook(
    provider: WhatsAppProvider,
    payload: Record<string, unknown>
  ): Promise<NormalizedMessage | null> {
    // Log para debug
    await supabase.from('webhook_logs').insert([{
      provider,
      event_type: String(payload.event || payload.type || 'unknown'),
      instance_id: this.extractInstanceId(provider, payload),
      payload: JSON.parse(JSON.stringify(payload)),
    }]);

    const instanceId = this.extractInstanceId(provider, payload);
    if (!instanceId) {
      console.error('[WhatsApp] No instance ID in webhook');
      return null;
    }
    
    const { data: channel } = await supabase
      .from('whatsapp_channels')
      .select('id, provider_id')
      .eq('instance_id', instanceId)
      .maybeSingle();

    if (!channel) {
      console.error('[WhatsApp] Channel not found for instance:', instanceId);
      return null;
    }

    const adapter = await this.getAdapter(channel.id);
    const normalizedMessage = adapter.normalizeWebhook(payload);

    if (normalizedMessage && !normalizedMessage.isFromMe) {
      await this.saveIncomingMessage(channel.id, normalizedMessage);
    }

    return normalizedMessage;
  }

  private extractInstanceId(provider: WhatsAppProvider, payload: Record<string, unknown>): string {
    switch (provider) {
      case 'zapi':
        return (payload.instanceId || '') as string;
      case 'uazapi':
        return (payload.instance || payload.session || payload.instanceId || '') as string;
      case 'evolution':
        return (payload.instance || '') as string;
      default:
        return '';
    }
  }

  // =====================================================
  // SALVAR MENSAGEM RECEBIDA
  // =====================================================
  private async saveIncomingMessage(channelId: string, msg: NormalizedMessage): Promise<void> {
    try {
      // 1. Buscar contato existente (verificar múltiplas variações do telefone)
      const phoneVariations = [msg.from];
      if (msg.from.startsWith('55')) {
        phoneVariations.push(msg.from.slice(2));
      } else {
        phoneVariations.push(`55${msg.from}`);
      }
      
      const orConditions = phoneVariations.map(v => `phone.eq.${v}`).join(',');
      let { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .or(orConditions)
        .maybeSingle();

      if (!contact) {
        // Usar upsert para evitar duplicatas por race condition
        const { data: upsertedContact, error: contactError } = await supabase
          .from('contacts')
          .upsert({
            phone: msg.from,
            full_name: msg.fromName || msg.from,
            origin: 'whatsapp',
            // tenant_id is auto-filled by trigger set_tenant_id_from_user
          } as any, {
            onConflict: 'phone',
            ignoreDuplicates: false
          })
          .select('id')
          .single();
        
        if (contactError) {
          // Se for erro de duplicata, buscar o contato existente
          if (contactError.code === '23505') {
            const { data: existingContact } = await supabase
              .from('contacts')
              .select('id')
              .or(orConditions)
              .maybeSingle();
            contact = existingContact;
          } else {
            console.error('[WhatsApp] Error creating contact:', contactError);
            return;
          }
        } else {
          contact = upsertedContact;
        }
      }

      if (!contact) {
        console.error('[WhatsApp] Failed to create/find contact');
        return;
      }

      // 2. Buscar ou criar conversa
      let { data: conversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', contact.id)
        .eq('channel_id', channelId)
        .eq('status', 'open')
        .maybeSingle();

      if (!conversation) {
        const { data: newConversation } = await supabase
          .from('conversations')
          .insert({
            contact_id: contact.id,
            channel_id: channelId,
            status: 'open',
            last_message_at: msg.timestamp.toISOString(),
            last_message_preview: msg.content.substring(0, 100),
          } as any)
          .select('id')
          .single();
        conversation = newConversation;
      }

      if (!conversation) {
        console.error('[WhatsApp] Failed to create/find conversation');
        return;
      }

      // 3. Salvar mensagem
      await supabase.from('messages').insert({
        conversation_id: conversation.id,
        contact_id: contact.id,
        content: msg.content,
        message_type: msg.type,
        media_url: msg.mediaUrl,
        media_mime_type: msg.mediaMimeType,
        is_from_me: msg.isFromMe,
        whatsapp_message_id: msg.originalId,
        status: 'delivered',
        created_at: msg.timestamp.toISOString(),
        tenant_id: null, // Auto-filled by trigger
      });

      // 4. Atualizar conversa com TODOS os campos necessários
      // Buscar unread_count atual primeiro
      const { data: currentConv } = await supabase
        .from('conversations')
        .select('unread_count')
        .eq('id', conversation.id)
        .single();
      
      const preview = msg.type === 'image' 
        ? '📷 Imagem' 
        : msg.type === 'audio'
        ? '🎵 Áudio'
        : msg.type === 'video'
        ? '🎬 Vídeo'
        : msg.type === 'document'
        ? '📄 Documento'
        : msg.content.substring(0, 100);

      await supabase
        .from('conversations')
        .update({
          last_message_at: msg.timestamp.toISOString(),
          last_message_preview: preview,
          last_message_is_from_me: msg.isFromMe, // CRÍTICO: Atualizar este campo!
          unread_count: (currentConv?.unread_count || 0) + 1,
          is_unread: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversation.id);

    } catch (error) {
      console.error('[WhatsApp] Save message error:', error);
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
export const whatsappService = new WhatsAppService();
