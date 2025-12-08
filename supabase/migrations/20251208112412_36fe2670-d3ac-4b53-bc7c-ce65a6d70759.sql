-- Atualizar conversas existentes que estão 'open' sem atendente para 'pending'
UPDATE conversations 
SET status = 'pending', updated_at = NOW()
WHERE status = 'open' 
  AND assigned_to IS NULL;