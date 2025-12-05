-- =====================================================
-- Limpeza de contatos LID (Linked IDs) da Evolution API
-- Contatos LID são identificados por telefones inválidos:
-- - Não começam com 55
-- - Têm mais de 13 dígitos
-- =====================================================

-- Criar função para identificar contatos LID
CREATE OR REPLACE FUNCTION is_lid_contact(phone TEXT) RETURNS BOOLEAN AS $$
BEGIN
  -- Remove caracteres não numéricos
  phone := regexp_replace(phone, '\D', '', 'g');
  
  -- LID contacts: não começam com 55 OU têm mais de 13 dígitos
  IF NOT phone LIKE '55%' THEN
    RETURN TRUE;
  END IF;
  
  IF LENGTH(phone) > 13 THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Log quantos contatos LID serão removidos
DO $$
DECLARE
  lid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO lid_count FROM contacts WHERE is_lid_contact(phone);
  RAISE NOTICE 'Found % LID contacts to clean up', lid_count;
END $$;

-- Deletar mensagens de contatos LID
DELETE FROM messages 
WHERE contact_id IN (
  SELECT id FROM contacts WHERE is_lid_contact(phone)
);

-- Deletar conversas de contatos LID
DELETE FROM conversations 
WHERE contact_id IN (
  SELECT id FROM contacts WHERE is_lid_contact(phone)
);

-- Deletar tags de contatos LID
DELETE FROM contact_tags 
WHERE contact_id IN (
  SELECT id FROM contacts WHERE is_lid_contact(phone)
);

-- Deletar contatos LID
DELETE FROM contacts WHERE is_lid_contact(phone);

-- Log resultado final
DO $$
DECLARE
  remaining_lid INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_lid FROM contacts WHERE is_lid_contact(phone);
  RAISE NOTICE 'Cleanup complete. Remaining LID contacts: %', remaining_lid;
END $$;

-- Manter a função para uso futuro em validações
COMMENT ON FUNCTION is_lid_contact(TEXT) IS 'Verifica se um telefone é um LID (Linked ID) inválido da Evolution API';