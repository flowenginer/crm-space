-- 1. Fechar conversas duplicadas no canal antigo (que já existem no canal novo)
UPDATE conversations 
SET status = 'closed', 
    closed_at = NOW(),
    close_reason = 'Canal duplicado - migrado para canal principal'
WHERE channel_id = 'd0a3ef39-17b6-4235-acd7-4d97cf043096'
  AND contact_id IN (
    SELECT old.contact_id 
    FROM conversations old
    JOIN conversations new ON old.contact_id = new.contact_id
    WHERE old.channel_id = 'd0a3ef39-17b6-4235-acd7-4d97cf043096'
      AND new.channel_id = '90296d9b-ffa5-4fab-a311-75d7ce9a388a'
  );

-- 2. Migrar conversas que NÃO têm conflito para o canal novo
UPDATE conversations 
SET channel_id = '90296d9b-ffa5-4fab-a311-75d7ce9a388a'
WHERE channel_id = 'd0a3ef39-17b6-4235-acd7-4d97cf043096'
  AND contact_id NOT IN (
    SELECT contact_id FROM conversations 
    WHERE channel_id = '90296d9b-ffa5-4fab-a311-75d7ce9a388a'
  );

-- 3. Arquivar canal antigo duplicado
UPDATE whatsapp_channels 
SET is_deleted = true, deleted_at = NOW()
WHERE id = 'd0a3ef39-17b6-4235-acd7-4d97cf043096';