-- Primeiro, deletar a conversa duplicada criada indevidamente pela Lara
-- (contato "Essa ALTERNATIVA LTDA" que pertence à Scarlet)
DELETE FROM messages WHERE conversation_id = 'a5fa789f-64c7-4766-a095-2fd474416297';
DELETE FROM internal_notes WHERE conversation_id = 'a5fa789f-64c7-4766-a095-2fd474416297';
DELETE FROM conversation_tags WHERE conversation_id = 'a5fa789f-64c7-4766-a095-2fd474416297';
DELETE FROM conversation_events WHERE conversation_id = 'a5fa789f-64c7-4766-a095-2fd474416297';
DELETE FROM conversations WHERE id = 'a5fa789f-64c7-4766-a095-2fd474416297';

-- Criar função para verificar se usuário pode criar conversa para um contato
CREATE OR REPLACE FUNCTION public.can_create_conversation_for_contact(p_contact_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contact_owner UUID;
  v_contact_dept UUID;
  v_user_dept_ids UUID[];
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user is admin/supervisor
  SELECT role IN ('admin', 'supervisor') INTO v_is_admin
  FROM profiles WHERE id = p_user_id;
  
  IF v_is_admin THEN
    RETURN TRUE;
  END IF;
  
  -- Get contact's owner and department
  SELECT assigned_to, department_id INTO v_contact_owner, v_contact_dept
  FROM contacts WHERE id = p_contact_id;
  
  -- If contact has an owner that is not the current user, deny
  IF v_contact_owner IS NOT NULL AND v_contact_owner != p_user_id THEN
    RETURN FALSE;
  END IF;
  
  -- If contact has a department, check if user belongs to it
  IF v_contact_dept IS NOT NULL THEN
    SELECT array_agg(department_id) INTO v_user_dept_ids
    FROM user_departments WHERE user_id = p_user_id;
    
    IF NOT (v_contact_dept = ANY(COALESCE(v_user_dept_ids, ARRAY[]::UUID[]))) THEN
      RETURN FALSE;
    END IF;
  END IF;
  
  RETURN TRUE;
END;
$$;