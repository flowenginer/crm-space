-- Adicionar campos para configuração global dos provedores
ALTER TABLE whatsapp_providers 
  ADD COLUMN IF NOT EXISTS admin_token TEXT,
  ADD COLUMN IF NOT EXISTS client_token TEXT,
  ADD COLUMN IF NOT EXISTS is_configured BOOLEAN DEFAULT false;

-- Atualizar os provedores existentes
UPDATE whatsapp_providers SET 
  admin_token = NULL,
  client_token = NULL,
  is_configured = false
WHERE admin_token IS NULL;