-- Adicionar modo de distribuição na tabela de campanhas
ALTER TABLE redirect_campaigns 
ADD COLUMN IF NOT EXISTS distribution_mode TEXT DEFAULT 'equal';

-- Adicionar porcentagem na tabela de canais da campanha
ALTER TABLE redirect_campaign_channels 
ADD COLUMN IF NOT EXISTS percentage INTEGER DEFAULT 0;

-- Comentário para documentação
COMMENT ON COLUMN redirect_campaigns.distribution_mode IS 'Modo de distribuição: equal (round-robin) ou percentage (por porcentagem)';
COMMENT ON COLUMN redirect_campaign_channels.percentage IS 'Porcentagem de leads para este canal (0-100), usado quando distribution_mode = percentage';