-- Add column to track if last message is from agent
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_is_from_me boolean DEFAULT null;

-- Create function to update last_message_is_from_me
CREATE OR REPLACE FUNCTION update_last_message_is_from_me()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations 
  SET last_message_is_from_me = NEW.is_from_me,
      updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for automatic updates
DROP TRIGGER IF EXISTS trigger_update_last_message_is_from_me ON messages;
CREATE TRIGGER trigger_update_last_message_is_from_me
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_last_message_is_from_me();

-- Populate existing data based on the most recent message per conversation
UPDATE conversations c
SET last_message_is_from_me = subq.is_from_me
FROM (
  SELECT DISTINCT ON (conversation_id) 
    conversation_id, 
    is_from_me
  FROM messages
  WHERE is_deleted = false OR is_deleted IS NULL
  ORDER BY conversation_id, created_at DESC
) subq
WHERE c.id = subq.conversation_id;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_is_from_me 
ON conversations(last_message_is_from_me) 
WHERE status IN ('open', 'pending');