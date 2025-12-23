-- 1. Função para buscar módulos do tenant
CREATE OR REPLACE FUNCTION get_tenant_modules(p_tenant_id uuid)
RETURNS TABLE(module_key text, is_enabled boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT module_key::text, is_enabled 
  FROM tenant_modules 
  WHERE tenant_id = p_tenant_id
  ORDER BY module_key;
$$;

-- 2. Função para atualizar módulos do tenant
CREATE OR REPLACE FUNCTION update_tenant_modules(p_tenant_id uuid, p_modules text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se é super admin
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin privileges required';
  END IF;

  -- Desabilitar todos os módulos primeiro
  UPDATE tenant_modules SET is_enabled = false WHERE tenant_id = p_tenant_id;
  
  -- Habilitar os módulos selecionados
  UPDATE tenant_modules 
  SET is_enabled = true 
  WHERE tenant_id = p_tenant_id 
  AND module_key = ANY(p_modules);
END;
$$;

-- 3. Função para buscar admin do tenant
CREATE OR REPLACE FUNCTION get_tenant_admin(p_tenant_id uuid)
RETURNS TABLE(id uuid, full_name text, email text, role text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name::text, p.email::text, p.role::text
  FROM profiles p
  WHERE p.tenant_id = p_tenant_id AND p.role = 'admin'
  LIMIT 1;
$$;