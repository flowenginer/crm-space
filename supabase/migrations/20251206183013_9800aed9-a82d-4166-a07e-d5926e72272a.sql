-- Remover a constraint que limita os valores de lead_status
-- Isso permite usar qualquer status definido na tabela lead_statuses
ALTER TABLE public.contacts 
DROP CONSTRAINT IF EXISTS contacts_lead_status_check;