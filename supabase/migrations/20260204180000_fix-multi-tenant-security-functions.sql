-- =========================================================================
-- CORREÇÃO COMPLETA: Funções de Segurança para Multi-Tenancy
-- =========================================================================
-- Esta migration corrige todas as funções SECURITY DEFINER que não estavam
-- filtrando corretamente por tenant_id, garantindo isolamento entre tenants.
-- =========================================================================

-- =========================================================================
-- PARTE 1: Corrigir merge_duplicate_contacts()
-- =========================================================================
-- PROBLEMA: Pode mesclar contatos de tenants diferentes
-- SOLUÇÃO: Verificar que ambos contatos pertencem ao mesmo tenant

CREATE OR REPLACE FUNCTION public.merge_duplicate_contacts(
  _keep_contact_id uuid,
  _merge_contact_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  keep_tenant_id uuid;
  merge_tenant_id uuid;
BEGIN
  -- CORREÇÃO: Verificar que ambos contatos pertencem ao mesmo tenant
  SELECT tenant_id INTO keep_tenant_id FROM contacts WHERE id = _keep_contact_id;
  SELECT tenant_id INTO merge_tenant_id FROM contacts WHERE id = _merge_contact_id;

  IF keep_tenant_id IS NULL OR merge_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Contato não encontrado';
  END IF;

  IF keep_tenant_id != merge_tenant_id THEN
    RAISE EXCEPTION 'Não é permitido mesclar contatos de tenants diferentes';
  END IF;

  -- Update conversations to point to the contact we're keeping
  UPDATE conversations
  SET contact_id = _keep_contact_id
  WHERE contact_id = _merge_contact_id
  AND tenant_id = keep_tenant_id;  -- CORREÇÃO: Filtrar por tenant

  -- Update messages to point to the contact we're keeping
  UPDATE messages
  SET contact_id = _keep_contact_id
  WHERE contact_id = _merge_contact_id
  AND tenant_id = keep_tenant_id;  -- CORREÇÃO: Filtrar por tenant

  -- Move tags (avoid duplicates)
  INSERT INTO contact_tags (contact_id, tag_id, tenant_id)
  SELECT _keep_contact_id, ct.tag_id, keep_tenant_id
  FROM contact_tags ct
  WHERE ct.contact_id = _merge_contact_id
  AND ct.tenant_id = keep_tenant_id  -- CORREÇÃO: Filtrar por tenant
  AND NOT EXISTS (
    SELECT 1 FROM contact_tags
    WHERE contact_id = _keep_contact_id
    AND tag_id = ct.tag_id
    AND tenant_id = keep_tenant_id
  );

  -- Delete tags from merged contact
  DELETE FROM contact_tags
  WHERE contact_id = _merge_contact_id
  AND tenant_id = keep_tenant_id;

  -- Delete the merged contact
  DELETE FROM contacts
  WHERE id = _merge_contact_id
  AND tenant_id = keep_tenant_id;
END;
$function$;

COMMENT ON FUNCTION public.merge_duplicate_contacts IS
'Mescla dois contatos duplicados. CORRIGIDO para verificar tenant_id e evitar merge cross-tenant.';

-- =========================================================================
-- PARTE 2: Corrigir merge_duplicate_conversations()
-- =========================================================================
-- PROBLEMA: Pode mesclar conversas de tenants diferentes
-- SOLUÇÃO: Verificar que ambas conversas pertencem ao mesmo tenant

CREATE OR REPLACE FUNCTION public.merge_duplicate_conversations(
  _keep_conversation_id uuid,
  _merge_conversation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  keep_tenant_id uuid;
  merge_tenant_id uuid;
  oldest_created_at timestamptz;
  newest_updated_at timestamptz;
BEGIN
  -- CORREÇÃO: Verificar que ambas conversas pertencem ao mesmo tenant
  SELECT tenant_id INTO keep_tenant_id FROM conversations WHERE id = _keep_conversation_id;
  SELECT tenant_id INTO merge_tenant_id FROM conversations WHERE id = _merge_conversation_id;

  IF keep_tenant_id IS NULL OR merge_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Conversa não encontrada';
  END IF;

  IF keep_tenant_id != merge_tenant_id THEN
    RAISE EXCEPTION 'Não é permitido mesclar conversas de tenants diferentes';
  END IF;

  -- Move messages to the conversation we're keeping
  UPDATE messages
  SET conversation_id = _keep_conversation_id
  WHERE conversation_id = _merge_conversation_id
  AND tenant_id = keep_tenant_id;  -- CORREÇÃO: Filtrar por tenant

  -- Move internal notes
  UPDATE internal_notes
  SET conversation_id = _keep_conversation_id
  WHERE conversation_id = _merge_conversation_id
  AND tenant_id = keep_tenant_id;  -- CORREÇÃO: Filtrar por tenant

  -- Move conversation tags (avoid duplicates)
  INSERT INTO conversation_tags (conversation_id, tag_id, tenant_id)
  SELECT _keep_conversation_id, ct.tag_id, keep_tenant_id
  FROM conversation_tags ct
  WHERE ct.conversation_id = _merge_conversation_id
  AND ct.tenant_id = keep_tenant_id  -- CORREÇÃO: Filtrar por tenant
  AND NOT EXISTS (
    SELECT 1 FROM conversation_tags
    WHERE conversation_id = _keep_conversation_id
    AND tag_id = ct.tag_id
    AND tenant_id = keep_tenant_id
  );

  -- Delete tags from merged conversation
  DELETE FROM conversation_tags
  WHERE conversation_id = _merge_conversation_id
  AND tenant_id = keep_tenant_id;

  -- Get the oldest created_at and newest updated_at
  SELECT
    LEAST(
      (SELECT created_at FROM conversations WHERE id = _keep_conversation_id),
      (SELECT created_at FROM conversations WHERE id = _merge_conversation_id)
    ),
    GREATEST(
      (SELECT updated_at FROM conversations WHERE id = _keep_conversation_id),
      (SELECT updated_at FROM conversations WHERE id = _merge_conversation_id)
    )
  INTO oldest_created_at, newest_updated_at;

  -- Update the kept conversation timestamps
  UPDATE conversations
  SET
    created_at = oldest_created_at,
    updated_at = newest_updated_at
  WHERE id = _keep_conversation_id
  AND tenant_id = keep_tenant_id;

  -- Delete the merged conversation
  DELETE FROM conversations
  WHERE id = _merge_conversation_id
  AND tenant_id = keep_tenant_id;
END;
$function$;

COMMENT ON FUNCTION public.merge_duplicate_conversations IS
'Mescla duas conversas duplicadas. CORRIGIDO para verificar tenant_id e evitar merge cross-tenant.';

-- =========================================================================
-- PARTE 3: Corrigir increment_webhook_stats()
-- =========================================================================
-- PROBLEMA: Atualiza webhook_configs sem verificar tenant
-- SOLUÇÃO: Adicionar verificação de tenant_id

CREATE OR REPLACE FUNCTION public.increment_webhook_stats(
  _webhook_id uuid,
  _success boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  -- CORREÇÃO: Buscar e verificar tenant_id do webhook
  SELECT tenant_id INTO v_tenant_id
  FROM webhook_configs
  WHERE id = _webhook_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Webhook não encontrado';
  END IF;

  IF _success THEN
    UPDATE webhook_configs
    SET
      success_count = COALESCE(success_count, 0) + 1,
      last_triggered_at = NOW()
    WHERE id = _webhook_id
    AND tenant_id = v_tenant_id;  -- CORREÇÃO: Filtrar por tenant
  ELSE
    UPDATE webhook_configs
    SET
      failure_count = COALESCE(failure_count, 0) + 1,
      last_triggered_at = NOW()
    WHERE id = _webhook_id
    AND tenant_id = v_tenant_id;  -- CORREÇÃO: Filtrar por tenant
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.increment_webhook_stats IS
'Incrementa estatísticas de webhook. CORRIGIDO para filtrar por tenant_id.';

-- =========================================================================
-- PARTE 4: Corrigir user_has_department()
-- =========================================================================
-- PROBLEMA: Verifica departamento sem filtrar por tenant
-- SOLUÇÃO: Adicionar filtro de tenant_id

CREATE OR REPLACE FUNCTION public.user_has_department(_user_id uuid, _department_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_tenant_id uuid;
  result boolean;
BEGIN
  -- CORREÇÃO: Buscar tenant_id do usuário
  SELECT tenant_id INTO user_tenant_id
  FROM profiles
  WHERE id = _user_id;

  IF user_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- CORREÇÃO: Verificar com filtro de tenant
  SELECT EXISTS (
    SELECT 1 FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = _user_id
    AND ud.department_id = _department_id
    AND ud.tenant_id = user_tenant_id  -- CORREÇÃO: Filtrar por tenant
    AND d.tenant_id = user_tenant_id   -- CORREÇÃO: Filtrar por tenant
  ) INTO result;

  RETURN COALESCE(result, FALSE);
END;
$function$;

COMMENT ON FUNCTION public.user_has_department IS
'Verifica se usuário pertence a um departamento. CORRIGIDO para filtrar por tenant_id.';

-- =========================================================================
-- PARTE 5: Corrigir get_user_department_ids()
-- =========================================================================
-- PROBLEMA: Retorna departamentos sem filtrar por tenant
-- SOLUÇÃO: Adicionar filtro de tenant_id

CREATE OR REPLACE FUNCTION public.get_user_department_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_tenant_id uuid;
  result uuid[];
BEGIN
  -- CORREÇÃO: Buscar tenant_id do usuário
  SELECT tenant_id INTO user_tenant_id
  FROM profiles
  WHERE id = _user_id;

  IF user_tenant_id IS NULL THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  -- CORREÇÃO: Retornar apenas departamentos do mesmo tenant
  SELECT COALESCE(array_agg(ud.department_id), ARRAY[]::uuid[])
  INTO result
  FROM user_departments ud
  INNER JOIN departments d ON d.id = ud.department_id
  WHERE ud.user_id = _user_id
  AND ud.tenant_id = user_tenant_id  -- CORREÇÃO: Filtrar por tenant
  AND d.tenant_id = user_tenant_id;  -- CORREÇÃO: Filtrar por tenant

  RETURN result;
END;
$function$;

COMMENT ON FUNCTION public.get_user_department_ids IS
'Retorna IDs de departamentos do usuário. CORRIGIDO para filtrar por tenant_id.';

-- =========================================================================
-- PARTE 6: Corrigir check_user_permission()
-- =========================================================================
-- PROBLEMA: Verifica permissão baseada apenas em role, sem tenant
-- SOLUÇÃO: Adicionar verificação de tenant_id

CREATE OR REPLACE FUNCTION public.check_user_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_role text;
  user_tenant_id uuid;
  has_permission boolean;
BEGIN
  -- CORREÇÃO: Buscar role E tenant_id do usuário
  SELECT role, tenant_id
  INTO user_role, user_tenant_id
  FROM profiles
  WHERE id = _user_id;

  IF user_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Admin sempre tem todas as permissões
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Verificar permissão na role_definitions do tenant
  SELECT EXISTS (
    SELECT 1 FROM role_definitions rd
    WHERE rd.role_name = user_role
    AND rd.tenant_id = user_tenant_id  -- CORREÇÃO: Filtrar por tenant
    AND rd.permissions ? _permission
  ) INTO has_permission;

  RETURN COALESCE(has_permission, FALSE);
END;
$function$;

COMMENT ON FUNCTION public.check_user_permission IS
'Verifica se usuário tem uma permissão específica. CORRIGIDO para filtrar por tenant_id.';

-- =========================================================================
-- PARTE 7: Corrigir RLS Policies para tabelas críticas
-- =========================================================================

-- conversation_tags: Adicionar filtro de tenant
DROP POLICY IF EXISTS "Users can view conversation tags" ON conversation_tags;
CREATE POLICY "Users can view conversation tags in their tenant" ON conversation_tags
FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Users can manage conversation tags" ON conversation_tags;
CREATE POLICY "Users can manage conversation tags in their tenant" ON conversation_tags
FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id = get_user_tenant_id());

-- contact_tags: Adicionar filtro de tenant
DROP POLICY IF EXISTS "Users can view contact tags" ON contact_tags;
CREATE POLICY "Users can view contact tags in their tenant" ON contact_tags
FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Users can manage contact tags" ON contact_tags;
CREATE POLICY "Users can manage contact tags in their tenant" ON contact_tags
FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id = get_user_tenant_id());

-- internal_notes: Adicionar filtro de tenant
DROP POLICY IF EXISTS "Users can view internal notes" ON internal_notes;
CREATE POLICY "Users can view internal notes in their tenant" ON internal_notes
FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Users can manage internal notes" ON internal_notes;
CREATE POLICY "Users can manage internal notes in their tenant" ON internal_notes
FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id())
WITH CHECK (tenant_id = get_user_tenant_id());

-- role_definitions: Adicionar filtro de tenant
DROP POLICY IF EXISTS "Users can view role definitions" ON role_definitions;
CREATE POLICY "Users can view role definitions in their tenant" ON role_definitions
FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Admins can manage role definitions" ON role_definitions;
CREATE POLICY "Admins can manage role definitions in their tenant" ON role_definitions
FOR ALL TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND tenant_id = get_user_tenant_id()
  )
)
WITH CHECK (tenant_id = get_user_tenant_id());

-- webhook_configs: Adicionar filtro de tenant
DROP POLICY IF EXISTS "Users can view webhook configs" ON webhook_configs;
CREATE POLICY "Users can view webhook configs in their tenant" ON webhook_configs
FOR SELECT TO authenticated
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Admins can manage webhook configs" ON webhook_configs;
CREATE POLICY "Admins can manage webhook configs in their tenant" ON webhook_configs
FOR ALL TO authenticated
USING (
  tenant_id = get_user_tenant_id()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'supervisor')
    AND tenant_id = get_user_tenant_id()
  )
)
WITH CHECK (tenant_id = get_user_tenant_id());

-- =========================================================================
-- FIM DA MIGRAÇÃO
-- =========================================================================
