-- Corrigir user_departments com tenant_id incorreto
-- Atualiza registros com tenant_id default para usar o tenant_id do usuário via profiles

UPDATE user_departments ud
SET tenant_id = p.tenant_id
FROM profiles p
WHERE ud.user_id = p.id
  AND (ud.tenant_id = '00000000-0000-0000-0000-000000000001' OR ud.tenant_id IS NULL)
  AND p.tenant_id IS NOT NULL
  AND p.tenant_id != '00000000-0000-0000-0000-000000000001';

-- Criar trigger para preencher automaticamente tenant_id em novos registros
CREATE OR REPLACE FUNCTION set_user_department_tenant()
RETURNS TRIGGER AS $$
BEGIN
  -- Se tenant_id não foi fornecido ou é o valor default, busca do profiles
  IF NEW.tenant_id IS NULL OR NEW.tenant_id = '00000000-0000-0000-0000-000000000001' THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM profiles
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remove trigger se já existir e recria
DROP TRIGGER IF EXISTS trigger_set_user_department_tenant ON user_departments;

CREATE TRIGGER trigger_set_user_department_tenant
  BEFORE INSERT ON user_departments
  FOR EACH ROW
  EXECUTE FUNCTION set_user_department_tenant();