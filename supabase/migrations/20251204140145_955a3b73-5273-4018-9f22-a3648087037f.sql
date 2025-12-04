-- Deletar mensagens de conversas com contatos de grupo
DELETE FROM messages WHERE conversation_id IN (
  SELECT c.id FROM conversations c
  JOIN contacts ct ON c.contact_id = ct.id
  WHERE ct.phone LIKE '120363%'
);

-- Deletar conversas com contatos de grupo
DELETE FROM conversations WHERE contact_id IN (
  SELECT id FROM contacts WHERE phone LIKE '120363%'
);

-- Deletar contatos de grupo
DELETE FROM contacts WHERE phone LIKE '120363%';