import { 
  SendMessageResponse, 
  NormalizedMessage,
  ConnectionStatus,
  WhatsAppProvider 
} from '@/types/whatsapp';

export interface WhatsAppAdapter {
  provider: WhatsAppProvider;
  
  // Conexão
  connect(): Promise<{ qrCode?: string; status: ConnectionStatus }>;
  disconnect(): Promise<void>;
  getStatus(): Promise<ConnectionStatus>;
  
  // Mensagens
  sendText(phone: string, message: string): Promise<SendMessageResponse>;
  sendImage(phone: string, imageUrl: string, caption?: string): Promise<SendMessageResponse>;
  sendAudio(phone: string, audioUrl: string): Promise<SendMessageResponse>;
  sendDocument(phone: string, documentUrl: string, filename: string): Promise<SendMessageResponse>;
  sendVideo(phone: string, videoUrl: string, caption?: string): Promise<SendMessageResponse>;
  sendLocation(phone: string, lat: number, lng: number, name?: string): Promise<SendMessageResponse>;
  
  // Webhook
  normalizeWebhook(payload: unknown): NormalizedMessage | null;
  
  // Utilitários
  formatPhone(phone: string): string;
}
