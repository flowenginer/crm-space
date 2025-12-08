-- Adicionar campo para marcar conversas recém-transferidas
ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS is_new_transfer boolean DEFAULT false;

-- Atualizar a função transfer_conversation para marcar is_new_transfer
CREATE OR REPLACE FUNCTION public.transfer_conversation(p_conversation_id uuid, p_to_user_id uuid, p_to_department_id uuid DEFAULT NULL::uuid, p_note text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_user_id UUID;
  v_from_user_id UUID;
  v_from_department_id UUID;
BEGIN
  v_current_user_id := auth.uid();
  
  -- Verificar se usuário está autenticado
  IF v_current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  
  -- Buscar o assigned_to e department_id atual
  SELECT assigned_to, department_id 
  INTO v_from_user_id, v_from_department_id
  FROM conversations WHERE id = p_conversation_id;
  
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
  
  -- Fazer a transferência e marcar como nova transferência
  UPDATE conversations
  SET 
    assigned_to = p_to_user_id,
    department_id = COALESCE(p_to_department_id, department_id),
    transferred_from = COALESCE(v_from_user_id, v_current_user_id),
    transferred_at = NOW(),
    transfer_note = p_note,
    status = 'open',
    is_new_transfer = true,
    updated_at = NOW()
  WHERE id = p_conversation_id;
  
  RETURN TRUE;
END;
$function$;