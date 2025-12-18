-- Deletar as mensagens das conversas duplicadas
DELETE FROM messages 
WHERE conversation_id IN (
  SELECT conv.id 
  FROM conversations conv 
  JOIN contacts c ON conv.contact_id = c.id 
  WHERE c.phone = '5521976052644'
);

-- Deletar as conversas duplicadas
DELETE FROM conversations 
WHERE contact_id IN (
  SELECT id FROM contacts WHERE phone = '5521976052644'
);

-- Deletar o contato duplicado (VENDAS 02 com número do canal)
DELETE FROM contacts WHERE phone = '5521976052644';