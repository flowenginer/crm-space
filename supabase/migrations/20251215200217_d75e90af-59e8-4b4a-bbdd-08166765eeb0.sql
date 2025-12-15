-- Add shipping_config column to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS shipping_config jsonb DEFAULT NULL;