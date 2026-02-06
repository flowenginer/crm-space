
-- =========================================================================
-- Desvincular Atendente Atual (conversa) do Responsável (contato)
-- Mudar atendente atual NÃO altera mais o responsável do contato
-- =========================================================================

-- 1. Recriar update_conversation_assignment SEM sincronização do contato
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

  -- Atualizar conversa (SEM tocar no contato)
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
    AND tenant_id = v_conversation.tenant_id;

  -- REMOVIDO: Bloco de sincronização do contato (contacts.assigned_to)
  -- Agora atendente atual e responsável são campos independentes

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
    'assigned_to', COALESCE(p_assigned_to, v_conversation.assigned_to),
    'department_id', COALESCE(p_department_id, v_conversation.department_id),
    'status', v_new_status
  );
END;
$$;

-- 2. Recriar transfer_conversation SEM sincronização do contato
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
  v_current_user_id uuid;
  v_current_user_role text;
  v_can_transfer boolean;
  v_from_user_name text;
  v_to_user_name text;
  v_to_department_name text;
BEGIN
  v_current_user_id := auth.uid();

  IF v_current_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Usuário não autenticado');
  END IF;

  -- Verificar permissão de transferência
  SELECT role INTO v_current_user_role
  FROM profiles
  WHERE id = v_current_user_id;

  IF v_current_user_role NOT IN ('admin', 'supervisor') THEN
    v_can_transfer := public.can_transfer_freely(v_current_user_id);
    IF NOT v_can_transfer THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Você não tem permissão para transferir conversas'
      );
    END IF;
  END IF;

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
  
  v_final_department_id := COALESCE(p_to_department_id, v_from_department_id);
  
  IF p_to_user_id IS NOT NULL THEN
    v_new_status := 'open';
  ELSE
    v_new_status := 'pending';
  END IF;

  -- Verificar tenant do novo atendente
  IF p_to_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = p_to_user_id
      AND tenant_id = v_conversation.tenant_id
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Atendente não encontrado ou de outro tenant');
    END IF;
  END IF;

  -- Verificar tenant do novo departamento
  IF p_to_department_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM departments
      WHERE id = p_to_department_id
      AND tenant_id = v_conversation.tenant_id
    ) THEN
      RETURN json_build_object('success', false, 'error', 'Departamento não encontrado ou de outro tenant');
    END IF;
  END IF;

  -- Buscar nomes para incluir no evento
  SELECT full_name INTO v_from_user_name
  FROM profiles WHERE id = v_from_user_id;
  
  SELECT full_name INTO v_to_user_name
  FROM profiles WHERE id = p_to_user_id;
  
  SELECT name INTO v_to_department_name
  FROM departments WHERE id = v_final_department_id;

  -- Atualizar conversa (SEM tocar no contato)
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
  AND tenant_id = v_conversation.tenant_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Falha ao transferir conversa');
  END IF;

  -- REMOVIDO: Bloco de sincronização do contato (contacts.assigned_to)
  -- Agora atendente atual e responsável são campos independentes

  -- Registrar evento de transferência COM NOMES
  INSERT INTO conversation_events (
    conversation_id,
    event_type,
    actor_id,
    data,
    tenant_id
  ) VALUES (
    p_conversation_id,
    'transfer',
    v_current_user_id,
    json_build_object(
      'from_user_id', v_from_user_id,
      'from_user_name', v_from_user_name,
      'to_user_id', p_to_user_id,
      'to_user_name', v_to_user_name,
      'from_department_id', v_from_department_id,
      'to_department_id', v_final_department_id,
      'to_department_name', v_to_department_name,
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

COMMENT ON FUNCTION public.update_conversation_assignment IS
'Atualiza atribuição da conversa SEM sincronizar o contato. Atendente atual e responsável são independentes.';

COMMENT ON FUNCTION public.transfer_conversation IS
'Transfere conversa com verificação de permissões e registro de evento. NÃO altera o responsável do contato.';
