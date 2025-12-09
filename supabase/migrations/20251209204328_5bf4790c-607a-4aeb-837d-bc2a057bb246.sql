-- Corrigir a conversa da Cristiane Araújo que foi atribuída manualmente mas ficou com status pending
UPDATE conversations 
SET 
  status = 'open',
  is_new_transfer = true,
  updated_at = now()
WHERE id = 'ba7ac38e-85f5-4031-8ec3-5a19ec36400a';