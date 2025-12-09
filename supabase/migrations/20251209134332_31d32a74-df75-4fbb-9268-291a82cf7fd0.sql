-- Para cada conversa sem canal que é duplicata, vamos mover as mensagens para a conversa principal (que tem canal)
-- e depois deletar a conversa órfã

-- Primeiro, atualizar as mensagens para apontar para a conversa principal (com canal)
UPDATE messages m
SET conversation_id = (
  SELECT c2.id 
  FROM conversations c2 
  WHERE c2.contact_id = (SELECT contact_id FROM conversations WHERE id = m.conversation_id)
    AND c2.channel_id IS NOT NULL
    AND c2.status IN ('open', 'pending')
  ORDER BY c2.created_at DESC
  LIMIT 1
)
WHERE m.conversation_id IN (
  SELECT id FROM conversations WHERE channel_id IS NULL AND status IN ('open', 'pending')
)
AND EXISTS (
  SELECT 1 FROM conversations c2 
  WHERE c2.contact_id = (SELECT contact_id FROM conversations WHERE id = m.conversation_id)
    AND c2.channel_id IS NOT NULL
    AND c2.status IN ('open', 'pending')
);

-- Mover internal_notes também
UPDATE internal_notes n
SET conversation_id = (
  SELECT c2.id 
  FROM conversations c2 
  WHERE c2.contact_id = (SELECT contact_id FROM conversations WHERE id = n.conversation_id)
    AND c2.channel_id IS NOT NULL
    AND c2.status IN ('open', 'pending')
  ORDER BY c2.created_at DESC
  LIMIT 1
)
WHERE n.conversation_id IN (
  SELECT id FROM conversations WHERE channel_id IS NULL AND status IN ('open', 'pending')
)
AND EXISTS (
  SELECT 1 FROM conversations c2 
  WHERE c2.contact_id = (SELECT contact_id FROM conversations WHERE id = n.conversation_id)
    AND c2.channel_id IS NOT NULL
    AND c2.status IN ('open', 'pending')
);

-- Mover conversation_tags
INSERT INTO conversation_tags (conversation_id, tag_id, created_at)
SELECT 
  (SELECT c2.id FROM conversations c2 
   WHERE c2.contact_id = (SELECT contact_id FROM conversations WHERE id = ct.conversation_id)
     AND c2.channel_id IS NOT NULL
     AND c2.status IN ('open', 'pending')
   ORDER BY c2.created_at DESC LIMIT 1) as conversation_id,
  ct.tag_id,
  ct.created_at
FROM conversation_tags ct
WHERE ct.conversation_id IN (
  SELECT id FROM conversations WHERE channel_id IS NULL AND status IN ('open', 'pending')
)
ON CONFLICT DO NOTHING;

-- Deletar tags das conversas órfãs
DELETE FROM conversation_tags 
WHERE conversation_id IN (
  SELECT id FROM conversations WHERE channel_id IS NULL AND status IN ('open', 'pending')
);

-- Deletar conversation_events das conversas órfãs
DELETE FROM conversation_events 
WHERE conversation_id IN (
  SELECT id FROM conversations WHERE channel_id IS NULL AND status IN ('open', 'pending')
);

-- Deletar as conversas órfãs (duplicatas sem canal)
DELETE FROM conversations 
WHERE channel_id IS NULL AND status IN ('open', 'pending');