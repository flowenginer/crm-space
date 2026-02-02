-- DROP das funções existentes com assinaturas corretas
DROP FUNCTION IF EXISTS public.transfer_conversation(uuid, uuid, uuid, text, boolean);
DROP FUNCTION IF EXISTS public.update_conversation_assignment(uuid, uuid, uuid, text, boolean, text);

-- Recriar transfer_conversation com sincronização SEMPRE
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
  WHERE id = p_conversation_id;

  -- SEMPRE sincronizar o contato com a conversa (correção principal)
  UPDATE contacts
  SET 
    assigned_to = p_to_user_id,
    department_id = COALESCE(v_final_department_id, department_id),
    updated_at = NOW()
  WHERE id = v_contact_id;

  -- Registrar evento de transferência
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

-- Recriar update_conversation_assignment com sincronização SEMPRE
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
  WHERE id = p_conversation_id;

  -- SEMPRE sincronizar o contato quando há mudança de atribuição (correção principal)
  IF p_assigned_to IS NOT NULL OR p_department_id IS NOT NULL THEN
    UPDATE contacts
    SET 
      assigned_to = COALESCE(p_assigned_to, assigned_to),
      department_id = COALESCE(p_department_id, department_id),
      updated_at = NOW()
    WHERE id = v_contact_id;
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

COMMENT ON FUNCTION transfer_conversation IS 'Transfere conversa E sincroniza contato - sempre mantém ambos os campos alinhados';
COMMENT ON FUNCTION update_conversation_assignment IS 'Atualiza atribuição de conversa E sincroniza contato - sempre mantém ambos os campos alinhados';