-- Atualizar função transfer_conversation para atribuir atendente responsável na primeira transferência
-- Quando um contato SEM responsável (assigned_to IS NULL) é transferido para um vendedor,
-- esse vendedor se torna o atendente responsável permanente

CREATE OR REPLACE FUNCTION public.transfer_conversation(
  p_conversation_id uuid, 
  p_to_user_id uuid, 
  p_to_department_id uuid DEFAULT NULL::uuid, 
  p_note text DEFAULT NULL::text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_user_id UUID;
  v_from_user_id UUID;
  v_from_department_id UUID;
  v_from_user_name TEXT;
  v_to_user_name TEXT;
  v_from_department_name TEXT;
  v_to_department_name TEXT;
  v_contact_id UUID;
  v_final_department_id UUID;
BEGIN
  v_current_user_id := auth.uid();
  
  -- Verificar se usuário está autenticado
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Buscar o assigned_to, department_id e contact_id atual
  SELECT assigned_to, department_id, contact_id 
  INTO v_from_user_id, v_from_department_id, v_contact_id
  FROM conversations WHERE id = p_conversation_id;
  
  -- Determinar o departamento final
  v_final_department_id := COALESCE(p_to_department_id, v_from_department_id);
  
  -- Buscar nome do usuário de origem
  IF v_from_user_id IS NOT NULL THEN
    SELECT full_name INTO v_from_user_name 
    FROM profiles WHERE id = v_from_user_id;
  END IF;
  
  -- Buscar nome do usuário de destino
  IF p_to_user_id IS NOT NULL THEN
    SELECT full_name INTO v_to_user_name 
    FROM profiles WHERE id = p_to_user_id;
  END IF;
  
  -- Buscar nome do departamento de origem
  IF v_from_department_id IS NOT NULL THEN
    SELECT name INTO v_from_department_name 
    FROM departments WHERE id = v_from_department_id;
  END IF;
  
  -- Buscar nome do departamento de destino
  IF p_to_department_id IS NOT NULL THEN
    SELECT name INTO v_to_department_name 
    FROM departments WHERE id = p_to_department_id;
  ELSE
    v_to_department_name := v_from_department_name;
  END IF;
  
  -- Criar evento de transferência com nomes incluídos
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
      'from_user_name', v_from_user_name,
      'to_user_id', p_to_user_id,
      'to_user_name', v_to_user_name,
      'from_department_id', v_from_department_id,
      'from_department_name', v_from_department_name,
      'to_department_id', v_final_department_id,
      'to_department_name', v_to_department_name,
      'note', p_note,
      'is_return', false
    )
  );
  
  -- Fazer a transferência da conversa e marcar como nova transferência
  UPDATE conversations
  SET 
    assigned_to = p_to_user_id,
    department_id = v_final_department_id,
    transferred_from = COALESCE(v_from_user_id, v_current_user_id),
    transferred_at = NOW(),
    transfer_note = p_note,
    status = 'open',
    is_new_transfer = true,
    updated_at = NOW()
  WHERE id = p_conversation_id;
  
  -- Atualizar o contato: departamento E atendente responsável (se ainda não tem)
  -- A lógica CASE garante que só atribui responsável se o contato ainda não tem um
  IF v_contact_id IS NOT NULL THEN
    UPDATE contacts
    SET 
      department_id = COALESCE(v_final_department_id, department_id),
      -- NOVO: Atribuir atendente responsável se contato ainda não tem
      assigned_to = CASE 
        WHEN assigned_to IS NULL AND p_to_user_id IS NOT NULL THEN p_to_user_id 
        ELSE assigned_to 
      END,
      updated_at = NOW()
    WHERE id = v_contact_id;
  END IF;
  
  RETURN TRUE;
END;
$function$;