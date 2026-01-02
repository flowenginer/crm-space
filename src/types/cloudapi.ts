// =====================================================
// TIPOS PARA CLOUD API (Meta WhatsApp Business API)
// =====================================================

// Configuração da Cloud API por tenant
export interface CloudAPIConfig {
  id: string;
  tenant_id: string;
  channel_id: string | null;
  
  // Credenciais Meta
  phone_number_id: string;
  waba_id: string | null;
  business_account_id: string | null;
  access_token: string;
  verify_token: string;
  app_secret: string | null;
  
  // Configurações
  is_active: boolean;
  webhook_configured: boolean;
  api_version: string;
  
  // Calling API
  calling_enabled: boolean;
  voip_provider: VoIPProvider | null;
  voip_config: VoIPConfig;
  
  // Transcription & Sentiment
  transcription_enabled: boolean;
  sentiment_analysis_enabled: boolean;
  
  created_at: string;
  updated_at: string;
}

// Provedores VoIP suportados
export type VoIPProvider = 'twilio' | 'asterisk' | 'none';

// Configuração VoIP
export interface VoIPConfig {
  // Twilio
  twilio_account_sid?: string;
  twilio_auth_token?: string;
  twilio_phone_number?: string;
  
  // Asterisk
  asterisk_host?: string;
  asterisk_port?: number;
  asterisk_username?: string;
  asterisk_password?: string;
  asterisk_context?: string;
}

// =====================================================
// TIPOS PARA CHAMADAS
// =====================================================

// Tipos de chamada
export type CallType = 'manual' | 'whatsapp' | 'voip';

// Direção da chamada
export type CallDirection = 'inbound' | 'outbound';

// Status da chamada WhatsApp
export type WhatsAppCallStatus = 
  | 'ringing'
  | 'accepted'
  | 'rejected'
  | 'terminated'
  | 'completed'
  | 'failed'
  | 'missed';

// Labels de sentimento
export type SentimentLabel = 'positive' | 'neutral' | 'negative';

// Dados de emoção
export interface EmotionData {
  primary_emotion?: string;
  emotion_scores?: Record<string, number>;
  key_moments?: EmotionMoment[];
}

export interface EmotionMoment {
  timestamp: number; // segundos
  emotion: string;
  intensity: number; // 0-1
  text?: string;
}

// Log de chamada expandido
export interface WhatsAppCallLog {
  id: string;
  contact_id: string;
  conversation_id: string | null;
  user_id: string;
  call_date: string;
  call_time: string;
  result_id: string | null;
  notes: string | null;
  
  // Novos campos para chamadas WhatsApp
  channel_id: string | null;
  call_type: CallType;
  whatsapp_call_id: string | null;
  direction: CallDirection;
  call_status: WhatsAppCallStatus | null;
  duration_seconds: number | null;
  start_time: string | null;
  end_time: string | null;
  error_code: string | null;
  
  // Gravação e Transcrição
  recording_url: string | null;
  recording_storage_path: string | null;
  transcription: string | null;
  transcription_language: string | null;
  
  // Análise de Sentimento
  sentiment_score: number | null;
  sentiment_label: SentimentLabel | null;
  emotion_data: EmotionData | null;
  
  // VoIP
  voip_provider: VoIPProvider | null;
  voip_call_id: string | null;
  
  tenant_id: string;
  created_at: string;
  updated_at: string;
  
  // Relacionamentos
  result?: {
    id: string;
    name: string;
    color: string;
    icon: string;
  };
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
  contact?: {
    id: string;
    full_name: string;
    phone: string;
  };
  channel?: {
    id: string;
    name: string;
    phone: string;
  };
}

// =====================================================
// WEBHOOKS CLOUD API
// =====================================================

// Tipos de evento de webhook
export type CloudAPIWebhookEventType = 
  | 'message'
  | 'message_status'
  | 'call'
  | 'call_status'
  | 'template_status';

// Log de webhook
export interface CloudAPIWebhookLog {
  id: string;
  tenant_id: string | null;
  channel_id: string | null;
  config_id: string | null;
  event_type: CloudAPIWebhookEventType;
  message_id: string | null;
  phone_number: string | null;
  payload: Record<string, unknown>;
  processed: boolean;
  processing_error: string | null;
  created_at: string;
}

// =====================================================
// PAYLOADS CLOUD API
// =====================================================

// Iniciar chamada
export interface InitiateCallPayload {
  channel_id: string;
  to: string; // Número de telefone formatado
}

export interface InitiateCallResponse {
  success: boolean;
  call_id?: string;
  error?: string;
}

// Enviar mensagem via Cloud API
export interface CloudAPISendMessagePayload {
  channel_id: string;
  to: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'template';
  content?: string;
  media_url?: string;
  caption?: string;
  template_name?: string;
  template_params?: string[];
}

export interface CloudAPISendMessageResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}

// =====================================================
// ESTATÍSTICAS DE CHAMADAS
// =====================================================

export interface CallStats {
  total_calls: number;
  answered_calls: number;
  missed_calls: number;
  average_duration_seconds: number;
  total_duration_seconds: number;
  answer_rate: number;
  
  // Por sentimento
  positive_calls: number;
  neutral_calls: number;
  negative_calls: number;
  
  // Por período
  calls_today: number;
  calls_this_week: number;
  calls_this_month: number;
}

export interface CallStatsFilters {
  start_date?: string;
  end_date?: string;
  user_id?: string;
  channel_id?: string;
  call_type?: CallType;
  direction?: CallDirection;
  sentiment_label?: SentimentLabel;
}
