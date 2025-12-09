-- Recalcular last_message_preview, last_message_is_from_me e last_message_at para todas as conversas
-- baseado na mensagem mais recente
UPDATE conversations c
SET 
  last_message_preview = LEFT(subq.content, 100),
  last_message_is_from_me = subq.is_from_me,
  last_message_at = subq.created_at
FROM (
  SELECT DISTINCT ON (conversation_id) 
    conversation_id, 
    COALESCE(content, 
      CASE message_type 
        WHEN 'image' THEN '📷 Imagem'
        WHEN 'audio' THEN '🎵 Áudio'
        WHEN 'video' THEN '🎬 Vídeo'
        WHEN 'document' THEN '📄 Documento'
        ELSE 'Mensagem'
      END
    ) as content, 
    is_from_me, 
    created_at
  FROM messages 
  WHERE (is_deleted = false OR is_deleted IS NULL)
  ORDER BY conversation_id, created_at DESC
) subq
WHERE c.id = subq.conversation_id;