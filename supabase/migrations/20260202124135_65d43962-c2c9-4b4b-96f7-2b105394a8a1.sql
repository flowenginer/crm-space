-- Função RPC para atualizar atribuição de conversas (SECURITY DEFINER)
-- Permite que vendedores atualizem conversas mesmo sem acesso RLS direto
CREATE OR REPLACE FUNCTION update_conversation_assignment(
  p_conversation_id UUID,
  p_assigned_to UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_is_new_transfer BOOLEAN DEFAULT FALSE,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_conversation RECORD;
  v_old_assigned_to UUID;
  v_old_department_id UUID;
  v_assigned_user_name TEXT;
  v_department_name TEXT;
  v_actor_name TEXT;
BEGIN
  -- Obter usuário atual
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado');
  END IF;
  
  -- Obter tenant do usuário
  SELECT tenant_id INTO v_tenant_id FROM profiles WHERE id = v_user_id;
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Tenant não encontrado');
  END IF;
  
  -- Verificar se a conversa existe e pertence ao tenant
  SELECT id, assigned_to, department_id, tenant_id
  INTO v_conversation
  FROM conversations
  WHERE id = p_conversation_id AND tenant_id = v_tenant_id;
  
  IF v_conversation.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Conversa não encontrada');
  END IF;
  
  -- Guardar valores antigos para o evento
  v_old_assigned_to := v_conversation.assigned_to;
  v_old_department_id := v_conversation.department_id;
  
  -- Obter nomes para o evento
  SELECT full_name INTO v_actor_name FROM profiles WHERE id = v_user_id;
  
  IF p_assigned_to IS NOT NULL THEN
    SELECT full_name INTO v_assigned_user_name FROM profiles WHERE id = p_assigned_to;
  END IF;
  
  IF p_department_id IS NOT NULL THEN
    SELECT name INTO v_department_name FROM departments WHERE id = p_department_id;
  END IF;
  
  -- Atualizar a conversa
  UPDATE conversations
  SET 
    assigned_to = COALESCE(p_assigned_to, assigned_to),
    department_id = COALESCE(p_department_id, department_id),
    status = COALESCE(p_status, status),
    is_new_transfer = COALESCE(p_is_new_transfer, is_new_transfer),
    transferred_at = CASE WHEN p_assigned_to IS NOT NULL AND p_assigned_to != v_old_assigned_to THEN now() ELSE transferred_at END,
    transferred_from = CASE WHEN p_assigned_to IS NOT NULL AND p_assigned_to != v_old_assigned_to THEN v_user_id ELSE transferred_from END,
    transfer_note = CASE WHEN p_note IS NOT NULL THEN p_note ELSE transfer_note END,
    updated_at = now()
  WHERE id = p_conversation_id;
  
  -- Criar evento de transferência se mudou atendente
  IF p_assigned_to IS NOT NULL AND (v_old_assigned_to IS NULL OR p_assigned_to != v_old_assigned_to) THEN
    INSERT INTO conversation_events (conversation_id, event_type, actor_id, data)
    VALUES (
      p_conversation_id,
      'transfer',
      v_user_id,
      jsonb_build_object(
        'from_user_id', v_old_assigned_to,
        'to_user_id', p_assigned_to,
        'to_user_name', v_assigned_user_name,
        'note', p_note,
        'is_return', p_note = 'Devolução de transferência'
      )
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'conversation_id', p_conversation_id,
    'assigned_to', p_assigned_to,
    'department_id', p_department_id
  );
END;
$$;

-- Garantir que a função pode ser chamada por usuários autenticados
GRANT EXECUTE ON FUNCTION update_conversation_assignment TO authenticated;