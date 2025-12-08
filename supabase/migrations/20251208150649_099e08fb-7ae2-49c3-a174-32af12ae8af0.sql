-- Função RPC SECURITY DEFINER para transferência de conversas
-- Permite que usuários transfiram conversas mesmo sem UPDATE direto
CREATE OR REPLACE FUNCTION public.transfer_conversation(
  p_conversation_id UUID,
  p_to_user_id UUID,
  p_to_department_id UUID DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_user_id UUID;
  v_from_user_id UUID;
  v_from_department_id UUID;
BEGIN
  v_current_user_id := auth.uid();
  
  -- Buscar o assigned_to e department_id atual
  SELECT assigned_to, department_id 
  INTO v_from_user_id, v_from_department_id
  FROM conversations WHERE id = p_conversation_id;
  
  -- Verificar permissão: admin/supervisor OU dono da conversa OU conversa não atribuída
  IF NOT (
    is_admin_or_supervisor(v_current_user_id) 
    OR v_from_user_id = v_current_user_id 
    OR v_from_user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Sem permissão para transferir esta conversa';
  END IF;
  
  -- Criar evento de transferência
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
      'to_department_id', COALESCE(p_to_department_id, v_from_department_id),
      'note', p_note,
      'is_return', false
    )
  );
  
  -- Fazer a transferência
  UPDATE conversations
  SET 
    assigned_to = p_to_user_id,
    department_id = COALESCE(p_to_department_id, department_id),
    transferred_from = COALESCE(v_from_user_id, v_current_user_id),
    transferred_at = NOW(),
    transfer_note = p_note,
    status = 'open',
    updated_at = NOW()
  WHERE id = p_conversation_id;
  
  RETURN TRUE;
END;
$$;