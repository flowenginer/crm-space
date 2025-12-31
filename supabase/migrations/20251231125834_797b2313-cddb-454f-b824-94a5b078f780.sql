-- =============================================================================
-- MERGE DO PABLO + LIMPEZA EM MASSA DE DUPLICATAS (12 vs 13 dígitos)
-- =============================================================================

-- PARTE 1: Merge imediato do Pablo
-- Contato correto: 5ba5dac7-c91a-4fc3-ac42-dcb83b85f5a9 (5535998196063 - 13 dígitos)
-- Contato duplicado: a5547405-8267-4064-b422-75197ce3da29 (553598196063 - 12 dígitos)
-- Conversa correta: 2f44f421-f6f3-41f8-9816-68f876b62afc
-- Conversa duplicada: 7c530dad-3d1d-4c68-a517-ae64c5c70791

-- 1.1 Mover mensagens da conversa duplicada para a correta
UPDATE messages 
SET conversation_id = '2f44f421-f6f3-41f8-9816-68f876b62afc'
WHERE conversation_id = '7c530dad-3d1d-4c68-a517-ae64c5c70791';

-- 1.2 Atualizar lead_status e status da conversa correta
UPDATE conversations 
SET lead_status = '03 - Catálogo',
    status = 'open',
    last_message_at = (SELECT MAX(created_at) FROM messages WHERE conversation_id = '2f44f421-f6f3-41f8-9816-68f876b62afc')
WHERE id = '2f44f421-f6f3-41f8-9816-68f876b62afc';

-- 1.3 Transferir tags do contato duplicado para o correto
INSERT INTO contact_tags (contact_id, tag_id, tenant_id, created_at)
SELECT 
  '5ba5dac7-c91a-4fc3-ac42-dcb83b85f5a9',
  tag_id,
  tenant_id,
  created_at
FROM contact_tags
WHERE contact_id = 'a5547405-8267-4064-b422-75197ce3da29'
ON CONFLICT (contact_id, tag_id) DO NOTHING;

-- 1.4 Deletar tags do contato duplicado
DELETE FROM contact_tags 
WHERE contact_id = 'a5547405-8267-4064-b422-75197ce3da29';

-- 1.5 Deletar conversa duplicada
DELETE FROM conversations 
WHERE id = '7c530dad-3d1d-4c68-a517-ae64c5c70791';

-- 1.6 Deletar contato duplicado
DELETE FROM contacts 
WHERE id = 'a5547405-8267-4064-b422-75197ce3da29';

-- =============================================================================
-- PARTE 2: Limpeza em massa das 226 duplicatas restantes
-- =============================================================================

-- Criar tabela temporária para armazenar os pares de duplicatas
CREATE TEMP TABLE duplicate_pairs AS
WITH phone_base AS (
  SELECT 
    id,
    full_name,
    phone,
    tenant_id,
    LENGTH(REGEXP_REPLACE(phone, '\D', '', 'g')) as phone_length,
    REGEXP_REPLACE(phone, '\D', '', 'g') as clean_phone
  FROM contacts
  WHERE phone IS NOT NULL
),
-- Encontrar pares onde um tem 12 dígitos e outro tem 13 (diferença do 9º dígito)
pairs AS (
  SELECT 
    c13.id as keep_id,
    c13.full_name as keep_name,
    c13.phone as keep_phone,
    c13.tenant_id,
    c12.id as duplicate_id,
    c12.full_name as duplicate_name,
    c12.phone as duplicate_phone
  FROM phone_base c13
  JOIN phone_base c12 ON c13.tenant_id = c12.tenant_id
    AND c13.phone_length = 13
    AND c12.phone_length = 12
    -- O telefone 12 dígitos é igual ao 13 removendo o 5º dígito (o 9)
    AND (
      SUBSTRING(c12.clean_phone, 1, 4) = SUBSTRING(c13.clean_phone, 1, 4)
      AND SUBSTRING(c12.clean_phone, 5) = SUBSTRING(c13.clean_phone, 6)
    )
  WHERE c13.id != c12.id
)
SELECT * FROM pairs;

-- 2.1 Mover mensagens de conversas duplicadas para conversas corretas
UPDATE messages m
SET conversation_id = conv_keep.id
FROM duplicate_pairs dp
JOIN conversations conv_dup ON conv_dup.contact_id = dp.duplicate_id
JOIN conversations conv_keep ON conv_keep.contact_id = dp.keep_id 
  AND conv_keep.tenant_id = dp.tenant_id
  AND conv_keep.channel_id = conv_dup.channel_id
WHERE m.conversation_id = conv_dup.id;

-- 2.2 Transferir tags dos contatos duplicados para os corretos
INSERT INTO contact_tags (contact_id, tag_id, tenant_id, created_at)
SELECT 
  dp.keep_id,
  ct.tag_id,
  ct.tenant_id,
  ct.created_at
FROM duplicate_pairs dp
JOIN contact_tags ct ON ct.contact_id = dp.duplicate_id
ON CONFLICT (contact_id, tag_id) DO NOTHING;

-- 2.3 Atualizar lead_status das conversas corretas (manter o mais avançado)
UPDATE conversations conv_keep
SET 
  lead_status = COALESCE(
    CASE 
      WHEN conv_dup.lead_status > COALESCE(conv_keep.lead_status, '') THEN conv_dup.lead_status
      ELSE conv_keep.lead_status
    END,
    conv_dup.lead_status,
    conv_keep.lead_status
  ),
  status = CASE 
    WHEN conv_dup.status = 'open' THEN 'open'
    ELSE conv_keep.status
  END,
  last_message_at = GREATEST(COALESCE(conv_keep.last_message_at, '1970-01-01'), COALESCE(conv_dup.last_message_at, '1970-01-01'))
FROM duplicate_pairs dp
JOIN conversations conv_dup ON conv_dup.contact_id = dp.duplicate_id
WHERE conv_keep.contact_id = dp.keep_id 
  AND conv_keep.tenant_id = dp.tenant_id
  AND conv_keep.channel_id = conv_dup.channel_id;

-- 2.4 Deletar tags dos contatos duplicados
DELETE FROM contact_tags 
WHERE contact_id IN (SELECT duplicate_id FROM duplicate_pairs);

-- 2.5 Deletar conversas duplicadas
DELETE FROM conversations 
WHERE contact_id IN (SELECT duplicate_id FROM duplicate_pairs);

-- 2.6 Deletar contatos duplicados
DELETE FROM contacts 
WHERE id IN (SELECT duplicate_id FROM duplicate_pairs);

-- Dropar tabela temporária
DROP TABLE duplicate_pairs;