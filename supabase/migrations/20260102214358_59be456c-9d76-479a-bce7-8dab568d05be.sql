-- =====================================================
-- FASE 1: Migrações para Cloud API + Sistema de Ligações
-- =====================================================

-- 1. Expandir tabela call_logs para suportar chamadas WhatsApp
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS channel_id UUID REFERENCES whatsapp_channels(id);
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_type TEXT DEFAULT 'manual';
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS whatsapp_call_id TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound';
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS call_status TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS error_code TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS recording_storage_path TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS transcription TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS transcription_language TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS sentiment_score DECIMAL;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS sentiment_label TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS emotion_data JSONB;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS voip_provider TEXT;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS voip_call_id TEXT;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_call_logs_channel ON call_logs(channel_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_whatsapp_call ON call_logs(whatsapp_call_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_type ON call_logs(call_type);
CREATE INDEX IF NOT EXISTS idx_call_logs_call_status ON call_logs(call_status);
CREATE INDEX IF NOT EXISTS idx_call_logs_direction ON call_logs(direction);

-- 2. Criar tabela de configuração Cloud API por tenant
CREATE TABLE IF NOT EXISTS cloudapi_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES whatsapp_channels(id) ON DELETE SET NULL,
  
  -- Credenciais Meta
  phone_number_id TEXT NOT NULL,
  waba_id TEXT,
  business_account_id TEXT,
  access_token TEXT NOT NULL,
  verify_token TEXT NOT NULL,
  app_secret TEXT,
  
  -- Configurações
  is_active BOOLEAN DEFAULT true,
  webhook_configured BOOLEAN DEFAULT false,
  api_version TEXT DEFAULT 'v21.0',
  
  -- Calling API
  calling_enabled BOOLEAN DEFAULT false,
  voip_provider TEXT,
  voip_config JSONB DEFAULT '{}',
  
  -- Transcription & Sentiment
  transcription_enabled BOOLEAN DEFAULT false,
  sentiment_analysis_enabled BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(tenant_id, phone_number_id)
);

-- Enable RLS
ALTER TABLE cloudapi_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies usando get_user_tenant_id() que existe
CREATE POLICY "Tenants can view their own cloudapi configs"
ON cloudapi_configs FOR SELECT
USING (tenant_id = (SELECT get_user_tenant_id()));

CREATE POLICY "Tenants can insert their own cloudapi configs"
ON cloudapi_configs FOR INSERT
WITH CHECK (tenant_id = (SELECT get_user_tenant_id()));

CREATE POLICY "Tenants can update their own cloudapi configs"
ON cloudapi_configs FOR UPDATE
USING (tenant_id = (SELECT get_user_tenant_id()));

CREATE POLICY "Tenants can delete their own cloudapi configs"
ON cloudapi_configs FOR DELETE
USING (tenant_id = (SELECT get_user_tenant_id()));

-- 3. Criar tabela de logs de webhook Cloud API
CREATE TABLE IF NOT EXISTS cloudapi_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  channel_id UUID REFERENCES whatsapp_channels(id),
  config_id UUID REFERENCES cloudapi_configs(id),
  event_type TEXT NOT NULL,
  message_id TEXT,
  phone_number TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE cloudapi_webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their webhook logs"
ON cloudapi_webhook_logs FOR SELECT
USING (tenant_id = (SELECT get_user_tenant_id()));

-- Índices para busca
CREATE INDEX IF NOT EXISTS idx_cloudapi_webhook_logs_tenant ON cloudapi_webhook_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cloudapi_webhook_logs_event ON cloudapi_webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_cloudapi_webhook_logs_processed ON cloudapi_webhook_logs(processed);

-- 4. Adicionar provider 'cloudapi' se não existir
INSERT INTO whatsapp_providers (name, code, base_url, is_active, is_shared)
VALUES ('API Oficial (Cloud API)', 'cloudapi', 'https://graph.facebook.com/v21.0', true, true)
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url,
  is_active = EXCLUDED.is_active;

-- 5. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_cloudapi_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_cloudapi_configs_updated_at ON cloudapi_configs;
CREATE TRIGGER update_cloudapi_configs_updated_at
BEFORE UPDATE ON cloudapi_configs
FOR EACH ROW
EXECUTE FUNCTION update_cloudapi_configs_updated_at();