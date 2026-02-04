-- =========================================================================
-- CORREÇÃO DE FUNÇÕES DE AUTOMAÇÃO PARA MULTI-TENANCY
-- =========================================================================
-- Este migration corrige funções de automação que podem não estar respeitando
-- corretamente o isolamento de tenant.
-- =========================================================================

-- =========================================================================
-- PARTE 1: Corrigir sync_contact_lead_status_to_conversations
-- =========================================================================
-- Esta função agora inclui tenant_id na query para garantir isolamento

CREATE OR REPLACE FUNCTION public.sync_contact_lead_status_to_conversations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só executar se lead_status realmente mudou
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
    -- Atualizar lead_status em conversas abertas/pending do contato
    -- CORREÇÃO: Incluir tenant_id na query para isolamento de tenant
    UPDATE public.conversations
    SET lead_status = NEW.lead_status
    WHERE contact_id = NEW.id
      AND tenant_id = NEW.tenant_id  -- ADICIONADO: Filtro por tenant
      AND status IN ('open', 'pending');

    -- Log para debug (visível no Supabase Logs)
    RAISE LOG '[sync_contact_lead_status] tenant_id=% contact_id=% status: % → % (updated % conversations)',
      NEW.tenant_id,
      NEW.id,
      COALESCE(OLD.lead_status, 'NULL'),
      COALESCE(NEW.lead_status, 'NULL'),
      (SELECT count(*) FROM conversations WHERE contact_id = NEW.id AND tenant_id = NEW.tenant_id AND status IN ('open', 'pending'));
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_contact_lead_status_to_conversations() IS
'Sincroniza lead_status do contato para conversas.
CORRIGIDO: Agora inclui tenant_id na query para isolamento correto de tenant.';

-- =========================================================================
-- PARTE 2: Corrigir transfer_conversation para incluir tenant_id no evento
-- =========================================================================

