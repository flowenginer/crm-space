-- Remove a política RESTRICTIVE existente que bloqueia templates de sistema
DROP POLICY IF EXISTS "Tenant isolation for flow_node_templates" ON flow_node_templates;

-- Criar nova política PERMISSIVA que permite:
-- 1. Templates do sistema (is_system = true) OU
-- 2. Templates do próprio tenant
CREATE POLICY "authenticated_access_flow_node_templates" 
ON flow_node_templates 
FOR SELECT 
TO authenticated 
USING (
  is_system = true 
  OR tenant_id = get_user_tenant_id()
);