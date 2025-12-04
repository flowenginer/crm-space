import { WhatsAppAdapter } from './base-adapter';
import { 
  SendMessageResponse, 
  NormalizedMessage, 
  ConnectionStatus,
  MessageType,
  UAZAPIConfig
} from '@/types/whatsapp';

export class UAZAPIAdapter implements WhatsAppAdapter {
  provider = 'uazapi' as const;
  private baseUrl: string;
  private config: UAZAPIConfig;

  constructor(config: UAZAPIConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.uazapi.com';
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.token}`,
    };
  }

  // =====================================================
  // CONEXÃO
  // =====================================================
  async connect(): Promise<{ qrCode?: string; status: ConnectionStatus }> {
    try {
      const statusRes = await fetch(
        `${this.baseUrl}/instance/${this.config.instanceId}/status`,
        { headers: this.headers }
      );
      const statusData = await statusRes.json();
      
      if (statusData.status === 'CONNECTED' || statusData.connected) {
        return { status: 'connected' };
      }
      
      const qrRes = await fetch(
        `${this.baseUrl}/instance/${this.config.instanceId}/qrcode`,
        { headers: this.headers }
      );
      const qrData = await qrRes.json();
      
      return {
        qrCode: qrData.qrcode || qrData.base64 || qrData.value,
        status: 'qr_code',
      };
    } catch (error) {
      console.error('[UAZAPI] Connect error:', error);
      return { status: 'disconnected' };
    }
  }

  async disconnect(): Promise<void> {
    try {
      await fetch(
        `${this.baseUrl}/instance/${this.config.instanceId}/logout`,
        {
          method: 'DELETE',
          headers: this.headers,
        }
      );
    } catch (error) {
      console.error('[UAZAPI] Disconnect error:', error);
    }
  }

  async getStatus(): Promise<ConnectionStatus> {
    try {
      const response = await fetch(
        `${this.baseUrl}/instance/${this.config.instanceId}/status`,
        { headers: this.headers }
      );
      const data = await response.json();
      
      const status = data.status || data.state;
      switch (status?.toUpperCase()) {
        case 'CONNECTED':
        case 'OPEN': 
          return 'connected';
        case 'DISCONNECTED':
        case 'CLOSE': 
          return 'disconnected';
        case 'CONNECTING': 
          return 'connecting';
        case 'QRCODE':
        case 'QR_CODE': 
          return 'qr_code';
        default: 
          return 'disconnected';
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
      const response = await fetch(`${this.baseUrl}/message/sendText`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          session: this.config.instanceId,
          number: this.formatPhone(phone),
          text: message,
        }),
      });
      const data = await response.json();
      
      return {
        success: data.status === true || data.success === true || !!data.messageId,
        messageId: data.messageId || data.id || data.key?.id,
        error: data.message || data.error,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendImage(phone: string, imageUrl: string, caption?: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/message/sendImage`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          session: this.config.instanceId,
          number: this.formatPhone(phone),
          image: imageUrl,
          caption: caption || '',
        }),
      });
      const data = await response.json();
      return {
        success: !!data.messageId || data.status === true,
        messageId: data.messageId || data.id,
        error: data.message,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendAudio(phone: string, audioUrl: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/message/sendAudio`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          session: this.config.instanceId,
          number: this.formatPhone(phone),
          audio: audioUrl,
        }),
      });
      const data = await response.json();
      return {
        success: !!data.messageId || data.status === true,
        messageId: data.messageId || data.id,
        error: data.message,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendDocument(phone: string, documentUrl: string, filename: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/message/sendDocument`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          session: this.config.instanceId,
          number: this.formatPhone(phone),
          document: documentUrl,
          fileName: filename,
        }),
      });
      const data = await response.json();
      return {
        success: !!data.messageId || data.status === true,
        messageId: data.messageId || data.id,
        error: data.message,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendVideo(phone: string, videoUrl: string, caption?: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/message/sendVideo`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          session: this.config.instanceId,
          number: this.formatPhone(phone),
          video: videoUrl,
          caption: caption || '',
        }),
      });
      const data = await response.json();
      return {
        success: !!data.messageId || data.status === true,
        messageId: data.messageId || data.id,
        error: data.message,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  async sendLocation(phone: string, lat: number, lng: number, name?: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/message/sendLocation`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          session: this.config.instanceId,
          number: this.formatPhone(phone),
          latitude: lat,
          longitude: lng,
          name: name || '',
        }),
      });
      const data = await response.json();
      return {
        success: !!data.messageId || data.status === true,
        messageId: data.messageId || data.id,
        error: data.message,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  // =====================================================
  // ENVIAR BOTÕES (Diferencial UAZAPI!)
  // =====================================================
  async sendButtons(
    phone: string, 
    text: string, 
    buttons: Array<{ id: string; text: string }>
  ): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/message/sendButtons`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          session: this.config.instanceId,
          number: this.formatPhone(phone),
          title: 'Menu',
          description: text,
          buttons: buttons.map(b => ({
            buttonId: b.id,
            buttonText: { displayText: b.text },
            type: 1,
          })),
        }),
      });
      const data = await response.json();
      return {
        success: !!data.messageId || data.status === true,
        messageId: data.messageId || data.id,
        error: data.message,
      };
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
      const event = data.event || data.type;
      
      if (event !== 'message' && event !== 'messages.upsert' && !data.message) {
        return null;
      }

      const msg = (data.data || data.message || data) as Record<string, unknown>;
      const messageType = this.detectMessageType(msg);
      
      let from = (msg.from || msg.remoteJid || msg.phone || '') as string;
      from = from.replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
      
      const key = msg.key as Record<string, unknown> | undefined;
      
      return {
        id: `uazapi_${msg.id || key?.id || Date.now()}`,
        provider: 'uazapi',
        instanceId: (data.instance || data.session || this.config.instanceId) as string,
        from,
        fromName: (msg.pushName || msg.senderName || '') as string,
        isFromMe: Boolean(msg.fromMe || key?.fromMe),
        type: messageType,
        content: this.extractContent(msg, messageType),
        mediaUrl: (msg.mediaUrl || (msg.media as Record<string, unknown>)?.url) as string | undefined,
        mediaMimeType: (msg.mimetype || (msg.media as Record<string, unknown>)?.mimetype) as string | undefined,
        caption: msg.caption as string | undefined,
        timestamp: new Date(msg.timestamp ? (msg.timestamp as number) * 1000 : Date.now()),
        quotedMessageId: (msg.quotedMessageId || (msg.contextInfo as Record<string, unknown>)?.stanzaId) as string | undefined,
        status: 'delivered',
        originalId: (msg.id || key?.id || '') as string,
      };
    } catch (error) {
      console.error('[UAZAPI] Normalize error:', error);
      return null;
    }
  }

  private detectMessageType(msg: Record<string, unknown>): MessageType {
    if (msg.type === 'chat' || msg.type === 'text' || msg.text || msg.body) return 'text';
    if (msg.type === 'image' || msg.image || msg.imageMessage) return 'image';
    if (msg.type === 'audio' || msg.type === 'ptt' || msg.audio || msg.audioMessage) return 'audio';
    if (msg.type === 'video' || msg.video || msg.videoMessage) return 'video';
    if (msg.type === 'document' || msg.document || msg.documentMessage) return 'document';
    if (msg.type === 'sticker' || msg.sticker || msg.stickerMessage) return 'sticker';
    if (msg.type === 'location' || msg.location || msg.locationMessage) return 'location';
    if (msg.type === 'vcard' || msg.type === 'contact' || msg.contactMessage) return 'contact';
    return 'text';
  }

  private extractContent(msg: Record<string, unknown>, type: MessageType): string {
    const message = msg.message as Record<string, unknown> | undefined;
    switch (type) {
      case 'text': 
        return (msg.body || msg.text || message?.conversation || 
               (message?.extendedTextMessage as Record<string, unknown>)?.text || '') as string;
      case 'image': return (msg.caption as string) || '[Imagem]';
      case 'audio': return '[Áudio]';
      case 'video': return (msg.caption as string) || '[Vídeo]';
      case 'document': return (msg.fileName || msg.title || '[Documento]') as string;
      case 'sticker': return '[Sticker]';
      case 'location': return '[Localização]';
      case 'contact': return '[Contato]';
      default: return '';
    }
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
