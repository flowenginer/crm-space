-- Mover mensagens da conversa duplicada (Vendas 07) para a conversa correta (VENDAS 03)
UPDATE messages 
SET conversation_id = 'a12e3159-9247-483f-b504-1c42d729723f'
WHERE conversation_id = '56b42bad-08b7-4200-9b50-1d55b2b33ce1';

-- Deletar a conversa duplicada
DELETE FROM conversations 
WHERE id = '56b42bad-08b7-4200-9b50-1d55b2b33ce1';