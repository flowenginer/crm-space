-- FASE 1: Mesclar conversa duplicada da Beatriz Milani
-- Mover mensagens da conversa duplicada (Vendas 01) para a correta (VENDAS 03)
UPDATE messages 
SET conversation_id = '5758d5ad-02f4-4447-b094-225807f92c83'
WHERE conversation_id = '89d6100e-9eb7-4ad4-b4c8-93d526923ddc';

-- Deletar a conversa duplicada
DELETE FROM conversations 
WHERE id = '89d6100e-9eb7-4ad4-b4c8-93d526923ddc';

-- FASE 2: Criar conversas para os 54 contatos sem canal
-- Distribuição round-robin entre 7 canais
WITH contacts_without_conv AS (
  SELECT 
    c.id as contact_id,
    c.tenant_id,
    ROW_NUMBER() OVER (ORDER BY c.created_at) as row_num
  FROM contacts c
  INNER JOIN contact_tags ct ON ct.contact_id = c.id
  LEFT JOIN conversations conv ON conv.contact_id = c.id
  WHERE ct.tag_id = '840705a1-ce5b-474f-8b59-5c9a21532999'
    AND conv.id IS NULL
),
channels AS (
  SELECT id, ord FROM (VALUES 
    ('550374b7-6842-48d9-abbd-4d267e1f2977'::uuid, 1),
    ('724d0cc8-1d04-49dc-84da-ac9375ef4e92'::uuid, 2),
    ('469749a8-7a42-4ff6-ab31-ba4d34f7c4cd'::uuid, 3),
    ('ad31e1f0-9a0f-4438-a0c6-aac8ded7227b'::uuid, 4),
    ('b76197f6-992b-4f40-b8c3-54d495d77fda'::uuid, 5),
    ('66e56274-fe22-4ff5-8115-c049fdce10e3'::uuid, 6),
    ('8e77aac6-0943-4895-a01a-f8f14477aebd'::uuid, 7)
  ) AS t(id, ord)
)
INSERT INTO conversations (contact_id, tenant_id, channel_id, status, lead_status, created_at)
SELECT 
  cwc.contact_id,
  cwc.tenant_id,
  (SELECT id FROM channels WHERE ord = ((cwc.row_num - 1) % 7) + 1),
  'pending',
  'new',
  now()
FROM contacts_without_conv cwc;

-- FASE 3: Atualizar redirect_logs com o channel_id para esses contatos
UPDATE redirect_logs rl
SET channel_id = conv.channel_id
FROM conversations conv
WHERE conv.contact_id = rl.contact_id
  AND rl.channel_id IS NULL;