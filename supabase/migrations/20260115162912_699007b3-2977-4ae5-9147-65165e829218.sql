-- Adicionar proteção anti-duplicata na função transfer_conversation
-- Esta alteração previne transferências duplicadas quando o mesmo destino é chamado múltiplas vezes em curto período

CREATE OR REPLACE FUNCTION public.transfer_conversation(
  p_conversation_id uuid,
  p_to_user_id uuid DEFAULT NULL,
  p_to_department_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_force boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation RECORD;
  v_from_user_id uuid;
  v_from_department_id uuid;
  v_actor_id uuid;
  v_recent_transfer_exists boolean := false;
BEGIN
  -- Get current user
  v_actor_id := auth.uid();
  
  -- Get conversation data
  SELECT id, assigned_to, department_id, status, tenant_id
  INTO v_conversation
  FROM conversations
  WHERE id = p_conversation_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conversa não encontrada');
  END IF;
  
  -- Store original values
  v_from_user_id := v_conversation.assigned_to;
  v_from_department_id := v_conversation.department_id;
  
  -- PROTEÇÃO ANTI-DUPLICATA: Verificar se já existe transferência recente para o mesmo destino
  SELECT EXISTS (
    SELECT 1 FROM conversation_events
    WHERE conversation_id = p_conversation_id
      AND event_type = 'transfer'
      AND created_at > (now() - interval '60 seconds')
      AND (
        -- Mesmo usuário de destino (ou ambos NULL)
        (data->>'to_user_id')::uuid IS NOT DISTINCT FROM p_to_user_id
        AND (
          -- Se departamento não foi especificado, ignorar na comparação
          p_to_department_id IS NULL 
          OR (data->>'to_department_id')::uuid IS NOT DISTINCT FROM p_to_department_id
        )
      )
  ) INTO v_recent_transfer_exists;
  
  IF v_recent_transfer_exists THEN
    -- Retornar sucesso mas indicar que foi ignorado (para não quebrar integrações)
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Transferência já realizada recentemente',
      'skipped', true,
      'conversation_id', p_conversation_id
    );
  END IF;
  
  -- Check if conversation is closed (unless force is true)
  IF v_conversation.status = 'closed' AND NOT p_force THEN
    RETURN jsonb_build_object('success', false, 'error', 'Não é possível transferir uma conversa fechada');
  END IF;
  
  -- Update conversation
  UPDATE conversations
  SET 
    assigned_to = p_to_user_id,
    department_id = COALESCE(p_to_department_id, department_id),
    status = CASE WHEN p_to_user_id IS NOT NULL THEN 'open' ELSE 'pending' END,
    is_new_transfer = true,
    transferred_at = now(),
    transferred_from = v_from_user_id,
    transfer_note = p_note,
    updated_at = now()
  WHERE id = p_conversation_id;
  
  -- Create transfer event
  INSERT INTO conversation_events (
    conversation_id,
    event_type,
    actor_id,
    tenant_id,
    data
  ) VALUES (
    p_conversation_id,
    'transfer',
    v_actor_id,
    v_conversation.tenant_id,
    jsonb_build_object(
      'from_user_id', v_from_user_id,
      'to_user_id', p_to_user_id,
      'from_department_id', v_from_department_id,
      'to_department_id', COALESCE(p_to_department_id, v_from_department_id),
      'note', p_note,
      'forced', p_force
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'conversation_id', p_conversation_id,
    'from_user_id', v_from_user_id,
    'to_user_id', p_to_user_id,
    'from_department_id', v_from_department_id,
    'to_department_id', COALESCE(p_to_department_id, v_from_department_id)
  );
END;
$$;