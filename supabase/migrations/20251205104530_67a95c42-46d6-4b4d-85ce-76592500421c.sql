-- Adicionar coluna JSONB para armazenar dados de referral nos contatos
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS referral_data JSONB;

-- Adicionar colunas para armazenar dados de referral nas conversas
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS referral_data JSONB;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS referral_source TEXT;

-- Criar índice para filtrar por origem
CREATE INDEX IF NOT EXISTS idx_contacts_origin_campaign ON contacts(origin_campaign) WHERE origin_campaign IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_referral_source ON conversations(referral_source) WHERE referral_source IS NOT NULL;