-- Atualiza mensagens de permissão de chamada que foram salvas incorretamente como [Interativo]
UPDATE messages 
SET content = '✅ Permissão de chamada concedida'
WHERE message_type = 'interactive' 
AND content = '[Interativo]'
AND conversation_id IN (
  SELECT id FROM conversations 
  WHERE contact_id IN (
    SELECT id FROM contacts 
    WHERE call_permission_status = 'granted'
  )
);