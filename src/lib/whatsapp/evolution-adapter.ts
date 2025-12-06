import { WhatsAppAdapter } from './base-adapter';
import { 
  SendMessageResponse, 
  NormalizedMessage, 
  ConnectionStatus,
  MessageType,
  EvolutionConfig
} from '@/types/whatsapp';

export class EvolutionAdapter implements WhatsAppAdapter {
  provider = 'evolution' as const;
  private config: EvolutionConfig;

  constructor(config: EvolutionConfig) {
    this.config = config;
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'apikey': this.config.apiKey,
    };
  }

  // =====================================================
  // CRIAR INSTÂNCIA (se não existir)
  // =====================================================
  async createInstance(): Promise<{ instanceName: string; status: string }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/instance/create`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          instanceName: this.config.instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS',
        }),
      });
      return await response.json();
    } catch (error) {
      console.error('[Evolution] Create instance error:', error);
      throw error;
    }
  }

  // =====================================================
  // CONEXÃO
  // =====================================================
  async connect(): Promise<{ qrCode?: string; status: ConnectionStatus }> {
    try {
      const connectRes = await fetch(
        `${this.config.baseUrl}/instance/connect/${this.config.instanceName}`,
        { headers: this.headers }
      );
      const connectData = await connectRes.json();
      
      if (connectData.instance?.state === 'open') {
        return { status: 'connected' };
      }
      
      const qrRes = await fetch(
        `${this.config.baseUrl}/instance/qrcode/${this.config.instanceName}`,
        { headers: this.headers }
      );
      const qrData = await qrRes.json();
      
      return {
        qrCode: qrData.qrcode?.base64 || qrData.base64 || qrData.code,
        status: 'qr_code',
      };
    } catch (error) {
      console.error('[Evolution] Connect error:', error);
      return { status: 'disconnected' };
    }
  }

  async disconnect(): Promise<void> {
    try {
      await fetch(
        `${this.config.baseUrl}/instance/logout/${this.config.instanceName}`,
        {
          method: 'DELETE',
          headers: this.headers,
        }
      );
    } catch (error) {
      console.error('[Evolution] Disconnect error:', error);
    }
  }

  async getStatus(): Promise<ConnectionStatus> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/instance/connectionState/${this.config.instanceName}`,
        { headers: this.headers }
      );
      const data = await response.json();
      
      const state = data.instance?.state || data.state;
      switch (state) {
        case 'open': return 'connected';
        case 'close': return 'disconnected';
        case 'connecting': return 'connecting';
        default: return 'disconnected';
      }
    } catch {
      return 'disconnected';
    }
  }

  // =====================================================
  // ENVIO DE MENSAGENS
  // =====================================================
  async sendText(phone: string, message: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/message/sendText/${this.config.instanceName}`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            number: this.formatPhone(phone),
            text: message,
          }),
        }
      );
      const data = await response.json();
      
      return {
        success: !!data.key?.id,
        messageId: data.key?.id,
        error: data.message || data.error,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendImage(phone: string, imageUrl: string, caption?: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/message/sendMedia/${this.config.instanceName}`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            number: this.formatPhone(phone),
            mediatype: 'image',
            media: imageUrl,
            caption: caption || '',
          }),
        }
      );
      const data = await response.json();
      return { success: !!data.key?.id, messageId: data.key?.id, error: data.message };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendAudio(phone: string, audioUrl: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/message/sendWhatsAppAudio/${this.config.instanceName}`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            number: this.formatPhone(phone),
            audio: audioUrl,
          }),
        }
      );
      const data = await response.json();
      return { success: !!data.key?.id, messageId: data.key?.id, error: data.message };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendDocument(phone: string, documentUrl: string, filename: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/message/sendMedia/${this.config.instanceName}`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            number: this.formatPhone(phone),
            mediatype: 'document',
            media: documentUrl,
            fileName: filename,
          }),
        }
      );
      const data = await response.json();
      return { success: !!data.key?.id, messageId: data.key?.id, error: data.message };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendVideo(phone: string, videoUrl: string, caption?: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/message/sendMedia/${this.config.instanceName}`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            number: this.formatPhone(phone),
            mediatype: 'video',
            media: videoUrl,
            caption: caption || '',
          }),
        }
      );
      const data = await response.json();
      return { success: !!data.key?.id, messageId: data.key?.id, error: data.message };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendLocation(phone: string, lat: number, lng: number, name?: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/message/sendLocation/${this.config.instanceName}`,
        {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify({
            number: this.formatPhone(phone),
            latitude: lat,
            longitude: lng,
            name: name || '',
          }),
        }
      );
      const data = await response.json();
      return { success: !!data.key?.id, messageId: data.key?.id, error: data.message };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  // =====================================================
  // CONFIGURAR WEBHOOK
  // =====================================================
  async setWebhook(webhookUrl: string): Promise<void> {
    await fetch(
      `${this.config.baseUrl}/webhook/set/${this.config.instanceName}`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            events: [
              'MESSAGES_UPSERT',
              'MESSAGES_UPDATE',
              'CONNECTION_UPDATE',
              'QRCODE_UPDATED',
            ],
          },
        }),
      }
    );
  }

  // =====================================================
  // WEBHOOK - NORMALIZAR MENSAGENS RECEBIDAS
  // =====================================================
  normalizeWebhook(payload: unknown): NormalizedMessage | null {
    try {
      const data = payload as Record<string, unknown>;
      if (data.event !== 'messages.upsert') return null;

      const msg = data.data as Record<string, unknown>;
      if (!msg?.key) return null;

      const key = msg.key as Record<string, unknown>;
      const messageType = this.detectMessageType(msg);
      
      let from = (key.remoteJid || '') as string;
      from = from.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
      
      return {
        id: `evolution_${key.id}`,
        provider: 'evolution',
        instanceId: (data.instance || this.config.instanceName) as string,
        from,
        fromName: (msg.pushName || '') as string,
        isFromMe: Boolean(key.fromMe),
        type: messageType,
        content: this.extractContent(msg, messageType),
        mediaUrl: this.extractMediaUrl(msg),
        mediaMimeType: this.extractMimetype(msg),
        caption: this.extractCaption(msg),
        timestamp: new Date(((msg.messageTimestamp as number) || 0) * 1000),
        quotedMessageId: this.extractQuotedId(msg),
        status: 'delivered',
        originalId: key.id as string,
      };
    } catch (error) {
      console.error('[Evolution] Normalize error:', error);
      return null;
    }
  }

  private detectMessageType(msg: Record<string, unknown>): MessageType {
    const message = msg.message as Record<string, unknown> | undefined;
    if (!message) return 'text';
    
    if (message.conversation || message.extendedTextMessage) return 'text';
    if (message.imageMessage) return 'image';
    if (message.audioMessage) return 'audio';
    if (message.videoMessage) return 'video';
    if (message.documentMessage) return 'document';
    if (message.stickerMessage) return 'sticker';
    if (message.locationMessage) return 'location';
    if (message.contactMessage) return 'contact';
    return 'text';
  }

  private extractContent(msg: Record<string, unknown>, type: MessageType): string {
    const message = msg.message as Record<string, unknown> | undefined;
    if (!message) return '';
    
    switch (type) {
      case 'text': 
        return (message.conversation || 
               (message.extendedTextMessage as Record<string, unknown>)?.text || '') as string;
      case 'image': return ((message.imageMessage as Record<string, unknown>)?.caption as string) || '[Imagem]';
      case 'audio': return '[Áudio]';
      case 'video': return ((message.videoMessage as Record<string, unknown>)?.caption as string) || '[Vídeo]';
      case 'document': return ((message.documentMessage as Record<string, unknown>)?.fileName as string) || '[Documento]';
      case 'sticker': return '[Sticker]';
      case 'location': return '[Localização]';
      case 'contact': return '[Contato]';
      default: return '';
    }
  }

  private extractMediaUrl(msg: Record<string, unknown>): string | undefined {
    const message = msg.message as Record<string, unknown> | undefined;
    if (!message) return undefined;
    
    return (message.imageMessage as Record<string, unknown>)?.url as string || 
           (message.audioMessage as Record<string, unknown>)?.url as string || 
           (message.videoMessage as Record<string, unknown>)?.url as string || 
           (message.documentMessage as Record<string, unknown>)?.url as string ||
           (message.stickerMessage as Record<string, unknown>)?.url as string;
  }

  private extractMimetype(msg: Record<string, unknown>): string | undefined {
    const message = msg.message as Record<string, unknown> | undefined;
    if (!message) return undefined;
    
    return (message.imageMessage as Record<string, unknown>)?.mimetype as string || 
           (message.audioMessage as Record<string, unknown>)?.mimetype as string || 
           (message.videoMessage as Record<string, unknown>)?.mimetype as string || 
           (message.documentMessage as Record<string, unknown>)?.mimetype as string ||
           (message.stickerMessage as Record<string, unknown>)?.mimetype as string;
  }

  private extractCaption(msg: Record<string, unknown>): string | undefined {
    const message = msg.message as Record<string, unknown> | undefined;
    if (!message) return undefined;
    
    return (message.imageMessage as Record<string, unknown>)?.caption as string ||
           (message.videoMessage as Record<string, unknown>)?.caption as string;
  }

  private extractQuotedId(msg: Record<string, unknown>): string | undefined {
    const message = msg.message as Record<string, unknown> | undefined;
    const extendedText = message?.extendedTextMessage as Record<string, unknown> | undefined;
    const contextInfo = extendedText?.contextInfo as Record<string, unknown> | undefined;
    return contextInfo?.stanzaId as string | undefined;
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
