-- Migração de conversas dos canais Evolution deletados para os novos canais UAZAPI
-- Total estimado: 3.903 conversas

-- VENDAS 03: 848 conversas (5521986725044)
UPDATE conversations 
SET channel_id = '469749a8-7a42-4ff6-ab31-ba4d34f7c4cd'
WHERE channel_id = '8be00605-9a83-435d-b3e4-7a5614efc4d1';

-- VENDAS 05: 1.031 conversas (5521965716055)
UPDATE conversations 
SET channel_id = 'ad31e1f0-9a0f-4438-a0c6-aac8ded7227b'
WHERE channel_id = '1fc71b52-4ec3-4b4f-88bf-9e9b18e36bcb';

-- VENDAS 06: 673 conversas (5521993569408)
UPDATE conversations 
SET channel_id = 'b76197f6-992b-4f40-b8c3-54d495d77fda'
WHERE channel_id = '364cf304-9811-4fbe-9d67-ed3232a9d648';

-- VENDAS 07: 743 conversas (5521976270778)
UPDATE conversations 
SET channel_id = '66e56274-fe22-4ff5-8115-c049fdce10e3'
WHERE channel_id = 'a45dabe1-83d2-468d-9f84-138e2f11d347';

-- VENDAS 08: 608 conversas (5521998186919)
UPDATE conversations 
SET channel_id = '8e77aac6-0943-4895-a01a-f8f14477aebd'
WHERE channel_id = '4626cc3d-980f-4a1f-9650-92ec16e4fe5d';