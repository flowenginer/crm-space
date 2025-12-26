-- Adicionar coluna is_shared na tabela whatsapp_providers
-- Quando is_shared=true, o admin_token é lido de Supabase Secrets

ALTER TABLE whatsapp_providers 
ADD COLUMN IF NOT EXISTS is_shared boolean DEFAULT false;

-- Comentário explicativo
COMMENT ON COLUMN whatsapp_providers.is_shared IS 
'Quando true, admin_token é lido de Supabase Secrets (UAZAPI_ADMIN_TOKEN, EVOLUTION_API_KEY) ao invés do banco de dados';