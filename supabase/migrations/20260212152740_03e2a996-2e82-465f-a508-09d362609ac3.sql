
-- Etapa 1: Atualizar nomes dos contatos mantidos
UPDATE contacts SET full_name = 'CLEITON SANTOS DE LIMA / OS GURI DO AGRO' WHERE id = '8b0e39e9-3474-4d7b-945c-5751d1dc0791';
UPDATE contacts SET full_name = 'LEONARDO COELHO DOS SANTOS MACHADO' WHERE id = '1408c6c2-c929-4809-83ef-674094ff9dba';
UPDATE contacts SET full_name = 'FLÁVIO DA COSTA SILVEIRA / FLÁVIO SILVEIRA ROCK & BIKERS' WHERE id = '7925fd15-e45e-4a0c-8dbe-6260d111ae63';
UPDATE contacts SET full_name = 'RODRIGO / GELA MAIS' WHERE id = '57f8a5db-d10e-4aa3-8c48-3a98cdab2c0a';

-- Etapa 2: Transferir conversa do Leonardo (do duplicado para o principal)
UPDATE conversations SET contact_id = '1408c6c2-c929-4809-83ef-674094ff9dba' WHERE contact_id = '92eb21be-0f62-49cb-a218-e0352fc62131';

-- Etapa 3: Transferir tags dos duplicados (se houver)
UPDATE contact_tags SET contact_id = '8b0e39e9-3474-4d7b-945c-5751d1dc0791' WHERE contact_id = '2be14f8d-3650-4349-b17b-3f418c2ecf54' AND NOT EXISTS (SELECT 1 FROM contact_tags ct2 WHERE ct2.contact_id = '8b0e39e9-3474-4d7b-945c-5751d1dc0791' AND ct2.tag_id = contact_tags.tag_id);
UPDATE contact_tags SET contact_id = '1408c6c2-c929-4809-83ef-674094ff9dba' WHERE contact_id = '92eb21be-0f62-49cb-a218-e0352fc62131' AND NOT EXISTS (SELECT 1 FROM contact_tags ct2 WHERE ct2.contact_id = '1408c6c2-c929-4809-83ef-674094ff9dba' AND ct2.tag_id = contact_tags.tag_id);
UPDATE contact_tags SET contact_id = '7925fd15-e45e-4a0c-8dbe-6260d111ae63' WHERE contact_id = 'f73a6d01-e1e4-456f-bf9c-af0500175c80' AND NOT EXISTS (SELECT 1 FROM contact_tags ct2 WHERE ct2.contact_id = '7925fd15-e45e-4a0c-8dbe-6260d111ae63' AND ct2.tag_id = contact_tags.tag_id);
UPDATE contact_tags SET contact_id = '57f8a5db-d10e-4aa3-8c48-3a98cdab2c0a' WHERE contact_id = '8622635b-2c7c-4f3b-9639-63ba718fb7a1' AND NOT EXISTS (SELECT 1 FROM contact_tags ct2 WHERE ct2.contact_id = '57f8a5db-d10e-4aa3-8c48-3a98cdab2c0a' AND ct2.tag_id = contact_tags.tag_id);

-- Limpar tags restantes dos duplicados
DELETE FROM contact_tags WHERE contact_id IN ('2be14f8d-3650-4349-b17b-3f418c2ecf54', '92eb21be-0f62-49cb-a218-e0352fc62131', 'f73a6d01-e1e4-456f-bf9c-af0500175c80', '8622635b-2c7c-4f3b-9639-63ba718fb7a1');

-- Etapa 4: Excluir os 4 contatos duplicados
DELETE FROM contacts WHERE id IN ('2be14f8d-3650-4349-b17b-3f418c2ecf54', '92eb21be-0f62-49cb-a218-e0352fc62131', 'f73a6d01-e1e4-456f-bf9c-af0500175c80', '8622635b-2c7c-4f3b-9639-63ba718fb7a1');
