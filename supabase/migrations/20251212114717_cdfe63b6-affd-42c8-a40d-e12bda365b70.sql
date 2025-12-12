-- =====================================================
-- PARTE 1: Função de sincronização conversa → contato
-- =====================================================
CREATE OR REPLACE FUNCTION public.sync_conversation_to_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só sincroniza se algum dos campos relevantes mudou
  IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to)
     OR (OLD.department_id IS DISTINCT FROM NEW.department_id)
     OR (OLD.lead_status IS DISTINCT FROM NEW.lead_status) THEN
    
    UPDATE contacts
    SET 
      assigned_to = NEW.assigned_to,
      department_id = NEW.department_id,
      lead_status = NEW.lead_status,
      updated_at = NOW()
    WHERE id = NEW.contact_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- =====================================================
-- PARTE 2: Trigger para disparar após UPDATE
-- =====================================================
DROP TRIGGER IF EXISTS trg_sync_conversation_to_contact ON conversations;

CREATE TRIGGER trg_sync_conversation_to_contact
AFTER UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION sync_conversation_to_contact();

-- =====================================================
-- PARTE 3: Correção em massa dos contatos divergentes
-- =====================================================
WITH latest_conversations AS (
  SELECT DISTINCT ON (contact_id)
    contact_id,
    assigned_to,
    department_id,
    lead_status
  FROM conversations
  WHERE status IN ('open', 'pending')
  ORDER BY contact_id, updated_at DESC
)
UPDATE contacts c
SET 
  assigned_to = lc.assigned_to,
  department_id = lc.department_id,
  lead_status = lc.lead_status,
  updated_at = NOW()
FROM latest_conversations lc
WHERE c.id = lc.contact_id
AND (
  c.assigned_to IS DISTINCT FROM lc.assigned_to
  OR c.department_id IS DISTINCT FROM lc.department_id
  OR c.lead_status IS DISTINCT FROM lc.lead_status
);