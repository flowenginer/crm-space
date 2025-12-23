-- FASE 4: Adicionar tenant_id filters às funções administrativas sensíveis

-- 1. merge_duplicate_contacts - Adicionar verificação de tenant_id
CREATE OR REPLACE FUNCTION public.merge_duplicate_contacts(p_keep_contact_id uuid, p_duplicate_contact_id uuid, p_use_duplicate_name boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_duplicate_name TEXT;
  v_tenant_id UUID := get_user_tenant_id();
  v_keep_tenant UUID;
  v_dup_tenant UUID;
BEGIN
  -- Verificar que ambos os contatos pertencem ao mesmo tenant do usuário
  SELECT tenant_id INTO v_keep_tenant FROM contacts WHERE id = p_keep_contact_id;
  SELECT tenant_id INTO v_dup_tenant FROM contacts WHERE id = p_duplicate_contact_id;
  
  IF v_keep_tenant != v_tenant_id OR v_dup_tenant != v_tenant_id THEN
    RAISE EXCEPTION 'Acesso negado: contatos não pertencem ao seu tenant';
  END IF;
  
  IF v_keep_tenant != v_dup_tenant THEN
    RAISE EXCEPTION 'Não é possível mesclar contatos de tenants diferentes';
  END IF;

  -- Obter nome do contato duplicado se necessário
  IF p_use_duplicate_name THEN
    SELECT full_name INTO v_duplicate_name 
    FROM contacts 
    WHERE id = p_duplicate_contact_id
      AND tenant_id = v_tenant_id;
    
    -- Atualizar nome do contato principal se o duplicado tem nome
    IF v_duplicate_name IS NOT NULL AND v_duplicate_name != '' THEN
      UPDATE contacts 
      SET full_name = v_duplicate_name,
          updated_at = NOW()
      WHERE id = p_keep_contact_id
        AND tenant_id = v_tenant_id;
    END IF;
  END IF;

  -- Atualizar conversas para apontar ao contato principal (com filtro de tenant)
  UPDATE conversations 
  SET contact_id = p_keep_contact_id,
      updated_at = NOW()
  WHERE contact_id = p_duplicate_contact_id
    AND tenant_id = v_tenant_id;

  -- Atualizar mensagens para apontar ao contato principal (com filtro de tenant)
  UPDATE messages 
  SET contact_id = p_keep_contact_id
  WHERE contact_id = p_duplicate_contact_id
    AND tenant_id = v_tenant_id;

  -- Mover tags do contato duplicado para o principal (ignorando duplicatas)
  INSERT INTO contact_tags (contact_id, tag_id, created_at, tenant_id)
  SELECT p_keep_contact_id, tag_id, created_at, v_tenant_id
  FROM contact_tags
  WHERE contact_id = p_duplicate_contact_id
    AND tenant_id = v_tenant_id
  ON CONFLICT DO NOTHING;

  -- Deletar tags do contato duplicado
  DELETE FROM contact_tags 
  WHERE contact_id = p_duplicate_contact_id
    AND tenant_id = v_tenant_id;

  -- Registrar no log de merge
  INSERT INTO contact_merge_log (
    keep_contact_id, 
    merged_contact_id, 
    keep_name, 
    merged_name,
    tenant_id
  )
  SELECT 
    p_keep_contact_id,
    p_duplicate_contact_id,
    (SELECT full_name FROM contacts WHERE id = p_keep_contact_id),
    v_duplicate_name,
    v_tenant_id;

  -- Deletar contato duplicado
  DELETE FROM contacts 
  WHERE id = p_duplicate_contact_id
    AND tenant_id = v_tenant_id;

  RAISE NOTICE 'Merged contact % into %', p_duplicate_contact_id, p_keep_contact_id;
END;
$function$;

-- 2. merge_duplicate_conversations - Adicionar verificação de tenant_id
CREATE OR REPLACE FUNCTION public.merge_duplicate_conversations(p_keep_conversation_id uuid, p_duplicate_conversation_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_last_message_at TIMESTAMPTZ;
  v_last_message_preview TEXT;
  v_tenant_id UUID := get_user_tenant_id();
  v_keep_tenant UUID;
  v_dup_tenant UUID;
BEGIN
  -- Verificar que ambas as conversas pertencem ao mesmo tenant do usuário
  SELECT tenant_id INTO v_keep_tenant FROM conversations WHERE id = p_keep_conversation_id;
  SELECT tenant_id INTO v_dup_tenant FROM conversations WHERE id = p_duplicate_conversation_id;
  
  IF v_keep_tenant != v_tenant_id OR v_dup_tenant != v_tenant_id THEN
    RAISE EXCEPTION 'Acesso negado: conversas não pertencem ao seu tenant';
  END IF;
  
  IF v_keep_tenant != v_dup_tenant THEN
    RAISE EXCEPTION 'Não é possível mesclar conversas de tenants diferentes';
  END IF;

  -- Mover todas as mensagens da conversa duplicada para a principal (com filtro de tenant)
  UPDATE messages 
  SET conversation_id = p_keep_conversation_id
  WHERE conversation_id = p_duplicate_conversation_id
    AND tenant_id = v_tenant_id;

  -- Mover notas internas (com filtro de tenant)
  UPDATE internal_notes 
  SET conversation_id = p_keep_conversation_id
  WHERE conversation_id = p_duplicate_conversation_id
    AND tenant_id = v_tenant_id;

  -- Mover tags de conversa (ignorando duplicatas, com filtro de tenant)
  INSERT INTO conversation_tags (conversation_id, tag_id, created_at, tenant_id)
  SELECT p_keep_conversation_id, tag_id, created_at, v_tenant_id
  FROM conversation_tags
  WHERE conversation_id = p_duplicate_conversation_id
    AND tenant_id = v_tenant_id
  ON CONFLICT DO NOTHING;

  DELETE FROM conversation_tags 
  WHERE conversation_id = p_duplicate_conversation_id
    AND tenant_id = v_tenant_id;

  -- Atualizar última mensagem da conversa principal
  SELECT created_at, content INTO v_last_message_at, v_last_message_preview
  FROM messages
  WHERE conversation_id = p_keep_conversation_id
    AND tenant_id = v_tenant_id
  ORDER BY created_at DESC
  LIMIT 1;

  UPDATE conversations
  SET 
    last_message_at = v_last_message_at,
    last_message_preview = LEFT(v_last_message_preview, 100),
    updated_at = NOW()
  WHERE id = p_keep_conversation_id
    AND tenant_id = v_tenant_id;

  -- Deletar conversa duplicada
  DELETE FROM conversations 
  WHERE id = p_duplicate_conversation_id
    AND tenant_id = v_tenant_id;

  RAISE NOTICE 'Merged conversation % into %', p_duplicate_conversation_id, p_keep_conversation_id;
END;
$function$;