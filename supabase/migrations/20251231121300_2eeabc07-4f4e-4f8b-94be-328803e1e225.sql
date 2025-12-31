-- Add auto_distribute_channels column to redirect_campaigns
ALTER TABLE redirect_campaigns 
ADD COLUMN IF NOT EXISTS auto_distribute_channels boolean DEFAULT true;

COMMENT ON COLUMN redirect_campaigns.auto_distribute_channels IS 
  'Quando true, se não houver canais específicos vinculados, distribui entre todos os canais conectados do tenant';