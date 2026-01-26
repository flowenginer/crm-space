-- Fix set_tenant_id_from_user to accept valid tenant_id even if it's the master tenant
-- This allows edge functions (using service role) to insert data with explicit tenant_id

CREATE OR REPLACE FUNCTION public.set_tenant_id_from_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_tenant_id uuid;
BEGIN
  -- Se tenant_id já foi fornecido e é válido (qualquer UUID válido), manter
  -- Isso permite que edge functions com service role insiram dados com tenant_id explícito
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Buscar tenant_id do usuário autenticado
  user_tenant_id := get_user_tenant_id();
  
  -- Se o usuário tem tenant_id, usar ele
  IF user_tenant_id IS NOT NULL THEN
    NEW.tenant_id := user_tenant_id;
  ELSE
    -- Se não tem usuário autenticado e tenant_id é NULL, erro
    RAISE EXCEPTION 'tenant_id é obrigatório e não foi possível determinar automaticamente';
  END IF;
  
  RETURN NEW;
END;
$function$;