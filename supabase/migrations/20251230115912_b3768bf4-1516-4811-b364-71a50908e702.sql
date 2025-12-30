-- Add new fields to redirect_campaigns for logo size control, thank you message, and lead destination
ALTER TABLE redirect_campaigns 
ADD COLUMN IF NOT EXISTS logo_size INTEGER DEFAULT 64,
ADD COLUMN IF NOT EXISTS thank_you_message TEXT DEFAULT 'Obrigado! Entraremos em contato em breve.',
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tag_id UUID REFERENCES tags(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON COLUMN redirect_campaigns.logo_size IS 'Logo height in pixels (40-200)';
COMMENT ON COLUMN redirect_campaigns.thank_you_message IS 'Message shown after lead submits phone';
COMMENT ON COLUMN redirect_campaigns.department_id IS 'Department to assign the lead to';
COMMENT ON COLUMN redirect_campaigns.tag_id IS 'Tag to apply to the lead';