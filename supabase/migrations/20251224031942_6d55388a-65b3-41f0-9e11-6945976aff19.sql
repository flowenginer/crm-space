-- Modificar a função validate_user_tenant para aceitar o tenant principal SPACE SPORTS
-- Agora o UUID 00000000-0000-0000-0000-000000000001 é o tenant Space Sports, não mais um "tenant default vazio"
CREATE OR REPLACE FUNCTION public.validate_user_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_primary_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  v_is_super_admin BOOLEAN;
  v_tenant_exists BOOLEAN;
BEGIN
  -- Verificar se o tenant existe e está ativo
  SELECT EXISTS (
    SELECT 1 FROM tenants 
    WHERE id = NEW.tenant_id 
    AND is_active = true
  ) INTO v_tenant_exists;
  
  -- Se o tenant não existe ou não está ativo, bloquear
  IF NEW.tenant_id IS NOT NULL AND NOT COALESCE(v_tenant_exists, false) THEN
    RAISE EXCEPTION 'Tenant inválido ou inativo.';
  END IF;
  
  -- O tenant primário (Space Sports) agora é um tenant válido para qualquer usuário
  -- Não há mais restrição especial para ele
  
  RETURN NEW;
END;
$function$;