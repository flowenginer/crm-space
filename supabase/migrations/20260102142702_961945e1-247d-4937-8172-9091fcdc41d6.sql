-- Adicionar política PERMISSIVE para permitir leitura de role_definitions
-- A política RESTRICTIVE existente (Tenant isolation for role_definitions) 
-- já garante que só retorna roles do tenant correto
CREATE POLICY "authenticated_read_own_tenant_roles" ON role_definitions
FOR SELECT
TO authenticated
USING (true);