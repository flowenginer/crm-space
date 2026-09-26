-- Preenche tenant_id de conversas/mensagens a partir do contato/conversa quando
-- o INSERT vem sem tenant_id (edge functions rodando como service_role).
--
-- Sem isso o trigger auto_set_tenant_id grava o tenant padrão
-- (00000000-0000-0000-0000-000000000001) e a conversa some da lista do tenant
-- real — caso do disparo em massa.
--
-- O nome começa com "a0_" para rodar ANTES de auto_set_tenant_id_* e
-- trg_set_tenant_id_* (triggers BEFORE disparam em ordem alfabética).

CREATE OR REPLACE FUNCTION public.fill_tenant_id_from_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'messages' AND NEW.conversation_id IS NOT NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM conversations WHERE id = NEW.conversation_id;
  END IF;

  IF NEW.tenant_id IS NULL AND NEW.contact_id IS NOT NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM contacts WHERE id = NEW.contact_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a0_fill_tenant_id_conversations ON public.conversations;
CREATE TRIGGER a0_fill_tenant_id_conversations
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.fill_tenant_id_from_parent();

DROP TRIGGER IF EXISTS a0_fill_tenant_id_messages ON public.messages;
CREATE TRIGGER a0_fill_tenant_id_messages
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.fill_tenant_id_from_parent();
