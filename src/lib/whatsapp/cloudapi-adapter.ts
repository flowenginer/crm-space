import { 
  SendMessageResponse, 
  NormalizedMessage,
  ConnectionStatus,
  WhatsAppProvider 
} from '@/types/whatsapp';
import { WhatsAppAdapter } from './base-adapter';
import { supabase } from '@/integrations/supabase/client';

interface CloudAPIConfig {
  channelId: string;
  phoneNumberId?: string;
  accessToken?: string;
}

export class CloudAPIAdapter implements WhatsAppAdapter {
  provider: WhatsAppProvider = 'cloudapi';
  private config: CloudAPIConfig;
  private supabaseUrl = 'https://lkxrmjqrzhaivviuuamp.supabase.co';

  constructor(config: CloudAPIConfig) {
    this.config = config;
  }

  // =====================================================
  // CONEXÃO (Cloud API não usa QR Code)
  // =====================================================
  async connect(): Promise<{ qrCode?: string; status: ConnectionStatus }> {
    // Cloud API é conectada via OAuth, não QR Code
    return { status: 'connected' };
  }

  async disconnect(): Promise<void> {
    // Cloud API permanece conectada enquanto o token for válido
    // Para desconectar de verdade, o usuário precisa revogar o acesso no Meta
    console.log('[CloudAPI] Disconnect requested - token remains valid');
  }

  async getStatus(): Promise<ConnectionStatus> {
    // Cloud API está sempre conectada se configurada
    return 'connected';
  }

  // =====================================================
  // ENVIO DE MENSAGENS
  // =====================================================
  private async sendMessage(
    type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'template',
    phone: string,
    options: {
      content?: string;
      mediaUrl?: string;
      caption?: string;
      filename?: string;
      template?: {
        name: string;
        language: string;
        components?: any[];
      };
    }
  ): Promise<SendMessageResponse> {
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/cloudapi-send-message`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channelId: this.config.channelId,
            phone: this.formatPhone(phone),
            type,
            ...options,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        return { 
          success: false, 
          error: result.error || 'Failed to send message' 
        };
      }

      return { 
        success: true, 
        messageId: result.messageId 
      };
    } catch (error) {
      console.error('[CloudAPI Adapter] Send error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async sendText(phone: string, message: string): Promise<SendMessageResponse> {
    return this.sendMessage('text', phone, { content: message });
  }

  async sendImage(phone: string, imageUrl: string, caption?: string): Promise<SendMessageResponse> {
    return this.sendMessage('image', phone, { mediaUrl: imageUrl, caption });
  }

  async sendAudio(phone: string, audioUrl: string): Promise<SendMessageResponse> {
    return this.sendMessage('audio', phone, { mediaUrl: audioUrl });
  }

  async sendDocument(phone: string, documentUrl: string, filename: string): Promise<SendMessageResponse> {
    return this.sendMessage('document', phone, { mediaUrl: documentUrl, filename });
  }

  async sendVideo(phone: string, videoUrl: string, caption?: string): Promise<SendMessageResponse> {
    return this.sendMessage('video', phone, { mediaUrl: videoUrl, caption });
  }

  async sendLocation(phone: string, lat: number, lng: number, name?: string): Promise<SendMessageResponse> {
    // Cloud API suporta location, mas implementação simplificada
    return { success: false, error: 'Location messages not implemented for Cloud API' };
  }

  // Template messages (específico do Cloud API)
  async sendTemplate(
    phone: string, 
    templateName: string, 
    language: string = 'pt_BR',
    components?: any[]
  ): Promise<SendMessageResponse> {
    return this.sendMessage('template', phone, {
      template: { name: templateName, language, components }
    });
  }

  // =====================================================
  // WEBHOOK NORMALIZATION
  // =====================================================
  normalizeWebhook(payload: unknown): NormalizedMessage | null {
    try {
      const data = payload as any;
      
      // Cloud API webhook format
      const entry = data.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      
      if (!value?.messages?.[0]) {
        return null;
      }

      const message = value.messages[0];
      const contact = value.contacts?.[0];
      const metadata = value.metadata;

      return {
        id: message.id,
        provider: 'cloudapi',
        instanceId: metadata?.phone_number_id || '',
        from: message.from,
        fromName: contact?.profile?.name || message.from,
        isFromMe: false,
        type: this.normalizeMessageType(message.type),
        content: this.extractContent(message),
        mediaUrl: this.extractMediaUrl(message),
        mediaMimeType: undefined,
        caption: message[message.type]?.caption,
        timestamp: new Date(parseInt(message.timestamp) * 1000),
        status: 'delivered',
        originalId: message.id,
        referralData: message.referral ? {
          sourceUrl: message.referral.source_url,
          sourceId: message.referral.source_id,
          sourceType: message.referral.source_type,
          headline: message.referral.headline,
          body: message.referral.body,
        } : undefined,
      };
    } catch (error) {
      console.error('[CloudAPI Adapter] Normalize error:', error);
      return null;
    }
  }

  private normalizeMessageType(type: string): NormalizedMessage['type'] {
    const typeMap: Record<string, NormalizedMessage['type']> = {
      text: 'text',
      image: 'image',
      audio: 'audio',
      video: 'video',
      document: 'document',
      sticker: 'sticker',
      location: 'location',
      contacts: 'contact',
      button: 'button',
      interactive: 'button',
    };
    return typeMap[type] || 'text';
  }

  private extractContent(message: any): string {
    const type = message.type;
    
    switch (type) {
      case 'text':
        return message.text?.body || '';
      case 'image':
        return message.image?.caption || '[Imagem]';
      case 'audio':
        return '[Áudio]';
      case 'video':
        return message.video?.caption || '[Vídeo]';
      case 'document':
        return message.document?.filename || '[Documento]';
      case 'sticker':
        return '[Sticker]';
      case 'location':
        return `[Localização: ${message.location?.latitude}, ${message.location?.longitude}]`;
      case 'button':
        return message.button?.text || '[Botão]';
      case 'interactive':
        return message.interactive?.button_reply?.title || 
               message.interactive?.list_reply?.title || 
               '[Interativo]';
      default:
        return `[${type}]`;
    }
  }

  private extractMediaUrl(message: any): string | undefined {
    const type = message.type;
    const mediaTypes = ['image', 'audio', 'video', 'document', 'sticker'];
    
    if (mediaTypes.includes(type)) {
      return message[type]?.id; // Cloud API returns media ID, not URL
    }
    
    return undefined;
  }

  // =====================================================
  // UTILITÁRIOS
  // =====================================================
  formatPhone(phone: string): string {
    // Remove tudo exceto números
    let cleaned = phone.replace(/[^0-9]/g, '');
    
    // Adiciona código do Brasil se necessário
    if (cleaned.length === 10 || cleaned.length === 11) {
      cleaned = '55' + cleaned;
    }
    
    return cleaned;
  }
}
