-- =====================================================
-- MIGRAÇÃO: Mesclar contatos duplicados causados por LID
-- =====================================================

-- 1. Criar função para mesclar contatos duplicados
CREATE OR REPLACE FUNCTION merge_duplicate_contacts(
  p_keep_contact_id UUID,
  p_duplicate_contact_id UUID,
  p_use_duplicate_name BOOLEAN DEFAULT true
) RETURNS void AS $$
DECLARE
  v_duplicate_name TEXT;
BEGIN
  -- Obter nome do contato duplicado se necessário
  IF p_use_duplicate_name THEN
    SELECT full_name INTO v_duplicate_name 
    FROM contacts 
    WHERE id = p_duplicate_contact_id;
    
    -- Atualizar nome do contato principal se o duplicado tem nome
    IF v_duplicate_name IS NOT NULL AND v_duplicate_name != '' THEN
      UPDATE contacts 
      SET full_name = v_duplicate_name,
          updated_at = NOW()
      WHERE id = p_keep_contact_id;
    END IF;
  END IF;

  -- Atualizar conversas para apontar ao contato principal
  UPDATE conversations 
  SET contact_id = p_keep_contact_id,
      updated_at = NOW()
  WHERE contact_id = p_duplicate_contact_id;

  -- Atualizar mensagens para apontar ao contato principal
  UPDATE messages 
  SET contact_id = p_keep_contact_id
  WHERE contact_id = p_duplicate_contact_id;

  -- Mover tags do contato duplicado para o principal (ignorando duplicatas)
  INSERT INTO contact_tags (contact_id, tag_id, created_at)
  SELECT p_keep_contact_id, tag_id, created_at
  FROM contact_tags
  WHERE contact_id = p_duplicate_contact_id
  ON CONFLICT DO NOTHING;

  -- Deletar tags do contato duplicado
  DELETE FROM contact_tags WHERE contact_id = p_duplicate_contact_id;

  -- Deletar contato duplicado
  DELETE FROM contacts WHERE id = p_duplicate_contact_id;

  RAISE NOTICE 'Merged contact % into %', p_duplicate_contact_id, p_keep_contact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Mesclar os contatos duplicados específicos identificados
-- Contato com número real: f6804a36-a879-4861-956a-8c47d52af4e0 (WhatsApp 554598416336)
-- Contato duplicado (LID): 1ed1f469-cb23-4636-ae99-c696f044e78b (Lauri matte Junior)

-- Verificar se os contatos existem antes de mesclar
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM contacts WHERE id = 'f6804a36-a879-4861-956a-8c47d52af4e0')
     AND EXISTS (SELECT 1 FROM contacts WHERE id = '1ed1f469-cb23-4636-ae99-c696f044e78b') THEN
    PERFORM merge_duplicate_contacts(
      'f6804a36-a879-4861-956a-8c47d52af4e0'::UUID,  -- Contato a manter (número real)
      '1ed1f469-cb23-4636-ae99-c696f044e78b'::UUID,  -- Contato a mesclar (LID)
      true  -- Usar nome do contato duplicado
    );
    RAISE NOTICE 'Contacts merged successfully';
  ELSE
    RAISE NOTICE 'One or both contacts not found, skipping merge';
  END IF;
END $$;