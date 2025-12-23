-- FASE 1: Corrigir o usuário duplicado
-- O usuário "topcreative.envios@gmail.com" está no tenant SPACE SPORTS por engano
-- Vamos desativá-lo para evitar confusão (o usuário correto é o com .br)

UPDATE profiles 
SET 
  is_active = false,
  email = 'topcreative.envios+disabled@gmail.com',
  full_name = '[DESATIVADO] ' || full_name
WHERE email = 'topcreative.envios@gmail.com'
  AND tenant_id = '00000000-0000-0000-0000-000000000001';

-- FASE 2: Criar função de validação para impedir tenant default para usuários normais
CREATE OR REPLACE FUNCTION public.validate_user_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_default_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  v_is_super_admin BOOLEAN;
BEGIN
  -- Verificar se o usuário está sendo atribuído ao tenant default
  IF NEW.tenant_id = v_default_tenant_id THEN
    -- Verificar se é super admin
    SELECT EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = NEW.id 
      AND role = 'super_admin'
    ) INTO v_is_super_admin;
    
    -- Se não é super admin, não pode ficar no tenant default
    IF NOT COALESCE(v_is_super_admin, false) THEN
      RAISE EXCEPTION 'Usuários normais não podem ser atribuídos ao tenant default. Atribua um tenant válido.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger para validar tenant na inserção e atualização
DROP TRIGGER IF EXISTS validate_user_tenant_trigger ON profiles;
CREATE TRIGGER validate_user_tenant_trigger
  BEFORE INSERT OR UPDATE OF tenant_id ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_tenant();

-- Criar função para verificar status do tenant no login
CREATE OR REPLACE FUNCTION public.check_user_tenant_status(p_user_id UUID)
RETURNS TABLE(
  is_valid BOOLEAN,
  error_code TEXT,
  error_message TEXT,
  tenant_id UUID,
  tenant_name TEXT,
  tenant_is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile RECORD;
  v_tenant RECORD;
  v_default_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Buscar profile do usuário
  SELECT p.* INTO v_profile
  FROM profiles p
  WHERE p.id = p_user_id;
  
  IF v_profile IS NULL THEN
    RETURN QUERY SELECT false, 'no_profile'::TEXT, 'Perfil não encontrado'::TEXT, NULL::UUID, NULL::TEXT, NULL::BOOLEAN;
    RETURN;
  END IF;
  
  -- Verificar se está no tenant default
  IF v_profile.tenant_id = v_default_tenant_id THEN
    -- Verificar se é super admin
    IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = 'super_admin') THEN
      RETURN QUERY SELECT false, 'default_tenant'::TEXT, 'Usuário atribuído ao tenant default incorretamente'::TEXT, v_profile.tenant_id, 'Default'::TEXT, true;
      RETURN;
    END IF;
  END IF;
  
  -- Buscar tenant
  SELECT t.* INTO v_tenant
  FROM tenants t
  WHERE t.id = v_profile.tenant_id;
  
  IF v_tenant IS NULL THEN
    RETURN QUERY SELECT false, 'no_tenant'::TEXT, 'Tenant não encontrado'::TEXT, v_profile.tenant_id, NULL::TEXT, NULL::BOOLEAN;
    RETURN;
  END IF;
  
  -- Verificar se tenant está ativo
  IF NOT v_tenant.is_active THEN
    RETURN QUERY SELECT false, 'tenant_inactive'::TEXT, 'Tenant desativado'::TEXT, v_tenant.id, v_tenant.name, false;
    RETURN;
  END IF;
  
  -- Tudo ok
  RETURN QUERY SELECT true, NULL::TEXT, NULL::TEXT, v_tenant.id, v_tenant.name, true;
END;
$$;