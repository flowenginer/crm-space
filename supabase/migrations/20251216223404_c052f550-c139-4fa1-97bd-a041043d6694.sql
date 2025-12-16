-- Corrigir função transfer_conversation para verificar se o UPDATE realmente afetou linhas
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
  v_contact_id uuid;
  v_rows_updated integer;
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
  
  -- Obter dados da conversa
  SELECT assigned_to, contact_id INTO v_from_user_id, v_contact_id
  FROM conversations
  WHERE id = p_conversation_id;
  
  -- Verificar se a conversa existe
  IF v_contact_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Conversa não encontrada');
  END IF;
  
  IF v_from_user_id IS NOT NULL THEN
    SELECT full_name INTO v_from_user_name
    FROM profiles
    WHERE id = v_from_user_id;
  END IF;
  
  -- Verificar disponibilidade do agente destino
  IF p_to_user_id IS NOT NULL THEN
    SELECT is_available, full_name INTO v_target_is_available, v_to_user_name
    FROM profiles
    WHERE id = p_to_user_id;
    
    -- Se o agente não está disponível e não é force
    IF v_target_is_available = false AND NOT p_force THEN
      -- Admin/supervisor pode forçar
      IF v_current_user_role NOT IN ('admin', 'supervisor') THEN
        RETURN jsonb_build_object(
          'success', false, 
          'message', format('O atendente %s está com recebimento pausado.', COALESCE(v_to_user_name, 'selecionado'))
        );
      END IF;
    END IF;
  END IF;
  
  -- Obter nome do departamento destino
  IF p_to_department_id IS NOT NULL THEN
    SELECT name INTO v_to_department_name
    FROM departments
    WHERE id = p_to_department_id;
  END IF;
  
  -- Definir status
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
  
  -- Verificar se o UPDATE realmente afetou alguma linha
  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
  
  IF v_rows_updated = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Falha ao atualizar conversa - nenhuma linha afetada');
  END IF;
  
  -- Atualizar contato (departamento e responsável se necessário)
  IF v_contact_id IS NOT NULL THEN
    UPDATE contacts
    SET 
      department_id = COALESCE(p_to_department_id, department_id),
      assigned_to = CASE 
        WHEN assigned_to IS NULL AND p_to_user_id IS NOT NULL THEN p_to_user_id 
        ELSE assigned_to 
      END,
      updated_at = now()
    WHERE id = v_contact_id;
  END IF;
  
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

-- Corrigir a conversa específica que ficou sem atribuição
UPDATE conversations
SET 
  assigned_to = 'dcbedbdb-2016-41b5-a32b-9151b2ca3110',
  department_id = '957b6c4d-5531-4f6b-b8dd-c10eee8521e6',
  status = 'open',
  transferred_at = '2025-12-16 14:31:33.62752+00',
  transferred_from = '30ff01f0-0e4a-4492-89fa-51de7c4f6956',
  updated_at = NOW()
WHERE id = '6abe559b-d2d2-4ba7-ab41-1a8c22487379';