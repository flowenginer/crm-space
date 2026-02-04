-- =========================================================================
-- CORREÇÃO: Lógica de prioridade para permissões de usuário vs departamento
-- =========================================================================
-- PROBLEMA:
-- Beatriz tem can_transfer_freely = FALSE (bloqueada)
-- Departamento "Emprega Mais" tem can_transfer_freely = TRUE
-- O sistema liberava porque: user OR department = TRUE
--
-- SOLUÇÃO:
-- Se usuário está EXPLICITAMENTE bloqueado (FALSE) → bloqueia (ignora departamento)
-- Se usuário tem permissão (TRUE) → libera
-- Se não foi definido para usuário (NULL) → verifica departamento
-- =========================================================================

-- =========================================================================
-- PARTE 1: Corrigir função can_transfer_freely
-- =========================================================================

CREATE OR REPLACE FUNCTION public.can_transfer_freely(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
  user_flag boolean;  -- Pode ser TRUE, FALSE ou NULL
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

  -- PRIORIDADE DO USUÁRIO:
  -- Se user_flag é TRUE → libera (usuário tem permissão explícita)
  -- Se user_flag é FALSE → bloqueia (usuário foi explicitamente bloqueado)
  -- Se user_flag é NULL → verifica departamento

  IF user_flag IS NOT NULL THEN
    -- Usuário tem configuração explícita - usar ela e ignorar departamento
    RETURN user_flag;
  END IF;

  -- Usuário não tem configuração explícita (NULL) - verificar departamentos
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

COMMENT ON FUNCTION public.can_transfer_freely IS
'Verifica se usuário pode transferir livremente.
LÓGICA DE PRIORIDADE:
1. Admin/Supervisor → sempre TRUE
2. Se user.can_transfer_freely = TRUE → TRUE (permissão explícita)
3. Se user.can_transfer_freely = FALSE → FALSE (bloqueio explícito, ignora departamento)
4. Se user.can_transfer_freely = NULL → verifica departamento';

-- =========================================================================
-- PARTE 2: Corrigir função can_view_all_data com mesma lógica
-- =========================================================================

CREATE OR REPLACE FUNCTION public.can_view_all_data(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
  user_flag boolean;  -- Pode ser TRUE, FALSE ou NULL
  user_tenant_id uuid;
  dept_flag boolean;
BEGIN
  -- Get user's role, flag, and tenant_id
  SELECT role, can_view_all_conversations, tenant_id
  INTO user_role, user_flag, user_tenant_id
  FROM profiles WHERE id = _user_id;

  -- If no tenant_id found, deny access
  IF user_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Admin/Supervisor can always view all
  IF user_role IN ('admin', 'supervisor') THEN
    RETURN TRUE;
  END IF;

  -- PRIORIDADE DO USUÁRIO:
  -- Se user_flag é TRUE → libera (usuário tem permissão explícita)
  -- Se user_flag é FALSE → bloqueia (usuário foi explicitamente bloqueado)
  -- Se user_flag é NULL → verifica departamento

  IF user_flag IS NOT NULL THEN
    -- Usuário tem configuração explícita - usar ela e ignorar departamento
    RETURN user_flag;
  END IF;

  -- Usuário não tem configuração explícita (NULL) - verificar departamentos
  SELECT EXISTS (
    SELECT 1 FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = _user_id
    AND ud.tenant_id = user_tenant_id
    AND d.tenant_id = user_tenant_id
    AND d.can_view_all_conversations = TRUE
  ) INTO dept_flag;

  RETURN COALESCE(dept_flag, FALSE);
END;
$function$;

COMMENT ON FUNCTION public.can_view_all_data IS
'Verifica se usuário pode ver todos os dados.
LÓGICA DE PRIORIDADE:
1. Admin/Supervisor → sempre TRUE
2. Se user.can_view_all_conversations = TRUE → TRUE (permissão explícita)
3. Se user.can_view_all_conversations = FALSE → FALSE (bloqueio explícito, ignora departamento)
4. Se user.can_view_all_conversations = NULL → verifica departamento';
