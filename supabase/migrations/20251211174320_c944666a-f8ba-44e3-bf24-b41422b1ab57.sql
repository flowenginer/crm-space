-- Add lead distribution configuration columns to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS lead_distribution_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lead_distribution_type TEXT DEFAULT 'sequential',
ADD COLUMN IF NOT EXISTS lead_distribution_department_id UUID REFERENCES public.departments(id),
ADD COLUMN IF NOT EXISTS lead_distribution_position INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS lead_distribution_agents JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.company_settings.lead_distribution_enabled IS 'Whether automatic lead distribution is enabled';
COMMENT ON COLUMN public.company_settings.lead_distribution_type IS 'Distribution type: sequential (round-robin) or percentage';
COMMENT ON COLUMN public.company_settings.lead_distribution_department_id IS 'Department from which agents are selected for distribution';
COMMENT ON COLUMN public.company_settings.lead_distribution_position IS 'Current position in round-robin queue';
COMMENT ON COLUMN public.company_settings.lead_distribution_agents IS 'Array of agent configurations: [{user_id, percentage, order_position, is_active}]';