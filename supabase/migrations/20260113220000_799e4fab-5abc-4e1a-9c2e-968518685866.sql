-- Add columns for Meta template support in bulk dispatches
ALTER TABLE bulk_dispatches 
ADD COLUMN IF NOT EXISTS meta_template_id uuid REFERENCES meta_message_templates(id),
ADD COLUMN IF NOT EXISTS meta_template_variables jsonb DEFAULT '{}';