
-- Recriar o trigger perdido no reset do banco
CREATE TRIGGER trigger_update_last_client_message_at
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_last_client_message_at();

-- Backfill: corrigir last_client_message_at de todas as conversas afetadas
UPDATE conversations c
SET last_client_message_at = (
  SELECT MAX(m.created_at)
  FROM messages m
  WHERE m.conversation_id = c.id
    AND m.is_from_me = false
)
WHERE EXISTS (
  SELECT 1 FROM messages m
  WHERE m.conversation_id = c.id
    AND m.is_from_me = false
);
