
-- =====================================================
-- FASE 1: OTIMIZAÇÃO DAS FUNÇÕES RLS COM CACHE
-- =====================================================

-- Criar função get_auth_context() com cache por transação
CREATE OR REPLACE FUNCTION get_auth_context()
RETURNS TABLE(user_id uuid, tenant_id uuid, user_role text)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cached_user_id uuid;
  cached_tenant_id uuid;
  cached_role text;
  auth_user_id uuid;
BEGIN
  auth_user_id := auth.uid();
  
  -- Se não há usuário autenticado, retornar nulls
  IF auth_user_id IS NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::text;
    RETURN;
  END IF;
  
  -- Tentar recuperar do cache local da transação
  BEGIN
    cached_user_id := current_setting('app.current_user_id', true)::uuid;
    cached_tenant_id := current_setting('app.current_tenant_id', true)::uuid;
    cached_role := current_setting('app.current_role', true);
    
    -- Se o cache está válido (mesmo user_id), usar
    IF cached_user_id = auth_user_id AND cached_tenant_id IS NOT NULL THEN
      RETURN QUERY SELECT cached_user_id, cached_tenant_id, cached_role;
      RETURN;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Cache não existe ou inválido, continuar para buscar
    NULL;
  END;
  
  -- Buscar do banco
  SELECT p.id, p.tenant_id, p.role 
  INTO cached_user_id, cached_tenant_id, cached_role
  FROM profiles p 
  WHERE p.id = auth_user_id;
  
  -- Armazenar em cache para esta transação
  IF cached_user_id IS NOT NULL THEN
    PERFORM set_config('app.current_user_id', cached_user_id::text, true);
    PERFORM set_config('app.current_tenant_id', COALESCE(cached_tenant_id::text, ''), true);
    PERFORM set_config('app.current_role', COALESCE(cached_role, ''), true);
  END IF;
  
  RETURN QUERY SELECT cached_user_id, cached_tenant_id, cached_role;
END;
$$;

-- Otimizar get_user_tenant_id() para usar o cache
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cached_tid text;
  result_tid uuid;
BEGIN
  -- Tentar pegar do cache primeiro
  BEGIN
    cached_tid := current_setting('app.current_tenant_id', true);
    IF cached_tid IS NOT NULL AND cached_tid != '' THEN
      RETURN cached_tid::uuid;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Se não está em cache, chamar get_auth_context que vai cachear
  SELECT (get_auth_context()).tenant_id INTO result_tid;
  RETURN result_tid;
END;
$$;

-- Otimizar is_admin_or_supervisor() para usar o cache
CREATE OR REPLACE FUNCTION is_admin_or_supervisor(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  cached_uid uuid;
  cached_role text;
  ctx RECORD;
BEGIN
  -- Tentar pegar do cache primeiro
  BEGIN
    cached_uid := current_setting('app.current_user_id', true)::uuid;
    cached_role := current_setting('app.current_role', true);
    
    IF cached_uid IS NOT NULL AND cached_uid = _user_id THEN
      RETURN cached_role IN ('admin', 'supervisor');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Se não está em cache ou é outro usuário, verificar via get_auth_context
  SELECT * INTO ctx FROM get_auth_context();
  
  IF ctx.user_id = _user_id THEN
    RETURN ctx.user_role IN ('admin', 'supervisor');
  END IF;
  
  -- Se é outro usuário (não o autenticado), fazer query direta
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = _user_id
      AND p.role IN ('admin', 'supervisor')
      AND p.tenant_id = ctx.tenant_id
  );
END;
$$;

-- =====================================================
-- FASE 3: ADICIONAR ÍNDICE COMPOSTO CRÍTICO
-- =====================================================

-- Índice para acelerar lookups de RLS em profiles
CREATE INDEX IF NOT EXISTS idx_profiles_id_tenant_role 
ON profiles (id) 
INCLUDE (tenant_id, role);
