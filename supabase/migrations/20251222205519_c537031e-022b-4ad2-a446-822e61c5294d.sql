-- =============================================
-- FASE 2J: Trigger automático para setar tenant_id
-- =============================================

-- Função para setar tenant_id automaticamente no INSERT
CREATE OR REPLACE FUNCTION public.auto_set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se tenant_id não foi definido, pegar do perfil do usuário atual
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.get_user_tenant_id();
  END IF;
  
  -- Se ainda é NULL (edge function sem usuário), usar o default
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := '00000000-0000-0000-0000-000000000001';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Aplicar trigger nas tabelas principais
-- Note: Apenas tabelas que recebem INSERT frequente precisam do trigger

DROP TRIGGER IF EXISTS auto_set_tenant_id_contacts ON public.contacts;
CREATE TRIGGER auto_set_tenant_id_contacts
  BEFORE INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS auto_set_tenant_id_conversations ON public.conversations;
CREATE TRIGGER auto_set_tenant_id_conversations
  BEFORE INSERT ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS auto_set_tenant_id_messages ON public.messages;
CREATE TRIGGER auto_set_tenant_id_messages
  BEFORE INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS auto_set_tenant_id_deals ON public.deals;
CREATE TRIGGER auto_set_tenant_id_deals
  BEFORE INSERT ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS auto_set_tenant_id_bulk_dispatches ON public.bulk_dispatches;
CREATE TRIGGER auto_set_tenant_id_bulk_dispatches
  BEFORE INSERT ON public.bulk_dispatches
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS auto_set_tenant_id_scheduled_messages ON public.scheduled_messages;
CREATE TRIGGER auto_set_tenant_id_scheduled_messages
  BEFORE INSERT ON public.scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS auto_set_tenant_id_call_logs ON public.call_logs;
CREATE TRIGGER auto_set_tenant_id_call_logs
  BEFORE INSERT ON public.call_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS auto_set_tenant_id_conversation_events ON public.conversation_events;
CREATE TRIGGER auto_set_tenant_id_conversation_events
  BEFORE INSERT ON public.conversation_events
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS auto_set_tenant_id_internal_notes ON public.internal_notes;
CREATE TRIGGER auto_set_tenant_id_internal_notes
  BEFORE INSERT ON public.internal_notes
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS auto_set_tenant_id_internal_chat_messages ON public.internal_chat_messages;
CREATE TRIGGER auto_set_tenant_id_internal_chat_messages
  BEFORE INSERT ON public.internal_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();