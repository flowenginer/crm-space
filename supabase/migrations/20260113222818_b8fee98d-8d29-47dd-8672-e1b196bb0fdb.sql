ALTER TABLE bulk_dispatches 
DROP CONSTRAINT IF EXISTS bulk_dispatches_campaign_type_check;

ALTER TABLE bulk_dispatches
ADD CONSTRAINT bulk_dispatches_campaign_type_check 
CHECK (campaign_type = ANY (ARRAY['followup'::text, 'marketing'::text, 'template_meta'::text]));