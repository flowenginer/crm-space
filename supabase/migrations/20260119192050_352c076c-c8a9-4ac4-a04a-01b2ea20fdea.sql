-- Drop the existing constraint
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- Recreate with 'contacts' included
ALTER TABLE public.messages ADD CONSTRAINT messages_message_type_check 
CHECK (message_type = ANY (ARRAY['text'::text, 'audio'::text, 'image'::text, 'video'::text, 'document'::text, 'sticker'::text, 'location'::text, 'template'::text, 'button'::text, 'interactive'::text, 'contacts'::text]));