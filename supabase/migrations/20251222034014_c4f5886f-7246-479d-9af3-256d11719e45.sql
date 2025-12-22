-- Add gamification_source column to company_settings
-- 'crm' = uses contacts.negotiated_value with conversion statuses
-- 'erp' = uses orders.total for order_type = 'order'
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS gamification_source text DEFAULT 'crm';

-- Add comment for documentation
COMMENT ON COLUMN public.company_settings.gamification_source IS 'Source for gamification data: crm (contacts) or erp (orders)';