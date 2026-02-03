-- Corrigir o DEFAULT da coluna tenant_id na tabela scheduled_messages
-- para usar a função get_user_tenant_id() ao invés de um UUID fixo
ALTER TABLE scheduled_messages 
ALTER COLUMN tenant_id 
SET DEFAULT get_user_tenant_id();