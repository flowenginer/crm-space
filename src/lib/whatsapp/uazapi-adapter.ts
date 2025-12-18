import { WhatsAppAdapter } from './base-adapter';
import { 
  SendMessageResponse, 
  NormalizedMessage, 
  ConnectionStatus,
  MessageType,
  UAZAPIConfig,
  ReferralData
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
      'Accept': 'application/json',
      'token': this.config.token,
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
  // =====================================================
  // UAZAPI V2 - Endpoints corretos conforme docs.uazapi.com
  // /send/text para texto, /send/media para todos os tipos de mídia
  // =====================================================
  async sendText(phone: string, message: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/send/text`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
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
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  async sendImage(phone: string, imageUrl: string, caption?: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/send/media`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          number: this.formatPhone(phone),
          type: 'image',
          file: imageUrl,
          caption: caption || '',
        }),
      });
      const data = await response.json();
      return {
        success: data.status === true || !!data.messageId,
        messageId: data.messageId || data.id || data.key?.id,
        error: data.message || data.error,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  async sendAudio(phone: string, audioUrl: string): Promise<SendMessageResponse> {
    try {
      // UAZAPI V2: ptt = Push-to-Talk (mensagem de voz)
      const response = await fetch(`${this.baseUrl}/send/media`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          number: this.formatPhone(phone),
          type: 'ptt',
          file: audioUrl,
        }),
      });
      const data = await response.json();
      return {
        success: data.status === true || !!data.messageId,
        messageId: data.messageId || data.id || data.key?.id,
        error: data.message || data.error,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  async sendDocument(phone: string, documentUrl: string, filename: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/send/media`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          number: this.formatPhone(phone),
          type: 'document',
          file: documentUrl,
          filename: filename,
        }),
      });
      const data = await response.json();
      return {
        success: data.status === true || !!data.messageId,
        messageId: data.messageId || data.id || data.key?.id,
        error: data.message || data.error,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  async sendVideo(phone: string, videoUrl: string, caption?: string): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/send/media`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          number: this.formatPhone(phone),
          type: 'video',
          file: videoUrl,
          caption: caption || '',
        }),
      });
      const data = await response.json();
      return {
        success: data.status === true || !!data.messageId,
        messageId: data.messageId || data.id || data.key?.id,
        error: data.message || data.error,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  async sendLocation(phone: string, lat: number, lng: number, name?: string): Promise<SendMessageResponse> {
    try {
      // UAZAPI V2: /send/location
      const response = await fetch(`${this.baseUrl}/send/location`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          number: this.formatPhone(phone),
          latitude: lat,
          longitude: lng,
          name: name || '',
        }),
      });
      const data = await response.json();
      return {
        success: data.status === true || !!data.messageId,
        messageId: data.messageId || data.id || data.key?.id,
        error: data.message || data.error,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  // =====================================================
  // UAZAPI V2 - Menu Interativo (Botões)
  // Docs: https://docs.uazapi.com/endpoint/post/send~menu
  // =====================================================
  async sendButtons(
    phone: string, 
    text: string, 
    buttons: Array<{ id: string; text: string }>
  ): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/send/menu`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          number: this.formatPhone(phone),
          type: 'buttons',
          text: text,
          buttons: buttons.map(b => ({
            id: b.id,
            text: b.text,
          })),
        }),
      });
      const data = await response.json();
      return {
        success: data.status === true || !!data.messageId,
        messageId: data.messageId || data.id || data.key?.id,
        error: data.message || data.error,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  // =====================================================
  // UAZAPI V2 - Enviar Contato (vCard)
  // Docs: https://docs.uazapi.com/endpoint/post/send~contact
  // =====================================================
  async sendContact(
    phone: string,
    contactName: string,
    contactPhone: string
  ): Promise<SendMessageResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/send/contact`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          number: this.formatPhone(phone),
          name: contactName,
          phone: this.formatPhone(contactPhone),
        }),
      });
      const data = await response.json();
      return {
        success: data.status === true || !!data.messageId,
        messageId: data.messageId || data.id || data.key?.id,
        error: data.message || data.error,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: msg };
    }
  }

  // =====================================================
  // WEBHOOK - NORMALIZAR MENSAGENS RECEBIDAS
  // =====================================================
  normalizeWebhook(payload: unknown): NormalizedMessage | null {
    try {
      const data = payload as Record<string, unknown>;
      
      // Verificar se é o novo formato UAZAPI (body.EventType)
      if ((data.body as Record<string, unknown>)?.EventType === 'messages') {
        return this.normalizeWebhookNew(data);
      }
      
      // Fallback para formato legado
      return this.normalizeWebhookLegacy(data);
    } catch (error) {
      console.error('[UAZAPI] Normalize error:', error);
      return null;
    }
  }

  /**
   * Normaliza webhook no NOVO formato UAZAPI (body.EventType = "messages")
   */
  private normalizeWebhookNew(payload: Record<string, unknown>): NormalizedMessage | null {
    const body = payload.body as Record<string, unknown>;
    if (!body || body.EventType !== 'messages') return null;
    
    const message = body.message as Record<string, unknown>;
    const chat = body.chat as Record<string, unknown>;
    
    if (!message) return null;
    
    // Resolução LID: UAZAPI fornece sender_pn separado!
    let from = '';
    
    // Prioridade 1: sender_pn (número real)
    if (message.sender_pn) {
      from = (message.sender_pn as string)
        .replace('@s.whatsapp.net', '')
        .replace('@c.us', '')
        .replace(/\D/g, '');
    }
    // Prioridade 2: chat.phone
    else if (chat?.phone) {
      from = (chat.phone as string).replace(/\D/g, '');
    }
    // Prioridade 3: chatid
    else if (message.chatid) {
      from = (message.chatid as string)
        .replace('@s.whatsapp.net', '')
        .replace('@c.us', '')
        .replace(/\D/g, '');
    }
    
    // Ignorar grupos
    if (message.isGroup || chat?.wa_isGroup) {
      return null;
    }
    
    const messageType = this.detectMessageTypeNew(message);
    
    // Extrair referral data (Meta Ads)
    const referralData = !message.fromMe 
      ? this.extractReferralData(message) 
      : undefined;
    
    // Timestamp: UAZAPI usa milissegundos
    const timestamp = message.messageTimestamp 
      ? new Date(message.messageTimestamp as number)
      : new Date();
    
    return {
      id: `uazapi_${message.messageid}`,
      provider: 'uazapi',
      instanceId: (body.instanceName as string) || '',
      from,
      fromName: (message.senderName || chat?.wa_name || '') as string,
      isFromMe: Boolean(message.fromMe),
      type: messageType,
      content: this.extractContentNew(message, messageType),
      mediaUrl: this.extractMediaUrl(message),
      mediaMimeType: message.mediaType as string | undefined,
      caption: (message.content as Record<string, unknown>)?.caption as string | undefined,
      timestamp,
      quotedMessageId: (message.quoted as string) || ((message.content as Record<string, unknown>)?.contextInfo as Record<string, unknown>)?.stanzaId as string | undefined,
      status: 'delivered',
      originalId: message.messageid as string,
      referralData,
    };
  }

  /**
   * Normaliza webhook no formato LEGADO
   */
  private normalizeWebhookLegacy(data: Record<string, unknown>): NormalizedMessage | null {
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
      mediaUrl: (msg.mediaUrl || (msg.media as Record<string, unknown>)?.url || (msg.sticker as Record<string, unknown>)?.url || msg.stickerUrl) as string | undefined,
      mediaMimeType: (msg.mimetype || (msg.media as Record<string, unknown>)?.mimetype) as string | undefined,
      caption: msg.caption as string | undefined,
      timestamp: new Date(msg.timestamp ? (msg.timestamp as number) * 1000 : Date.now()),
      quotedMessageId: (msg.quotedMessageId || (msg.contextInfo as Record<string, unknown>)?.stanzaId) as string | undefined,
      status: 'delivered',
      originalId: (msg.id || key?.id || '') as string,
    };
  }

  /**
   * Extrai dados de referral/Meta Ads do formato UAZAPI
   */
  private extractReferralData(message: Record<string, unknown>): ReferralData | undefined {
    const content = message?.content as Record<string, unknown>;
    const contextInfo = content?.contextInfo as Record<string, unknown>;
    
    if (!contextInfo) return undefined;
    
    const externalAd = contextInfo.externalAdReply as Record<string, unknown>;
    
    // Verificar se é de Meta Ads
    const isFromAds = 
      contextInfo.conversionSource === 'FB_Ads' ||
      externalAd?.showAdAttribution ||
      contextInfo.entryPointConversionSource === 'ctwa_ad' ||
      externalAd?.sourceType === 'ad';
    
    if (!isFromAds) return undefined;
    
    const referralData: ReferralData = {
      ctwaClid: externalAd?.ctwaClid as string,
      sourceId: externalAd?.sourceID as string,
      sourceType: (externalAd?.sourceType as string) || 'ad',
      sourceUrl: externalAd?.sourceURL as string,
      headline: externalAd?.title as string,
      body: externalAd?.greetingMessageBody as string,
      thumbnailUrl: externalAd?.thumbnailURL as string,
      imageUrl: (externalAd?.originalImageURL || externalAd?.thumbnailURL) as string,
      videoUrl: externalAd?.mediaURL as string,
      showAdAttribution: Boolean(externalAd?.showAdAttribution),
      // Campos UAZAPI específicos:
      sourceApp: externalAd?.sourceApp as string,
      conversionSource: contextInfo.conversionSource as string,
      ctwaPayload: contextInfo.ctwaPayload as string,
      greetingMessageBody: externalAd?.greetingMessageBody as string,
    };
    
    // Limpar campos undefined
    Object.keys(referralData).forEach(key => {
      if (referralData[key as keyof ReferralData] === undefined) {
        delete referralData[key as keyof ReferralData];
      }
    });
    
    return Object.keys(referralData).length > 0 ? referralData : undefined;
  }

  private detectMessageTypeNew(msg: Record<string, unknown>): MessageType {
    const type = ((msg.type || msg.messageType || '') as string).toLowerCase();
    
    switch (type) {
      case 'text':
      case 'extendedtextmessage':
      case 'chat':
        return 'text';
      case 'image':
      case 'imagemessage':
        return 'image';
      case 'audio':
      case 'ptt':
      case 'audiomessage':
        return 'audio';
      case 'video':
      case 'videomessage':
        return 'video';
      case 'document':
      case 'documentmessage':
        return 'document';
      case 'sticker':
      case 'stickermessage':
        return 'sticker';
      case 'location':
      case 'locationmessage':
        return 'location';
      case 'vcard':
      case 'contact':
      case 'contactmessage':
        return 'contact';
      default:
        if (msg.text || (msg.content as Record<string, unknown>)?.text) return 'text';
        return 'text';
    }
  }

  private extractContentNew(msg: Record<string, unknown>, type: MessageType): string {
    const content = msg.content as Record<string, unknown>;
    switch (type) {
      case 'text': 
        return (msg.text || content?.text || msg.body || '') as string;
      case 'image': 
        return (content?.caption || msg.caption || '[Imagem]') as string;
      case 'audio': 
        return '[Áudio]';
      case 'video': 
        return (content?.caption || msg.caption || '[Vídeo]') as string;
      case 'document': 
        return (msg.fileName || msg.title || '[Documento]') as string;
      case 'sticker': 
        return '[Sticker]';
      case 'location': 
        return '[Localização]';
      case 'contact': 
        return '[Contato]';
      default: 
        return '';
    }
  }

  private extractMediaUrl(msg: Record<string, unknown>): string | undefined {
    return (msg.mediaUrl || (msg.media as Record<string, unknown>)?.url || (msg.content as Record<string, unknown>)?.mediaUrl) as string | undefined;
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
