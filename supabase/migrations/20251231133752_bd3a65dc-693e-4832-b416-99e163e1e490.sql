-- Marcar duplicatas como deletadas, mantendo apenas a primeira mensagem de cada grupo
WITH duplicates AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY content, sender_id, thread_id, DATE_TRUNC('minute', created_at)
      ORDER BY created_at ASC
    ) as rn
  FROM internal_chat_messages
  WHERE deleted_at IS NULL
    AND content IS NOT NULL
    AND content != ''
)
UPDATE internal_chat_messages
SET deleted_at = NOW(), is_deleted = true
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);