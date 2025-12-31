-- FASE 1: Corrigir dados do Fagner Silva
-- Contato correto: 811d4561-1288-4961-8e3c-37c7acc46366 (5588999592641)
-- Contato duplicado: 2ec44883-e4ff-4bee-b671-ff0ee43a8275 (558899592641)
-- Conversa correta: 72f3cdb7-e3ca-45ae-b09b-2291d7cabdcb
-- Conversa duplicada: b7fac916-e9ef-4360-8f93-abc24efc5a6e

-- 1.1 Mover mensagens da conversa duplicada para a correta
UPDATE messages 
SET conversation_id = '72f3cdb7-e3ca-45ae-b09b-2291d7cabdcb'
WHERE conversation_id = 'b7fac916-e9ef-4360-8f93-abc24efc5a6e';

-- 1.2 Transferir tags do contato duplicado para o correto
INSERT INTO contact_tags (contact_id, tag_id, tenant_id, created_at)
SELECT 
  '811d4561-1288-4961-8e3c-37c7acc46366',
  tag_id,
  tenant_id,
  created_at
FROM contact_tags
WHERE contact_id = '2ec44883-e4ff-4bee-b671-ff0ee43a8275'
ON CONFLICT (contact_id, tag_id) DO NOTHING;

-- 1.3 Deletar tags do contato duplicado
DELETE FROM contact_tags 
WHERE contact_id = '2ec44883-e4ff-4bee-b671-ff0ee43a8275';

-- 1.4 Deletar conversa duplicada
DELETE FROM conversations 
WHERE id = 'b7fac916-e9ef-4360-8f93-abc24efc5a6e';

-- 1.5 Deletar contato duplicado
DELETE FROM contacts 
WHERE id = '2ec44883-e4ff-4bee-b671-ff0ee43a8275';