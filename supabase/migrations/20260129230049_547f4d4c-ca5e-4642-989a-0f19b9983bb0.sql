-- =====================================================
-- TRIGGER: Sincronizar department_id entre contacts e conversations
-- =====================================================

-- Função para sincronizar department_id da conversation para o contact
CREATE OR REPLACE FUNCTION sync_department_to_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando conversation.department_id é atualizado/inserido
  -- Atualizar o contact correspondente se ele não tiver department_id
  -- OU se for uma atualização explícita (não na criação)
  IF NEW.department_id IS NOT NULL THEN
    UPDATE contacts
    SET 
      department_id = NEW.department_id,
      updated_at = now()
    WHERE id = NEW.contact_id
      AND (department_id IS NULL OR department_id != NEW.department_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Função para sincronizar department_id do contact para conversations ativas
CREATE OR REPLACE FUNCTION sync_department_to_conversations()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando contact.department_id é atualizado
  -- Atualizar todas as conversas abertas/pendentes desse contato
  IF NEW.department_id IS DISTINCT FROM OLD.department_id AND NEW.department_id IS NOT NULL THEN
    UPDATE conversations
    SET 
      department_id = NEW.department_id,
      updated_at = now()
    WHERE contact_id = NEW.id
      AND status IN ('open', 'pending')
      AND (department_id IS NULL OR department_id != NEW.department_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop triggers existentes se houver
DROP TRIGGER IF EXISTS trigger_sync_department_to_contact ON conversations;
DROP TRIGGER IF EXISTS trigger_sync_department_to_conversations ON contacts;

-- Criar trigger para conversations -> contacts
CREATE TRIGGER trigger_sync_department_to_contact
  AFTER INSERT OR UPDATE OF department_id ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION sync_department_to_contact();

-- Criar trigger para contacts -> conversations
CREATE TRIGGER trigger_sync_department_to_conversations
  AFTER UPDATE OF department_id ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION sync_department_to_conversations();

-- =====================================================
-- CORREÇÃO DOS DADOS EXISTENTES
-- =====================================================

-- Atualizar contacts que têm conversations com department_id mas contact sem
-- Pegar o department_id da conversa mais recente
UPDATE contacts c
SET 
  department_id = subquery.conversation_department_id,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (cv.contact_id)
    cv.contact_id,
    cv.department_id as conversation_department_id
  FROM conversations cv
  WHERE cv.department_id IS NOT NULL
  ORDER BY cv.contact_id, cv.updated_at DESC
) subquery
WHERE c.id = subquery.contact_id
  AND c.department_id IS NULL;