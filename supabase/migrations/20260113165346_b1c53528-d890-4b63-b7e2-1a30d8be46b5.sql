-- Add column to track last client message for 24h window calculation
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS last_client_message_at TIMESTAMP WITH TIME ZONE;

-- Create function to update last_client_message_at when client sends message
CREATE OR REPLACE FUNCTION update_last_client_message_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_from_me = false THEN
    UPDATE conversations 
    SET last_client_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic updates
DROP TRIGGER IF EXISTS trigger_update_last_client_message ON messages;
CREATE TRIGGER trigger_update_last_client_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_last_client_message_at();

-- Backfill existing conversations with last client message timestamp
UPDATE conversations c
SET last_client_message_at = (
  SELECT MAX(m.created_at) 
  FROM messages m 
  WHERE m.conversation_id = c.id 
    AND m.is_from_me = false
)
WHERE last_client_message_at IS NULL;