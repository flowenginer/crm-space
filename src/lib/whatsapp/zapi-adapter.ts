import { WhatsAppAdapter } from './base-adapter';
import { 
  SendMessageResponse, 
  NormalizedMessage, 
  ConnectionStatus,
  MessageType,
  ZAPIConfig
} from '@/types/whatsapp';

export class ZAPIAdapter implements WhatsAppAdapter {
  provider = 'zapi' as const;
  private baseUrl = 'https://api.z-api.io';
  private config: ZAPIConfig;

  constructor(config: ZAPIConfig) {
    this.config = config;
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'Client-Token': this.config.clientToken || '',
    };
  }

  private get instanceUrl() {
    return `${this.baseUrl}/instances/${this.config.instanceId}/token/${this.config.token}`;
  }

  // =====================================================
  // CONEXÃO
  // =====================================================
  async connect(): Promise<{ qrCode?: string; status: ConnectionStatus }> {
    try {
      const statusRes = await fetch(`${this.instanceUrl}/status`, {
        headers: this.headers,
      });
      const statusData = await statusRes.json();
      
      if (statusData.connected) {
        return { status: 'connected' };
      }
      
      const qrRes = await fetch(`${this.instanceUrl}/qr-code/image`, {
        headers: this.headers,
      });
      const qrData = await qrRes.json();
      
      return {
        qrCode: qrData.value,
        status: 'qr_code',
      };
    } catch (error) {
      console.error('[Z-API] Connect error:', error);
      return { status: 'disconnected' };
    }
  }

  async disconnect(): Promise<void> {
    await fetch(`${this.instanceUrl}/disconnect`, {
      method: 'POST',
      headers: this.headers,
    });
  }

  async getStatus(): Promise<ConnectionStatus> {
    try {
      const response = await fetch(`${this.instanceUrl}/status`, {
        headers: this.headers,
      });
      const data = await response.json();
      
      if (data.connected) return 'connected';
      if (data.smartphoneConnected === false) return 'disconnected';
      return 'connecting';
    } catch {
      return 'disconnected';
    }
  }

  // =====================================================
  // ENVIO DE MENSAGENS
  // =====================================================
  async sendText(phone: string, message: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.instanceUrl}/send-text`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          phone: this.formatPhone(phone),
          message,
        }),
      });
      const data = await response.json();
      
      return {
        success: !data.error,
        messageId: data.messageId,
        error: data.error,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendImage(phone: string, imageUrl: string, caption?: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.instanceUrl}/send-image`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          phone: this.formatPhone(phone),
          image: imageUrl,
          caption: caption || '',
        }),
      });
      const data = await response.json();
      return { success: !data.error, messageId: data.messageId, error: data.error };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendAudio(phone: string, audioUrl: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.instanceUrl}/send-audio`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          phone: this.formatPhone(phone),
          audio: audioUrl,
        }),
      });
      const data = await response.json();
      return { success: !data.error, messageId: data.messageId, error: data.error };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendDocument(phone: string, documentUrl: string, filename: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.instanceUrl}/send-document/${this.formatPhone(phone)}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          document: documentUrl,
          fileName: filename,
        }),
      });
      const data = await response.json();
      return { success: !data.error, messageId: data.messageId, error: data.error };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendVideo(phone: string, videoUrl: string, caption?: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.instanceUrl}/send-video`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          phone: this.formatPhone(phone),
          video: videoUrl,
          caption: caption || '',
        }),
      });
      const data = await response.json();
      return { success: !data.error, messageId: data.messageId, error: data.error };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendLocation(phone: string, lat: number, lng: number, name?: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.instanceUrl}/send-location`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          phone: this.formatPhone(phone),
          latitude: lat.toString(),
          longitude: lng.toString(),
          name: name || '',
        }),
      });
      const data = await response.json();
      return { success: !data.error, messageId: data.messageId, error: data.error };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  // =====================================================
  // WEBHOOK - NORMALIZAR MENSAGENS RECEBIDAS
  // =====================================================
  normalizeWebhook(payload: unknown): NormalizedMessage | null {
    try {
      const data = payload as Record<string, unknown>;
      if (!data.phone || data.fromMe === undefined) return null;

      const messageType = this.detectMessageType(data);
      
      return {
        id: `zapi_${data.messageId}`,
        provider: 'zapi',
        instanceId: (data.instanceId as string) || this.config.instanceId,
        from: String(data.phone).replace(/\D/g, ''),
        fromName: (data.senderName as string) || (data.chatName as string) || '',
        isFromMe: Boolean(data.fromMe),
        type: messageType,
        content: this.extractContent(data, messageType),
        mediaUrl: this.extractMediaUrl(data),
        mediaMimeType: this.extractMimetype(data),
        caption: this.extractCaption(data),
        timestamp: new Date((data.momment as number) || Date.now()),
        quotedMessageId: (data.quotedMessage as Record<string, unknown>)?.messageId as string | undefined,
        status: 'delivered',
        originalId: data.messageId as string,
      };
    } catch (error) {
      console.error('[Z-API] Normalize error:', error);
      return null;
    }
  }

  private detectMessageType(payload: Record<string, unknown>): MessageType {
    if (payload.text) return 'text';
    if (payload.image) return 'image';
    if (payload.audio) return 'audio';
    if (payload.video) return 'video';
    if (payload.document) return 'document';
    if (payload.sticker) return 'sticker';
    if (payload.location) return 'location';
    if (payload.contact) return 'contact';
    return 'text';
  }

  private extractContent(payload: Record<string, unknown>, type: MessageType): string {
    switch (type) {
      case 'text': {
        const text = payload.text as Record<string, unknown> | string;
        return typeof text === 'object' ? (text.message as string) || '' : text || '';
      }
      case 'image': return ((payload.image as Record<string, unknown>)?.caption as string) || '[Imagem]';
      case 'audio': return '[Áudio]';
      case 'video': return ((payload.video as Record<string, unknown>)?.caption as string) || '[Vídeo]';
      case 'document': return ((payload.document as Record<string, unknown>)?.fileName as string) || '[Documento]';
      case 'sticker': return '[Sticker]';
      case 'location': {
        const loc = payload.location as Record<string, unknown>;
        return `[Localização: ${loc?.latitude}, ${loc?.longitude}]`;
      }
      case 'contact': {
        const contact = payload.contact as Record<string, unknown>;
        return `[Contato: ${contact?.displayName || 'Desconhecido'}]`;
      }
      default: return '';
    }
  }

  private extractMediaUrl(payload: Record<string, unknown>): string | undefined {
    return (payload.image as Record<string, unknown>)?.imageUrl as string ||
           (payload.audio as Record<string, unknown>)?.audioUrl as string ||
           (payload.video as Record<string, unknown>)?.videoUrl as string ||
           (payload.document as Record<string, unknown>)?.documentUrl as string ||
           (payload.sticker as Record<string, unknown>)?.stickerUrl as string;
  }

  private extractMimetype(payload: Record<string, unknown>): string | undefined {
    return (payload.image as Record<string, unknown>)?.mimetype as string ||
           (payload.audio as Record<string, unknown>)?.mimetype as string ||
           (payload.video as Record<string, unknown>)?.mimetype as string ||
           (payload.document as Record<string, unknown>)?.mimetype as string ||
           (payload.sticker as Record<string, unknown>)?.mimetype as string;
  }

  private extractCaption(payload: Record<string, unknown>): string | undefined {
    return (payload.image as Record<string, unknown>)?.caption as string ||
           (payload.video as Record<string, unknown>)?.caption as string;
  }

  // =====================================================
  // UTILITÁRIOS
  // =====================================================
  formatPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 || cleaned.length === 10) {
      cleaned = '55' + cleaned;
    }
    return cleaned;
  }
}
