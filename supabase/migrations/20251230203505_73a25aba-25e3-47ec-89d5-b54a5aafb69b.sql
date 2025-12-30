-- Merge de contatos duplicados: Lead 1238 + Eduh Soluções
-- Contato principal (manter): e7ce67ce-8b95-4b6b-b120-3ed2f2a145f2 (Lead 1238 - tem UTMs e tags)
-- Contato duplicado (remover): 9e72beb6-cc6d-4e86-9ff3-98e2fd3960e9 (Eduh Soluções - tem mensagens)

-- 1. Mover mensagens para o contato principal
UPDATE messages 
SET contact_id = 'e7ce67ce-8b95-4b6b-b120-3ed2f2a145f2'
WHERE contact_id = '9e72beb6-cc6d-4e86-9ff3-98e2fd3960e9';

-- 2. Mover conversas para o contato principal
UPDATE conversations 
SET contact_id = 'e7ce67ce-8b95-4b6b-b120-3ed2f2a145f2'
WHERE contact_id = '9e72beb6-cc6d-4e86-9ff3-98e2fd3960e9';

-- 3. Atualizar nome do contato principal com o nome real
UPDATE contacts 
SET full_name = 'Eduh Soluções',
    updated_at = NOW()
WHERE id = 'e7ce67ce-8b95-4b6b-b120-3ed2f2a145f2';

-- 4. Deletar o contato duplicado
DELETE FROM contacts 
WHERE id = '9e72beb6-cc6d-4e86-9ff3-98e2fd3960e9';