
-- Deletar mensagens duplicadas que contêm "(arquivo anexado)" mas não têm mídia
-- quando existe uma versão correspondente COM mídia
DELETE FROM messages
WHERE id IN (
  SELECT m1.id
  FROM messages m1
  WHERE m1.conversation_id = 'aed519d5-a565-4c45-b4fc-601b15ce07d5'
    AND m1.content LIKE '%(arquivo anexado)%'
    AND m1.media_url IS NULL
    AND EXISTS (
      SELECT 1 FROM messages m2
      WHERE m2.conversation_id = m1.conversation_id
        AND m2.created_at = m1.created_at
        AND m2.is_from_me = m1.is_from_me
        AND m2.media_url IS NOT NULL
    )
);
