-- 1. Alterar DEFAULTs das tabelas para usar get_user_tenant_id()
ALTER TABLE flow_connections 
ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

ALTER TABLE flow_executions 
ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

ALTER TABLE flow_execution_logs 
ALTER COLUMN tenant_id SET DEFAULT get_user_tenant_id();

-- 2. Corrigir conexões existentes com tenant_id errado
-- Sincroniza todas as conexões para usar o tenant_id do fluxo pai
UPDATE flow_connections c
SET tenant_id = f.tenant_id
FROM chatbot_flows f
WHERE c.flow_id = f.id
  AND c.tenant_id != f.tenant_id;

-- 3. Corrigir execuções existentes com tenant_id errado
UPDATE flow_executions e
SET tenant_id = f.tenant_id
FROM chatbot_flows f
WHERE e.flow_id = f.id
  AND e.tenant_id != f.tenant_id;

-- 4. Corrigir logs de execução existentes com tenant_id errado
UPDATE flow_execution_logs l
SET tenant_id = e.tenant_id
FROM flow_executions e
WHERE l.execution_id = e.id
  AND l.tenant_id != e.tenant_id;