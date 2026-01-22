-- Add audio_first column to message_templates
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS audio_first BOOLEAN DEFAULT false;