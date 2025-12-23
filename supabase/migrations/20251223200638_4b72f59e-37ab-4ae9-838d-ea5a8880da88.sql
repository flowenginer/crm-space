-- Primeiro, garantir que existe uma constraint única em (tenant_id, module_key)
-- Usar IF NOT EXISTS para evitar erro se já existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenant_modules_tenant_id_module_key_key'
  ) THEN
    ALTER TABLE public.tenant_modules 
    ADD CONSTRAINT tenant_modules_tenant_id_module_key_key 
    UNIQUE (tenant_id, module_key);
  END IF;
END $$;

-- Atualizar a função para usar UPSERT
CREATE OR REPLACE FUNCTION public.update_tenant_modules(p_tenant_id uuid, p_modules text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Verificar se o usuário é super admin
  IF NOT current_user_is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Super admin privileges required';
  END IF;

  -- Desabilitar todos os módulos existentes para este tenant
  UPDATE tenant_modules 
  SET is_enabled = false 
  WHERE tenant_id = p_tenant_id;

  -- Inserir/atualizar os módulos selecionados (UPSERT)
  INSERT INTO tenant_modules (tenant_id, module_key, is_enabled)
  SELECT p_tenant_id, unnest(p_modules), true
  ON CONFLICT (tenant_id, module_key) 
  DO UPDATE SET is_enabled = true;
END;
$function$;