-- =========================================================================
-- CORREÇÃO URGENTE: Funções de Acesso Especial
-- =========================================================================
-- PROBLEMA: Vendedores com can_view_all = FALSE estão vendo leads de outros
-- CAUSA: A função ignora FALSE e vai direto para o departamento
-- SOLUÇÃO: Se user_flag é NOT NULL, usar esse valor e ignorar departamento
-- =========================================================================

-- FUNÇÃO 1: can_transfer_freely
CREATE OR REPLACE FUNCTION public.can_transfer_freely(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
  user_flag boolean;
  user_tenant_id uuid;
  dept_flag boolean;
BEGIN
  SELECT role, can_transfer_freely, tenant_id
  INTO user_role, user_flag, user_tenant_id
  FROM profiles WHERE id = _user_id;

  IF user_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF user_role IN ('admin', 'supervisor') THEN
    RETURN TRUE;
  END IF;

  -- CORREÇÃO: Se user_flag foi definido (TRUE ou FALSE), usar esse valor
  IF user_flag IS NOT NULL THEN
    RETURN user_flag;
  END IF;

  -- Só verifica departamento se user_flag é NULL
  SELECT EXISTS (
    SELECT 1 FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = _user_id
    AND ud.tenant_id = user_tenant_id
    AND d.tenant_id = user_tenant_id
    AND d.can_transfer_freely = TRUE
  ) INTO dept_flag;

  RETURN COALESCE(dept_flag, FALSE);
END;
$function$;

-- FUNÇÃO 2: can_view_all_data
CREATE OR REPLACE FUNCTION public.can_view_all_data(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
  user_flag boolean;
  user_tenant_id uuid;
  caller_tenant_id uuid;
  dept_flag boolean;
BEGIN
  SELECT tenant_id INTO caller_tenant_id FROM profiles WHERE id = auth.uid();
  
  SELECT role, can_view_all_conversations, tenant_id 
  INTO user_role, user_flag, user_tenant_id 
  FROM profiles WHERE id = _user_id;
  
  IF user_tenant_id IS DISTINCT FROM caller_tenant_id THEN
    RETURN FALSE;
  END IF;
  
  IF user_role IN ('admin', 'supervisor') THEN
    RETURN TRUE;
  END IF;
  
  -- CORREÇÃO: Se user_flag foi definido (TRUE ou FALSE), usar esse valor
  IF user_flag IS NOT NULL THEN
    RETURN user_flag;
  END IF;
  
  -- Só verifica departamento se user_flag é NULL
  SELECT EXISTS (
    SELECT 1 FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = _user_id 
    AND d.can_view_all_conversations = TRUE
    AND d.tenant_id = caller_tenant_id
  ) INTO dept_flag;
  
  RETURN COALESCE(dept_flag, FALSE);
END;
$function$;