
-- =====================================================
-- MIGRAÇÃO: Mesclar conversas duplicadas por contato
-- Move todas as mensagens para a conversa mais antiga
-- =====================================================

-- Função auxiliar para mesclar conversas
CREATE OR REPLACE FUNCTION merge_duplicate_conversations(
  p_keep_conversation_id UUID,
  p_duplicate_conversation_id UUID
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_last_message_at TIMESTAMPTZ;
  v_last_message_preview TEXT;
BEGIN
  -- Mover todas as mensagens da conversa duplicada para a principal
  UPDATE messages 
  SET conversation_id = p_keep_conversation_id
  WHERE conversation_id = p_duplicate_conversation_id;

  -- Mover notas internas
  UPDATE internal_notes 
  SET conversation_id = p_keep_conversation_id
  WHERE conversation_id = p_duplicate_conversation_id;

  -- Mover tags de conversa (ignorando duplicatas)
  INSERT INTO conversation_tags (conversation_id, tag_id, created_at)
  SELECT p_keep_conversation_id, tag_id, created_at
  FROM conversation_tags
  WHERE conversation_id = p_duplicate_conversation_id
  ON CONFLICT DO NOTHING;

  DELETE FROM conversation_tags WHERE conversation_id = p_duplicate_conversation_id;

  -- Atualizar última mensagem da conversa principal
  SELECT created_at, content INTO v_last_message_at, v_last_message_preview
  FROM messages
  WHERE conversation_id = p_keep_conversation_id
  ORDER BY created_at DESC
  LIMIT 1;

  UPDATE conversations
  SET 
    last_message_at = v_last_message_at,
    last_message_preview = LEFT(v_last_message_preview, 100),
    updated_at = NOW()
  WHERE id = p_keep_conversation_id;

  -- Deletar conversa duplicada
  DELETE FROM conversations WHERE id = p_duplicate_conversation_id;

  RAISE NOTICE 'Merged conversation % into %', p_duplicate_conversation_id, p_keep_conversation_id;
END;
$$;

-- 1. Eliel Schemer - mesclar conversas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM conversations WHERE id = '20c3d8ef-a9b2-4cca-8d2d-98f1448572b3')
     AND EXISTS (SELECT 1 FROM conversations WHERE id = '2f6ec548-ec82-4318-96f9-0b0c7997986b') THEN
    PERFORM merge_duplicate_conversations(
      '20c3d8ef-a9b2-4cca-8d2d-98f1448572b3'::UUID,
      '2f6ec548-ec82-4318-96f9-0b0c7997986b'::UUID
    );
  END IF;
END $$;

-- 2. desafioqueroalmas03 - mesclar conversas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM conversations WHERE id = 'ab9f2d6f-a2f3-406c-a28f-32a552b7fca0')
     AND EXISTS (SELECT 1 FROM conversations WHERE id = 'a73da7ce-cf57-4ec5-84d4-062416ff3803') THEN
    PERFORM merge_duplicate_conversations(
      'ab9f2d6f-a2f3-406c-a28f-32a552b7fca0'::UUID,
      'a73da7ce-cf57-4ec5-84d4-062416ff3803'::UUID
    );
  END IF;
END $$;

-- 3. Lego - mesclar conversas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM conversations WHERE id = '9b91a1aa-2e02-497f-8b7d-9d313c6cbd9a')
     AND EXISTS (SELECT 1 FROM conversations WHERE id = '561926db-88cc-4248-a10f-0b96ed71f965') THEN
    PERFORM merge_duplicate_conversations(
      '9b91a1aa-2e02-497f-8b7d-9d313c6cbd9a'::UUID,
      '561926db-88cc-4248-a10f-0b96ed71f965'::UUID
    );
  END IF;
END $$;

-- 4. Lauri matte Junior - mesclar conversas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM conversations WHERE id = 'a20e1278-98ee-486a-bfc0-462580c9febe')
     AND EXISTS (SELECT 1 FROM conversations WHERE id = 'cdf8f5cd-1f1e-45fc-84d3-88ba991f0452') THEN
    PERFORM merge_duplicate_conversations(
      'a20e1278-98ee-486a-bfc0-462580c9febe'::UUID,
      'cdf8f5cd-1f1e-45fc-84d3-88ba991f0452'::UUID
    );
  END IF;
END $$;

-- 5. Ricardo Grion (LID) - mesclar conversas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM conversations WHERE id = '8cd6ce99-4979-45a3-87b6-f7e0066b49cd')
     AND EXISTS (SELECT 1 FROM conversations WHERE id = '792c32d4-1750-40d3-a2ca-ffd541594eb2') THEN
    PERFORM merge_duplicate_conversations(
      '8cd6ce99-4979-45a3-87b6-f7e0066b49cd'::UUID,
      '792c32d4-1750-40d3-a2ca-ffd541594eb2'::UUID
    );
  END IF;
END $$;
