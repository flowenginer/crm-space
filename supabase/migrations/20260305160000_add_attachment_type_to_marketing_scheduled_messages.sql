-- Add attachment_type and attachment_name columns to marketing_scheduled_messages
ALTER TABLE public.marketing_scheduled_messages
ADD COLUMN IF NOT EXISTS attachment_type TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT;
