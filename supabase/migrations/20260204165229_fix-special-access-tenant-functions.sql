-- =========================================================================
-- CORREÇÃO: Funções de Acesso Especial para Multi-Tenancy
-- =========================================================================
-- Este migration corrige as funções can_view_all_data e can_transfer_freely
-- para filtrar corretamente por tenant_id, garantindo isolamento entre tenants.
-- =========================================================================

-- =========================================================================
-- PARTE 1: Corrigir função can_view_all_data
-- =========================================================================

CREATE OR REPLACE FUNCTION public.can_view_all_data(_user_id uuid)
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
  -- 1. Get user's role, flag, and tenant_id
  SELECT role, can_view_all_conversations, tenant_id
  INTO user_role, user_flag, user_tenant_id
  FROM profiles WHERE id = _user_id;

  -- If no tenant_id found, deny access
  IF user_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Check role (admin/supervisor)
  IF user_role IN ('admin', 'supervisor') THEN
    RETURN TRUE;
  END IF;

  -- 3. Check user's individual flag
  IF user_flag = TRUE THEN
    RETURN TRUE;
  END IF;

  -- 4. Check user's departments (FILTRADO POR TENANT_ID)
  SELECT EXISTS (
    SELECT 1 FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = _user_id
    AND ud.tenant_id = user_tenant_id  -- CORREÇÃO: Filtrar por tenant
    AND d.tenant_id = user_tenant_id   -- CORREÇÃO: Filtrar por tenant
    AND d.can_view_all_conversations = TRUE
  ) INTO dept_flag;

  RETURN COALESCE(dept_flag, FALSE);
END;
$function$;

COMMENT ON FUNCTION public.can_view_all_data IS
'Verifica se usuário pode ver todos os dados. CORRIGIDO para filtrar por tenant_id.';

-- =========================================================================
-- PARTE 2: Corrigir função can_transfer_freely
-- =========================================================================

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
  -- Get user's role, flag, and tenant_id
  SELECT role, can_transfer_freely, tenant_id
  INTO user_role, user_flag, user_tenant_id
  FROM profiles WHERE id = _user_id;

  -- If no tenant_id found, deny access
  IF user_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Admin/Supervisor can always transfer
  IF user_role IN ('admin', 'supervisor') THEN
    RETURN TRUE;
  END IF;

  -- Check user's individual flag
  IF user_flag = TRUE THEN
    RETURN TRUE;
  END IF;

  -- Check user's departments (FILTRADO POR TENANT_ID)
  SELECT EXISTS (
    SELECT 1 FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = _user_id
    AND ud.tenant_id = user_tenant_id  -- CORREÇÃO: Filtrar por tenant
    AND d.tenant_id = user_tenant_id   -- CORREÇÃO: Filtrar por tenant
    AND d.can_transfer_freely = TRUE
  ) INTO dept_flag;

  RETURN COALESCE(dept_flag, FALSE);
END;
$function$;

COMMENT ON FUNCTION public.can_transfer_freely IS
'Verifica se usuário pode transferir livremente. CORRIGIDO para filtrar por tenant_id.';

-- =========================================================================
-- PARTE 3: Garantir que RLS permite UPDATE de permissões por admins
-- =========================================================================

-- Policy para permitir que admins do tenant atualizem profiles
DROP POLICY IF EXISTS "Admins can update profiles in their tenant" ON profiles;

CREATE POLICY "Admins can update profiles in their tenant" ON profiles
FOR UPDATE TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND (
    -- Admin pode atualizar qualquer profile do tenant
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.tenant_id = profiles.tenant_id
      AND p.role IN ('admin', 'supervisor')
    )
    -- Ou o próprio usuário pode atualizar seu profile (campos limitados)
    OR id = auth.uid()
  )
)
WITH CHECK (
  tenant_id = get_user_tenant_id()
);

-- Policy para permitir que admins do tenant atualizem departments
DROP POLICY IF EXISTS "Admins can update departments in their tenant" ON departments;

CREATE POLICY "Admins can update departments in their tenant" ON departments
FOR UPDATE TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.tenant_id = departments.tenant_id
    AND p.role IN ('admin', 'supervisor')
  )
)
WITH CHECK (
  tenant_id = get_user_tenant_id()
);
