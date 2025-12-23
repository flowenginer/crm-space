-- FASE 3: Criar função para diagnóstico de usuários (super admin)
CREATE OR REPLACE FUNCTION public.diagnose_user_tenant(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  full_name TEXT,
  tenant_id UUID,
  tenant_name TEXT,
  tenant_is_active BOOLEAN,
  is_default_tenant BOOLEAN,
  user_role TEXT,
  is_super_admin BOOLEAN,
  conversation_count BIGINT,
  contact_count BIGINT,
  has_issues BOOLEAN,
  issues TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_default_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Verificar se é super admin
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios de super admin necessários';
  END IF;

  RETURN QUERY
  WITH user_data AS (
    SELECT 
      p.id as uid,
      p.email as uemail,
      p.full_name as ufull_name,
      p.tenant_id as utenant_id,
      t.name as utenant_name,
      t.is_active as utenant_is_active,
      p.tenant_id = v_default_tenant_id as uis_default_tenant,
      p.role as urole,
      EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.role = 'super_admin') as uis_super_admin,
      (SELECT COUNT(*) FROM conversations c WHERE c.assigned_to = p.id) as uconversation_count,
      (SELECT COUNT(*) FROM contacts ct WHERE ct.assigned_to = p.id) as ucontact_count
    FROM profiles p
    LEFT JOIN tenants t ON t.id = p.tenant_id
    WHERE p_user_id IS NULL OR p.id = p_user_id
  )
  SELECT 
    ud.uid,
    ud.uemail,
    ud.ufull_name,
    ud.utenant_id,
    ud.utenant_name,
    ud.utenant_is_active,
    ud.uis_default_tenant,
    ud.urole,
    ud.uis_super_admin,
    ud.uconversation_count,
    ud.ucontact_count,
    (
      (ud.uis_default_tenant AND NOT ud.uis_super_admin) OR
      (ud.utenant_is_active = false) OR
      (ud.utenant_name IS NULL)
    ) as has_issues,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN ud.uis_default_tenant AND NOT ud.uis_super_admin THEN 'Usuário no tenant default sem ser super admin' END,
      CASE WHEN ud.utenant_is_active = false THEN 'Tenant desativado' END,
      CASE WHEN ud.utenant_name IS NULL THEN 'Tenant não encontrado' END
    ], NULL) as issues
  FROM user_data ud
  ORDER BY (
    (ud.uis_default_tenant AND NOT ud.uis_super_admin) OR
    (ud.utenant_is_active = false) OR
    (ud.utenant_name IS NULL)
  ) DESC, ud.ufull_name;
END;
$$;

-- Criar função para listar todos os usuários com problemas de tenant
CREATE OR REPLACE FUNCTION public.get_users_with_tenant_issues()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  full_name TEXT,
  tenant_id UUID,
  tenant_name TEXT,
  issue_type TEXT,
  issue_description TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_default_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Verificar se é super admin
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Acesso negado: privilégios de super admin necessários';
  END IF;

  RETURN QUERY
  SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    p.tenant_id,
    t.name as tenant_name,
    CASE 
      WHEN p.tenant_id = v_default_tenant_id AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.role = 'super_admin')
        THEN 'default_tenant'
      WHEN t.is_active = false THEN 'inactive_tenant'
      WHEN t.id IS NULL THEN 'missing_tenant'
    END as issue_type,
    CASE 
      WHEN p.tenant_id = v_default_tenant_id AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.role = 'super_admin')
        THEN 'Usuário atribuído ao tenant default sem ser super admin'
      WHEN t.is_active = false THEN 'Tenant está desativado'
      WHEN t.id IS NULL THEN 'Tenant não existe no sistema'
    END as issue_description
  FROM profiles p
  LEFT JOIN tenants t ON t.id = p.tenant_id
  WHERE 
    (p.tenant_id = v_default_tenant_id AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id AND ur.role = 'super_admin'))
    OR t.is_active = false
    OR t.id IS NULL
  ORDER BY p.full_name;
END;
$$;