// =====================================================
// TIPOS PARA INSTAGRAM MESSAGING API (Meta)
// =====================================================

// Status de conexão do canal Instagram
export type InstagramConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected';

// Tipos de mensagem suportados pelo Instagram
export type InstagramMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'sticker'
  | 'story_reply'
  | 'story_mention'
  | 'reel_reply';

// Status de mensagem
export type InstagramMessageStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

// =====================================================
// CONFIGURAÇÃO DO CANAL INSTAGRAM
// =====================================================
export interface InstagramChannelConfig {
  id: string;
  tenant_id: string;
  channel_id: string | null;

  // Credenciais Meta / Instagram
  instagram_account_id: string;
  instagram_username: string;
  page_id: string;
  page_access_token: string;
  app_secret: string | null;
  verify_token: string;

  // Status
  is_active: boolean;
  webhook_configured: boolean;
  status: InstagramConnectionStatus;

  // Departamento
  department_id: string | null;

  // Metadados
  profile_picture_url: string | null;
  followers_count: number | null;
  name: string;

  created_at: string;
  updated_at: string;
}

// =====================================================
// CANAL INSTAGRAM (tabela instagram_channels)
// =====================================================
export interface InstagramChannel {
  id: string;
  name: string;
  instagram_account_id: string;
  instagram_username: string;
  page_id: string;
  page_access_token: string;
  app_secret: string | null;
  verify_token: string;
  profile_picture_url: string | null;
  followers_count: number | null;
  status: InstagramConnectionStatus;
  is_active: boolean;
  webhook_configured: boolean;
  department_id: string | null;
  tenant_id: string;
  messages_sent: number | null;
  messages_received: number | null;
  messages_sent_today: number | null;
  messages_received_today: number | null;
  last_sync_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  department?: { id: string; name: string } | null;
}

// =====================================================
// MENSAGEM NORMALIZADA DO INSTAGRAM
// =====================================================
export interface InstagramNormalizedMessage {
  id: string;
  instanceId: string; // instagram_account_id

  // Remetente
  from: string; // IGSID (Instagram Scoped User ID)
  fromName?: string;
  fromUsername?: string;
  isFromMe: boolean;

  // Conteúdo
  type: InstagramMessageType;
  content: string;
  mediaUrl?: string;
  mediaMimeType?: string;

  // Story/Reel referência
  storyUrl?: string;
  reelUrl?: string;

  // Metadados
  timestamp: Date;
  status: InstagramMessageStatus;
  originalId: string; // mid do Instagram

  // Referral (se veio de anúncio)
  referralData?: {
    sourceId?: string;
    sourceType?: string;
    adId?: string;
  };
}

// =====================================================
// PAYLOADS DE ENVIO
// =====================================================
export interface InstagramSendMessagePayload {
  recipientId: string; // IGSID
  type: 'text' | 'image' | 'video' | 'audio';
  content?: string;
  mediaUrl?: string;
}

export interface InstagramSendMessageResponse {
  success: boolean;
  messageId?: string;
  recipientId?: string;
  error?: string;
}

// =====================================================
// WEBHOOK PAYLOADS (Meta Instagram)
// =====================================================
export interface InstagramWebhookPayload {
  object: 'instagram';
  entry: InstagramWebhookEntry[];
}

export interface InstagramWebhookEntry {
  id: string; // Instagram Account ID
  time: number;
  messaging: InstagramWebhookMessaging[];
}

export interface InstagramWebhookMessaging {
  sender: { id: string };
  recipient: { id: string };
  timestamp: number;
  message?: {
    mid: string;
    text?: string;
    is_echo?: boolean;
    attachments?: InstagramWebhookAttachment[];
    reply_to?: {
      mid: string;
      story?: { url: string; id: string };
    };
  };
  postback?: {
    mid: string;
    title: string;
    payload: string;
  };
  reaction?: {
    mid: string;
    action: 'react' | 'unreact';
    reaction?: string; // emoji
  };
  read?: {
    mid: string;
    watermark: number;
  };
}

export interface InstagramWebhookAttachment {
  type: 'image' | 'video' | 'audio' | 'file' | 'story_mention' | 'reel';
  payload: {
    url?: string;
    sticker_id?: number;
    reel_video_id?: string;
  };
}

// =====================================================
// OAUTH FLOW
// =====================================================
export interface InstagramOAuthConfig {
  appId: string;
  redirectUri: string;
  scopes: string[];
}

export interface InstagramOAuthResponse {
  accessToken: string;
  userId: string;
  expiresIn: number;
}

export interface InstagramPageInfo {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  instagramAccountId: string;
  instagramUsername: string;
  profilePictureUrl?: string;
  followersCount?: number;
}
