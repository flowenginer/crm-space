-- =========================================================================
-- FIX: Restaurar registro de eventos na função transfer_conversation
-- E incluir nomes de usuários/departamentos no evento
-- =========================================================================

-- Dropar versão anterior que não registrava eventos
DROP FUNCTION IF EXISTS public.transfer_conversation(uuid, uuid, uuid);

-- Recriar transfer_conversation COM registro de eventos e nomes
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
  -- Nomes para o evento
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
  
  -- Determinar departamento final
  v_final_department_id := COALESCE(p_to_department_id, v_from_department_id);
  
  -- Determinar novo status
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
  AND tenant_id = v_conversation.tenant_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Falha ao transferir conversa');
  END IF;

  -- Sincronizar o contato com a conversa
  UPDATE contacts
  SET 
    assigned_to = p_to_user_id,
    department_id = COALESCE(v_final_department_id, department_id),
    updated_at = NOW()
  WHERE id = v_contact_id;

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

COMMENT ON FUNCTION public.transfer_conversation IS
'Transfere conversa com verificação de permissões, sincronização de contato, e registro de evento com nomes.';