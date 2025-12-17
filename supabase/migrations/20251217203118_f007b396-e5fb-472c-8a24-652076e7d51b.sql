-- Fix historical data - populate first_response_at for existing conversations
WITH first_responses AS (
  SELECT DISTINCT ON (conversation_id)
    conversation_id,
    created_at as first_response_time
  FROM messages
  WHERE is_from_me = true
    AND is_deleted = false
  ORDER BY conversation_id, created_at ASC
)
UPDATE conversations c
SET first_response_at = fr.first_response_time
FROM first_responses fr
WHERE c.id = fr.conversation_id
  AND c.first_response_at IS NULL;