
-- Fase 1: Migrar referral_data das conversas VENDAS 03 vazias para as conversas destino com mensagens
WITH pares_para_migrar AS (
  SELECT 
    v03.id as conv_origem,
    v03.referral_data,
    v03.referral_source,
    c_dest.id as conv_destino
  FROM conversations v03
  INNER JOIN conversations c_dest ON c_dest.contact_id = v03.contact_id AND c_dest.id != v03.id
  WHERE v03.channel_id = '8be00605-9a83-435d-b3e4-7a5614efc4d1'
    AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = v03.id)
    AND v03.referral_data IS NOT NULL
    AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c_dest.id)
    AND c_dest.referral_data IS NULL
)
UPDATE conversations c
SET 
  referral_data = p.referral_data,
  referral_source = COALESCE(p.referral_source, 'meta_ads'),
  updated_at = NOW()
FROM pares_para_migrar p
WHERE c.id = p.conv_destino;

-- Fase 2: Deletar conversas vazias do VENDAS 03 que têm duplicata com mensagens
DELETE FROM conversations
WHERE channel_id = '8be00605-9a83-435d-b3e4-7a5614efc4d1'
  AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = conversations.id)
  AND EXISTS (
    SELECT 1 FROM conversations c2 
    WHERE c2.contact_id = conversations.contact_id 
      AND c2.id != conversations.id
      AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c2.id)
  );
