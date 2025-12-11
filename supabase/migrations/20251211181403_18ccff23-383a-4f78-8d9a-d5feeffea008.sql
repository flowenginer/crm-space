-- Recriar a função transfer_conversation com verificação de is_available e retorno JSONB
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
  v_current_user_id uuid;
  v_current_user_name text;
  v_from_user_id uuid;
  v_from_user_name text;
  v_to_user_name text;
  v_to_department_name text;
  v_new_status text;
  v_target_is_available boolean;
  v_current_user_role text;
BEGIN
  -- Obter usuário atual
  v_current_user_id := auth.uid();
  
  IF v_current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado');
  END IF;
  
  -- Obter nome e role do usuário atual
  SELECT full_name, role INTO v_current_user_name, v_current_user_role
  FROM profiles
  WHERE id = v_current_user_id;
  
  -- Obter dados do atendente atual da conversa
  SELECT assigned_to INTO v_from_user_id
  FROM conversations
  WHERE id = p_conversation_id;
  
  IF v_from_user_id IS NOT NULL THEN
    SELECT full_name INTO v_from_user_name
    FROM profiles
    WHERE id = v_from_user_id;
  END IF;
  
  -- Verificar disponibilidade do agente destino (se transferindo para um usuário específico)
  IF p_to_user_id IS NOT NULL THEN
    SELECT is_available INTO v_target_is_available
    FROM profiles
    WHERE id = p_to_user_id;
    
    -- Se o agente não está disponível e não é force, verificar se é admin/supervisor
    IF v_target_is_available = false AND NOT p_force THEN
      -- Permitir admin e supervisor forçar transferência
      IF v_current_user_role IN ('admin', 'supervisor') THEN
        -- Admin/supervisor pode transferir mesmo para agente pausado
        NULL; -- Continuar normalmente
      ELSE
        SELECT full_name INTO v_to_user_name FROM profiles WHERE id = p_to_user_id;
        RETURN jsonb_build_object(
          'success', false, 
          'message', format('O atendente %s está com recebimento pausado e não pode receber novas conversas.', COALESCE(v_to_user_name, 'selecionado'))
        );
      END IF;
    END IF;
    
    SELECT full_name INTO v_to_user_name
    FROM profiles
    WHERE id = p_to_user_id;
  END IF;
  
  -- Obter nome do departamento destino
  IF p_to_department_id IS NOT NULL THEN
    SELECT name INTO v_to_department_name
    FROM departments
    WHERE id = p_to_department_id;
  END IF;
  
  -- Definir status: se vai para um usuário, status = 'open'; se só para departamento, status = 'pending'
  IF p_to_user_id IS NOT NULL THEN
    v_new_status := 'open';
  ELSE
    v_new_status := 'pending';
  END IF;
  
  -- Atualizar a conversa
  UPDATE conversations
  SET 
    assigned_to = p_to_user_id,
    department_id = COALESCE(p_to_department_id, department_id),
    status = v_new_status,
    transferred_at = now(),
    transferred_from = v_from_user_id,
    transfer_note = p_note,
    is_new_transfer = true,
    updated_at = now()
  WHERE id = p_conversation_id;
  
  -- Criar evento de transferência
  INSERT INTO conversation_events (
    conversation_id,
    event_type,
    actor_id,
    data,
    created_at
  ) VALUES (
    p_conversation_id,
    'transfer',
    v_current_user_id,
    jsonb_build_object(
      'from_user_id', v_from_user_id,
      'from_user_name', v_from_user_name,
      'to_user_id', p_to_user_id,
      'to_user_name', v_to_user_name,
      'to_department_id', p_to_department_id,
      'to_department_name', v_to_department_name,
      'note', p_note
    ),
    now()
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'Conversa transferida com sucesso');
END;
$$;