CREATE OR REPLACE FUNCTION public.transfer_conversation(
  p_conversation_id uuid,
  p_to_user_id uuid DEFAULT NULL,
  p_to_department_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_force boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation record;
  v_contact_id uuid;
  v_from_user_id uuid;
  v_from_department_id uuid;
  v_final_department_id uuid;
  v_new_status text;
BEGIN
  -- Buscar conversa atual
  SELECT id, contact_id, assigned_to, department_id, status, tenant_id
  INTO v_conversation
  FROM conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Conversation not found');
  END IF;

  v_contact_id := v_conversation.contact_id;
  v_from_user_id := v_conversation.assigned_to;
  v_from_department_id := v_conversation.department_id;

  -- Determinar departamento final
  v_final_department_id := COALESCE(p_to_department_id, v_from_department_id);

  -- Determinar novo status
  IF p_to_user_id IS NOT NULL THEN
    v_new_status := 'open';
  ELSE
    v_new_status := 'pending';
  END IF;

  -- Atualizar conversa
  UPDATE conversations
  SET
    assigned_to = p_to_user_id,
    department_id = v_final_department_id,
    status = v_new_status,
    transferred_from = v_from_user_id,
    transferred_at = NOW(),
    transfer_note = p_note,
    is_new_transfer = true,
    updated_at = NOW()
  WHERE id = p_conversation_id
    AND tenant_id = v_conversation.tenant_id;  -- ADICIONADO: Filtro por tenant

  -- SEMPRE sincronizar o contato com a conversa (correção principal)
  UPDATE contacts
  SET
    assigned_to = p_to_user_id,
    department_id = COALESCE(v_final_department_id, department_id),
    updated_at = NOW()
  WHERE id = v_contact_id
    AND tenant_id = v_conversation.tenant_id;  -- ADICIONADO: Filtro por tenant

  -- Registrar evento de transferência (tenant_id já está sendo passado corretamente)
  INSERT INTO conversation_events (
    conversation_id,
    event_type,
    actor_id,
    data,
    tenant_id
  ) VALUES (
    p_conversation_id,
    'transfer',
    auth.uid(),
    json_build_object(
      'from_user_id', v_from_user_id,
      'to_user_id', p_to_user_id,
      'from_department_id', v_from_department_id,
      'to_department_id', v_final_department_id,
      'note', p_note
    ),
    v_conversation.tenant_id
  );

  RETURN json_build_object(
    'success', true,
    'conversation_id', p_conversation_id,
    'new_assigned_to', p_to_user_id,
    'new_department_id', v_final_department_id,
    'new_status', v_new_status
  );
END;
$$;

COMMENT ON FUNCTION public.transfer_conversation IS
'Transfere conversa E sincroniza contato - inclui filtro por tenant_id para isolamento correto.';

-- =========================================================================
-- PARTE 3: Corrigir update_conversation_assignment
-- =========================================================================

CREATE OR REPLACE FUNCTION public.update_conversation_assignment(
  p_conversation_id uuid,
  p_assigned_to uuid DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_is_new_transfer boolean DEFAULT false,
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation record;
  v_contact_id uuid;
  v_old_assigned_to uuid;
  v_old_department_id uuid;
  v_new_status text;
BEGIN
  -- Buscar conversa atual
  SELECT id, contact_id, assigned_to, department_id, status, tenant_id
  INTO v_conversation
  FROM conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Conversation not found');
  END IF;

  v_contact_id := v_conversation.contact_id;
  v_old_assigned_to := v_conversation.assigned_to;
  v_old_department_id := v_conversation.department_id;

  -- Determinar novo status
  IF p_status IS NOT NULL THEN
    v_new_status := p_status;
  ELSIF p_assigned_to IS NOT NULL AND v_conversation.status = 'pending' THEN
    v_new_status := 'open';
  ELSE
    v_new_status := v_conversation.status;
  END IF;

  -- Atualizar conversa
  UPDATE conversations
  SET
    assigned_to = COALESCE(p_assigned_to, assigned_to),
    department_id = COALESCE(p_department_id, department_id),
    status = v_new_status,
    transferred_from = CASE WHEN p_assigned_to IS NOT NULL AND p_assigned_to != v_old_assigned_to THEN v_old_assigned_to ELSE transferred_from END,
    transferred_at = CASE WHEN p_assigned_to IS NOT NULL AND p_assigned_to != v_old_assigned_to THEN NOW() ELSE transferred_at END,
    transfer_note = CASE WHEN p_note IS NOT NULL THEN p_note ELSE transfer_note END,
    is_new_transfer = CASE WHEN p_is_new_transfer THEN true ELSE is_new_transfer END,
    updated_at = NOW()
  WHERE id = p_conversation_id
    AND tenant_id = v_conversation.tenant_id;  -- ADICIONADO: Filtro por tenant

  -- SEMPRE sincronizar o contato quando há mudança de atribuição
  IF p_assigned_to IS NOT NULL OR p_department_id IS NOT NULL THEN
    UPDATE contacts
    SET
      assigned_to = COALESCE(p_assigned_to, assigned_to),
      department_id = COALESCE(p_department_id, department_id),
      updated_at = NOW()
    WHERE id = v_contact_id
      AND tenant_id = v_conversation.tenant_id;  -- ADICIONADO: Filtro por tenant
  END IF;

  -- Registrar evento se houve mudança de atribuição
  IF p_assigned_to IS NOT NULL AND (v_old_assigned_to IS NULL OR p_assigned_to != v_old_assigned_to) THEN
    INSERT INTO conversation_events (
      conversation_id,
      event_type,
      actor_id,
      data,
      tenant_id
    ) VALUES (
      p_conversation_id,
      'assignment_change',
      auth.uid(),
      json_build_object(
        'from_user_id', v_old_assigned_to,
        'to_user_id', p_assigned_to,
        'from_department_id', v_old_department_id,
        'to_department_id', COALESCE(p_department_id, v_old_department_id),
        'note', p_note
      ),
      v_conversation.tenant_id
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'conversation_id', p_conversation_id,
    'new_assigned_to', COALESCE(p_assigned_to, v_old_assigned_to),
    'new_department_id', COALESCE(p_department_id, v_old_department_id),
    'new_status', v_new_status
  );
END;
$$;

COMMENT ON FUNCTION public.update_conversation_assignment IS
'Atualiza atribuição de conversa E sincroniza contato - inclui filtro por tenant_id para isolamento correto.';

-- =========================================================================
-- PARTE 4: Função para registrar histórico de lead_status com tenant
-- =========================================================================

CREATE OR REPLACE FUNCTION public.record_lead_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só registrar se lead_status realmente mudou
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
    INSERT INTO lead_status_history (
      contact_id,
      old_status,
      new_status,
      changed_at,
      changed_by,
      tenant_id  -- CRÍTICO: Sempre incluir tenant_id
    ) VALUES (
      NEW.id,
      OLD.lead_status,
      NEW.lead_status,
      NOW(),
      auth.uid(),
      NEW.tenant_id  -- Usar o tenant_id do contato
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Garantir que o trigger existe
DROP TRIGGER IF EXISTS trg_record_lead_status_change ON public.contacts;

CREATE TRIGGER trg_record_lead_status_change
  AFTER UPDATE OF lead_status ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.record_lead_status_change();

COMMENT ON FUNCTION public.record_lead_status_change() IS
'Registra mudanças de lead_status no histórico. Sempre inclui tenant_id do contato.';

-- =========================================================================
-- PARTE 5: Função para registrar histórico de atribuição com tenant
-- =========================================================================

CREATE OR REPLACE FUNCTION public.record_assignment_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só registrar se assigned_to realmente mudou
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO lead_assignment_history (
      contact_id,
      assigned_to,
      assigned_from,
      assignment_type,
      assigned_at,
      tenant_id  -- CRÍTICO: Sempre incluir tenant_id
    ) VALUES (
      NEW.id,
      NEW.assigned_to,
      OLD.assigned_to,
      'manual',
      NOW(),
      NEW.tenant_id  -- Usar o tenant_id do contato
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Garantir que o trigger existe
DROP TRIGGER IF EXISTS trg_record_assignment_change ON public.contacts;

CREATE TRIGGER trg_record_assignment_change
  AFTER UPDATE OF assigned_to ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.record_assignment_change();

COMMENT ON FUNCTION public.record_assignment_change() IS
'Registra mudanças de atribuição no histórico. Sempre inclui tenant_id do contato.';

-- =========================================================================
-- PARTE 6: Verificar e corrigir lead_statuses sem tenant específico
-- =========================================================================

-- Função para garantir que cada tenant tenha seus próprios lead_statuses
CREATE OR REPLACE FUNCTION public.ensure_tenant_has_lead_statuses(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Verificar se o tenant já tem lead_statuses
  SELECT COUNT(*) INTO v_count
  FROM lead_statuses
  WHERE tenant_id = p_tenant_id;

  -- Se não tem, criar os padrões copiando da Space Sports (tenant base)
  IF v_count = 0 THEN
    INSERT INTO lead_statuses (name, color, position, tenant_id)
    SELECT name, color, position, p_tenant_id
    FROM lead_statuses
    WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
    ON CONFLICT DO NOTHING;

    RAISE LOG '[ensure_tenant_has_lead_statuses] Created % lead_statuses for tenant %',
      (SELECT COUNT(*) FROM lead_statuses WHERE tenant_id = p_tenant_id), p_tenant_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.ensure_tenant_has_lead_statuses IS
'Garante que um tenant tenha seus próprios lead_statuses. Copia do tenant base se não existirem.';

-- Aplicar para todos os tenants ativos que não têm lead_statuses
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM tenants WHERE is_active = true AND id != '00000000-0000-0000-0000-000000000001'
  LOOP
    PERFORM ensure_tenant_has_lead_statuses(r.id);
  END LOOP;
END $$;

-- =========================================================================
-- PARTE 7: Garantir que cada tenant tenha company_settings
-- =========================================================================

CREATE OR REPLACE FUNCTION public.ensure_tenant_has_settings(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Verificar se o tenant já tem settings
  SELECT EXISTS(SELECT 1 FROM company_settings WHERE tenant_id = p_tenant_id) INTO v_exists;

  -- Se não tem, criar registro padrão
  IF NOT v_exists THEN
    INSERT INTO company_settings (tenant_id, lead_distribution_enabled)
    VALUES (p_tenant_id, false)
    ON CONFLICT (tenant_id) DO NOTHING;

    RAISE LOG '[ensure_tenant_has_settings] Created settings for tenant %', p_tenant_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.ensure_tenant_has_settings IS
'Garante que um tenant tenha registro em company_settings.';

-- Aplicar para todos os tenants ativos
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM tenants WHERE is_active = true
  LOOP
    PERFORM ensure_tenant_has_settings(r.id);
  END LOOP;
END $$;
