-- Atualizar as 56 conversas existentes que vieram do redirect
-- copiando o department_id do contato para a conversa
UPDATE conversations conv
SET department_id = c.department_id
FROM contacts c
JOIN contact_tags ct ON ct.contact_id = c.id
JOIN tags t ON t.id = ct.tag_id
WHERE conv.contact_id = c.id
  AND t.name = 'PG01'
  AND c.department_id IS NOT NULL
  AND conv.department_id IS NULL;