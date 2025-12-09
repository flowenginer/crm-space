-- Atribuir canal às conversas FECHADAS sem channel_id (não têm conflito de constraint pois estão fechadas)
UPDATE conversations c
SET channel_id = 'a45dabe1-83d2-468d-9f84-138e2f11d347'
WHERE c.channel_id IS NULL
  AND c.status = 'closed';

-- Para conversas ABERTAS/PENDING sem canal, vamos tentar atribuir um canal que não cause conflito
-- Usamos uma abordagem com ROW_NUMBER para distribuir entre os canais disponíveis

-- Primeiro, atribuir canal a conversas abertas cujo contato NÃO tem nenhuma outra conversa aberta
UPDATE conversations c
SET channel_id = 'a45dabe1-83d2-468d-9f84-138e2f11d347'
WHERE c.channel_id IS NULL
  AND c.status IN ('open', 'pending')
  AND NOT EXISTS (
    SELECT 1 FROM conversations c2 
    WHERE c2.contact_id = c.contact_id 
      AND c2.channel_id IS NOT NULL
      AND c2.status IN ('open', 'pending')
  );