
-- Migrar conversas de canais deletados para o canal ativo
UPDATE conversations 
SET channel_id = 'a45dabe1-83d2-468d-9f84-138e2f11d347'
WHERE channel_id IN (
  SELECT id FROM whatsapp_channels WHERE is_deleted = true
);
