-- Tornar transfer_conversation idempotente: não criar evento se destino é igual ao atual
-- E aumentar janela de deduplicação para 2 minutos

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
  v_final_department_id uuid;
  v_recent_transfer_exists boolean := false;
  v_to_user_name text;
  v_to_department_name text;
  v_from_user_name text;
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
  v_final_department_id := COALESCE(p_to_department_id, v_conversation.department_id);
  
  -- IDEMPOTÊNCIA: Se o destino é exatamente o mesmo, não fazer nada
  IF (p_to_user_id IS NOT DISTINCT FROM v_conversation.assigned_to) 
     AND (v_final_department_id IS NOT DISTINCT FROM v_conversation.department_id) THEN
    RETURN jsonb_build_object(
      'success', true, 
      'message', 'Nenhuma mudança de destino',
      'skipped', true,
      'conversation_id', p_conversation_id
    );
  END IF;
  
  -- PROTEÇÃO ANTI-DUPLICATA: Verificar se já existe transferência recente para o mesmo destino (2 min)
  SELECT EXISTS (
    SELECT 1 FROM conversation_events
    WHERE conversation_id = p_conversation_id
      AND event_type = 'transfer'
      AND created_at >= (now() - interval '2 minutes')
      AND (
        (data->>'to_user_id')::uuid IS NOT DISTINCT FROM p_to_user_id
        AND (
          p_to_department_id IS NULL 
          OR (data->>'to_department_id')::uuid IS NOT DISTINCT FROM p_to_department_id
        )
      )
  ) INTO v_recent_transfer_exists;
  
  IF v_recent_transfer_exists THEN
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
  
  -- Buscar nomes para gravar no evento (evita fallbacks no frontend)
  IF p_to_user_id IS NOT NULL THEN
    SELECT full_name INTO v_to_user_name FROM profiles WHERE id = p_to_user_id;
  END IF;
  
  IF v_final_department_id IS NOT NULL THEN
    SELECT name INTO v_to_department_name FROM departments WHERE id = v_final_department_id;
  END IF;
  
  IF v_from_user_id IS NOT NULL THEN
    SELECT full_name INTO v_from_user_name FROM profiles WHERE id = v_from_user_id;
  END IF;
  
  -- Update conversation
  UPDATE conversations
  SET 
    assigned_to = p_to_user_id,
    department_id = v_final_department_id,
    status = CASE WHEN p_to_user_id IS NOT NULL THEN 'open' ELSE 'pending' END,
    is_new_transfer = true,
    transferred_at = now(),
    transferred_from = v_from_user_id,
    transfer_note = p_note,
    updated_at = now()
  WHERE id = p_conversation_id;
  
  -- Create transfer event with names included
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
      'from_user_name', v_from_user_name,
      'to_user_id', p_to_user_id,
      'to_user_name', v_to_user_name,
      'from_department_id', v_from_department_id,
      'to_department_id', v_final_department_id,
      'to_department_name', v_to_department_name,
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
    'to_department_id', v_final_department_id
  );
END;
$$;