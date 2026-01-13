-- Drop the existing constraint
ALTER TABLE messages
DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- Add updated constraint that includes 'template'
ALTER TABLE messages
ADD CONSTRAINT messages_message_type_check
CHECK (message_type = ANY (ARRAY[
  'text'::text, 
  'audio'::text, 
  'image'::text, 
  'video'::text, 
  'document'::text, 
  'sticker'::text, 
  'location'::text,
  'template'::text
]));