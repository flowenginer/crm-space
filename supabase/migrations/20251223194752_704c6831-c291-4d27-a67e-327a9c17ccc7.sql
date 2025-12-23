-- Função para obter módulos habilitados do tenant do usuário atual
CREATE OR REPLACE FUNCTION public.get_current_tenant_modules()
RETURNS TABLE(module_key text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- Obter tenant_id do usuário atual
  v_tenant_id := get_user_tenant_id();
  
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Retornar módulos habilitados
  RETURN QUERY
  SELECT tm.module_key
  FROM tenant_modules tm
  WHERE tm.tenant_id = v_tenant_id
    AND tm.is_enabled = true;
END;
$$;