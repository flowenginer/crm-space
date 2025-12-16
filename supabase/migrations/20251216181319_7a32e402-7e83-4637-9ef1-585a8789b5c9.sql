-- PARTE 1: Correção imediata de TODAS as conversas abertas
-- Sincronizar last_message_is_from_me e last_message_at com os dados reais das mensagens
UPDATE conversations c
SET 
  last_message_is_from_me = sub.real_is_from_me,
  last_message_at = sub.real_created_at,
  last_message_preview = sub.real_preview,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    m.is_from_me as real_is_from_me,
    m.created_at as real_created_at,
    CASE m.message_type
      WHEN 'image' THEN '📷 Imagem'
      WHEN 'audio' THEN '🎵 Áudio'
      WHEN 'video' THEN '🎬 Vídeo'
      WHEN 'document' THEN '📄 Documento'
      WHEN 'sticker' THEN '🎭 Sticker'
      ELSE LEFT(COALESCE(m.content, ''), 100)
    END as real_preview
  FROM messages m
  WHERE m.is_deleted = false
  ORDER BY m.conversation_id, m.created_at DESC
) sub
WHERE c.id = sub.conversation_id
  AND c.status IN ('open', 'pending');

-- PARTE 2: Melhorar o trigger para atualizar TODOS os campos corretamente
CREATE OR REPLACE FUNCTION public.update_last_message_is_from_me()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_preview TEXT;
BEGIN
  -- Gerar preview baseado no tipo de mensagem
  v_preview := CASE NEW.message_type
    WHEN 'image' THEN '📷 Imagem'
    WHEN 'audio' THEN '🎵 Áudio'
    WHEN 'video' THEN '🎬 Vídeo'
    WHEN 'document' THEN '📄 Documento'
    WHEN 'sticker' THEN '🎭 Sticker'
    WHEN 'location' THEN '📍 Localização'
    WHEN 'contact' THEN '👤 Contato'
    ELSE LEFT(COALESCE(NEW.content, ''), 100)
  END;

  -- Atualizar conversa com TODOS os campos relevantes
  UPDATE conversations 
  SET 
    last_message_is_from_me = NEW.is_from_me,
    last_message_at = NEW.created_at,
    last_message_preview = v_preview,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

-- PARTE 3: Função de verificação/correção periódica (opcional - pode ser chamada manualmente)
CREATE OR REPLACE FUNCTION public.fix_conversation_last_message_sync()
RETURNS TABLE(fixed_count INTEGER, details JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_fixed INTEGER;
  v_details JSONB;
BEGIN
  WITH to_fix AS (
    SELECT 
      c.id,
      c.last_message_is_from_me as old_is_from_me,
      c.last_message_at as old_at,
      sub.real_is_from_me,
      sub.real_created_at
    FROM conversations c
    INNER JOIN (
      SELECT DISTINCT ON (m.conversation_id)
        m.conversation_id,
        m.is_from_me as real_is_from_me,
        m.created_at as real_created_at,
        CASE m.message_type
          WHEN 'image' THEN '📷 Imagem'
          WHEN 'audio' THEN '🎵 Áudio'
          WHEN 'video' THEN '🎬 Vídeo'
          WHEN 'document' THEN '📄 Documento'
          WHEN 'sticker' THEN '🎭 Sticker'
          ELSE LEFT(COALESCE(m.content, ''), 100)
        END as real_preview
      FROM messages m
      WHERE m.is_deleted = false
      ORDER BY m.conversation_id, m.created_at DESC
    ) sub ON c.id = sub.conversation_id
    WHERE c.status IN ('open', 'pending')
      AND (c.last_message_is_from_me IS DISTINCT FROM sub.real_is_from_me
           OR c.last_message_at IS DISTINCT FROM sub.real_created_at)
  ),
  fixed AS (
    UPDATE conversations c
    SET 
      last_message_is_from_me = sub.real_is_from_me,
      last_message_at = sub.real_created_at,
      last_message_preview = sub.real_preview,
      updated_at = NOW()
    FROM (
      SELECT DISTINCT ON (m.conversation_id)
        m.conversation_id,
        m.is_from_me as real_is_from_me,
        m.created_at as real_created_at,
        CASE m.message_type
          WHEN 'image' THEN '📷 Imagem'
          WHEN 'audio' THEN '🎵 Áudio'
          WHEN 'video' THEN '🎬 Vídeo'
          WHEN 'document' THEN '📄 Documento'
          WHEN 'sticker' THEN '🎭 Sticker'
          ELSE LEFT(COALESCE(m.content, ''), 100)
        END as real_preview
      FROM messages m
      WHERE m.is_deleted = false
      ORDER BY m.conversation_id, m.created_at DESC
    ) sub
    WHERE c.id = sub.conversation_id
      AND c.status IN ('open', 'pending')
      AND (c.last_message_is_from_me IS DISTINCT FROM sub.real_is_from_me
           OR c.last_message_at IS DISTINCT FROM sub.real_created_at)
    RETURNING c.id
  )
  SELECT COUNT(*)::INTEGER INTO v_fixed FROM fixed;
  
  v_details := jsonb_build_object(
    'fixed_at', NOW(),
    'conversations_fixed', v_fixed
  );
  
  RETURN QUERY SELECT v_fixed, v_details;
END;
$$;