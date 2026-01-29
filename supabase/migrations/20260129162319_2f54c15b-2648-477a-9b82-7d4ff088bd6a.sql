-- Corrigir política da tabela user_roles que usa subconsulta via profiles
ALTER POLICY "Tenant isolation for user_roles" ON user_roles 
WITH CHECK (EXISTS (
  SELECT 1 FROM profiles p 
  WHERE p.id = user_roles.user_id 
  AND p.tenant_id = get_user_tenant_id()
));