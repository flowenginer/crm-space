// =====================================================
// ENUMS E TIPOS
// =====================================================
export type WhatsAppProvider = 'zapi' | 'uazapi' | 'evolution';

export type MessageType = 
  | 'text' 
  | 'image' 
  | 'audio' 
  | 'video' 
  | 'document' 
  | 'sticker' 
  | 'location'
  | 'contact'
  | 'button'
  | 'list';

export type MessageStatus = 
  | 'pending' 
  | 'sent' 
  | 'delivered' 
  | 'read' 
  | 'failed';

export type ConnectionStatus = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'qr_code';

// =====================================================
// INTERFACES
// =====================================================
export interface WhatsAppChannelConfig {
  id: string;
  name: string;
  phone: string;
  provider: WhatsAppProvider;
  providerId: string;
  instanceId: string;
  instanceToken?: string;
  status: ConnectionStatus;
  qrCode?: string;
  qrExpiresAt?: Date;
  batteryLevel?: number;
  lastSyncAt?: Date;
  departmentId?: string;
}

export interface NormalizedMessage {
  id: string;
  provider: WhatsAppProvider;
  instanceId: string;
  
  // Remetente
  from: string;
  fromName?: string;
  isFromMe: boolean;
  
  // Conteúdo
  type: MessageType;
  content: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  caption?: string;
  
  // Metadados
  timestamp: Date;
  quotedMessageId?: string;
  
  // Status e IDs
  status: MessageStatus;
  originalId: string;
}

export interface SendMessagePayload {
  phone: string;
  type: MessageType;
  content: string;
  mediaUrl?: string;
  caption?: string;
  filename?: string;
}

export interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

// =====================================================
// CONFIGS POR PROVEDOR
// =====================================================
export interface ZAPIConfig {
  instanceId: string;
  token: string;
  clientToken?: string;
}

export interface UAZAPIConfig {
  instanceId: string;
  token: string;
  baseUrl?: string;
}

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

// =====================================================
// DATABASE TYPES
// =====================================================
export interface WhatsAppProviderDB {
  id: string;
  name: string;
  code: WhatsAppProvider;
  base_url: string;
  api_key: string | null;
  api_secret: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookLog {
  id: string;
  provider: string;
  event_type: string;
  instance_id: string | null;
  payload: Record<string, unknown>;
  processed: boolean;
  error_message: string | null;
  created_at: string;
}
