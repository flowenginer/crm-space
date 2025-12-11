-- Atualizar função transfer_conversation para verificar disponibilidade do agente
CREATE OR REPLACE FUNCTION public.transfer_conversation(
  p_conversation_id UUID,
  p_to_user_id UUID DEFAULT NULL,
  p_to_department_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_user_id UUID;
  v_from_user_id UUID;
  v_from_department_id UUID;
  v_target_available BOOLEAN;
  v_target_name TEXT;
BEGIN
  v_current_user_id := auth.uid();
  
  -- Obter dados atuais da conversa
  SELECT assigned_to, department_id 
  INTO v_from_user_id, v_from_department_id
  FROM conversations 
  WHERE id = p_conversation_id;
  
  -- Se transferindo para um usuário específico, verificar disponibilidade
  IF p_to_user_id IS NOT NULL AND NOT p_force THEN
    SELECT is_available, full_name 
    INTO v_target_available, v_target_name
    FROM profiles 
    WHERE id = p_to_user_id;
    
    -- Bloquear se o usuário está indisponível (pausado)
    IF v_target_available = FALSE THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'AGENT_UNAVAILABLE',
        'message', format('O atendente %s está com recebimento de novos leads pausado', COALESCE(v_target_name, 'selecionado'))
      );
    END IF;
  END IF;
  
  -- Atualizar a conversa
  UPDATE conversations SET
    assigned_to = p_to_user_id,
    department_id = COALESCE(p_to_department_id, department_id),
    transferred_from = v_from_user_id,
    transferred_at = NOW(),
    transfer_note = p_note,
    is_new_transfer = TRUE,
    status = CASE WHEN p_to_user_id IS NULL THEN 'pending' ELSE 'open' END,
    updated_at = NOW()
  WHERE id = p_conversation_id;
  
  -- Registrar evento de transferência
  INSERT INTO conversation_events (
    conversation_id,
    event_type,
    actor_id,
    data
  ) VALUES (
    p_conversation_id,
    'transfer',
    v_current_user_id,
    jsonb_build_object(
      'from_user_id', v_from_user_id,
      'to_user_id', p_to_user_id,
      'from_department_id', v_from_department_id,
      'to_department_id', p_to_department_id,
      'note', p_note
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Conversa transferida com sucesso'
  );
END;
$$;