-- Permitir que Super Admins tenham tenant_id NULL
-- Atualizar a função validate_user_tenant para aceitar super admins sem tenant

-- Primeiro, dropar a trigger existente
DROP TRIGGER IF EXISTS validate_user_tenant_trigger ON profiles;

-- Atualizar a função para aceitar tenant_id NULL para super admins
CREATE OR REPLACE FUNCTION validate_user_tenant()
RETURNS TRIGGER AS $$
DECLARE
  v_is_super_admin BOOLEAN := FALSE;
BEGIN
  -- Verificar se o usuário é super admin (via user_roles)
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = NEW.id 
    AND role = 'super_admin'
  ) INTO v_is_super_admin;

  -- Super Admins podem ter tenant_id NULL (operam fora de qualquer tenant)
  IF v_is_super_admin THEN
    RETURN NEW;
  END IF;

  -- Para usuários normais, tenant_id é obrigatório
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Usuários não-super-admin devem ter um tenant_id associado';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar a trigger
CREATE TRIGGER validate_user_tenant_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_tenant();

-- Criar função para verificar se super admin pode acessar dados sem tenant
CREATE OR REPLACE FUNCTION is_super_admin_without_tenant()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM profiles p
    INNER JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.id = auth.uid() 
    AND p.tenant_id IS NULL
    AND ur.role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Atualizar get_user_tenant_id para retornar NULL para super admins sem tenant
-- Usando sintaxe SQL correta
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid()
$$;

-- Comentário explicativo
COMMENT ON FUNCTION validate_user_tenant() IS 
  'Valida tenant_id em profiles. Super Admins podem ter tenant_id NULL para operar no painel da plataforma.';

COMMENT ON FUNCTION is_super_admin_without_tenant() IS 
  'Retorna TRUE se o usuário logado é super admin sem tenant associado.';