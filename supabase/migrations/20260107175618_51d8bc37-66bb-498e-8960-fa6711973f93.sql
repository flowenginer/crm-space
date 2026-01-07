-- Add initial_user_id column to marketing_campaigns table
ALTER TABLE marketing_campaigns 
ADD COLUMN initial_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN marketing_campaigns.initial_user_id IS 
  'Usuario para quem a conversa sera transferida automaticamente antes de iniciar a campanha';