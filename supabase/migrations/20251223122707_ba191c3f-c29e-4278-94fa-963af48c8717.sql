-- Criar índice único para evitar duplicação de roles por tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_definitions_tenant_role_key 
ON role_definitions(tenant_id, role_key);