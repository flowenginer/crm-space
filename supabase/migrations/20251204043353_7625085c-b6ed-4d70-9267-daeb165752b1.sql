-- Add message_type column to scheduled_messages if not exists
ALTER TABLE public.scheduled_messages 
ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text';