-- =====================================================
-- TABELA: PROVEDORES DE WHATSAPP
-- =====================================================
CREATE TABLE IF NOT EXISTS whatsapp_providers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  base_url TEXT NOT NULL,
  api_key TEXT,
  api_secret TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ADICIONAR COLUNAS À TABELA whatsapp_channels
-- =====================================================
ALTER TABLE whatsapp_channels 
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES whatsapp_providers(id),
  ADD COLUMN IF NOT EXISTS instance_id TEXT,
  ADD COLUMN IF NOT EXISTS instance_token TEXT,
  ADD COLUMN IF NOT EXISTS webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS session_data JSONB DEFAULT '{}';

-- =====================================================
-- TABELA: LOGS DE WEBHOOK (para debug)
-- =====================================================
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  instance_id TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider ON webhook_logs(provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_unprocessed ON webhook_logs(processed) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_channels_instance ON whatsapp_channels(instance_id);
CREATE INDEX IF NOT EXISTS idx_channels_provider ON whatsapp_channels(provider_id);

-- =====================================================
-- SEED: CADASTRAR OS 3 PROVEDORES
-- =====================================================
INSERT INTO whatsapp_providers (name, code, base_url) VALUES
  ('Z-API', 'zapi', 'https://api.z-api.io'),
  ('UAZAPI', 'uazapi', 'https://api.uazapi.com'),
  ('Evolution API', 'evolution', 'http://localhost:8080')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  base_url = EXCLUDED.base_url;

-- =====================================================
-- RLS para novas tabelas
-- =====================================================
ALTER TABLE whatsapp_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access whatsapp_providers" ON whatsapp_providers
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated access webhook_logs" ON webhook_logs
  FOR ALL USING (auth.uid() IS NOT NULL);

-- =====================================================
-- FUNCTION: Incrementar contagem de não lidas
-- =====================================================
CREATE OR REPLACE FUNCTION increment_unread(conv_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE conversations
  SET 
    unread_count = unread_count + 1,
    is_unread = true,
    updated_at = NOW()
  WHERE id = conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;