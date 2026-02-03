-- =========================================================================
-- SINCRONIZAÇÃO: contacts.lead_status → conversations.lead_status
-- =========================================================================
-- Este trigger garante que qualquer alteração no lead_status de um contato
-- seja refletida automaticamente em todas as conversas abertas/pending
-- do mesmo contato. Isso resolve a inconsistência onde a automação altera
-- o status do contato, mas a lista de conversas (que lê conversations.lead_status)
-- não reflete a mudança.
-- =========================================================================

-- Função que sincroniza lead_status do contato para suas conversas
CREATE OR REPLACE FUNCTION public.sync_contact_lead_status_to_conversations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só executar se lead_status realmente mudou
  IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
    -- Atualizar lead_status em conversas abertas/pending do contato
    UPDATE public.conversations
    SET lead_status = NEW.lead_status
    WHERE contact_id = NEW.id
      AND status IN ('open', 'pending');
    
    -- Log para debug (visível no Supabase Logs)
    RAISE LOG '[sync_contact_lead_status] contact_id=% status: % → % (updated % conversations)',
      NEW.id, 
      COALESCE(OLD.lead_status, 'NULL'), 
      COALESCE(NEW.lead_status, 'NULL'),
      (SELECT count(*) FROM conversations WHERE contact_id = NEW.id AND status IN ('open', 'pending'));
  END IF;
  
  RETURN NEW;
END;
$$;

-- Remover trigger se existir (para permitir re-execução)
DROP TRIGGER IF EXISTS trg_sync_contact_lead_status ON public.contacts;

-- Criar trigger AFTER UPDATE
CREATE TRIGGER trg_sync_contact_lead_status
  AFTER UPDATE OF lead_status ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_contact_lead_status_to_conversations();

-- Adicionar comentário explicativo
COMMENT ON FUNCTION public.sync_contact_lead_status_to_conversations() IS 
'Sincroniza automaticamente o lead_status do contato para conversas abertas/pending. 
Criado para resolver inconsistência entre contacts.lead_status e conversations.lead_status 
quando automações alteram o status.';