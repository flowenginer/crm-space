-- Add column for distributing to offline agents
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS lead_distribution_include_offline BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.company_settings.lead_distribution_include_offline IS 'When true, leads will be distributed to offline agents with status pending';