-- Remove o default fixo incorreto
ALTER TABLE public.pinned_conversations ALTER COLUMN tenant_id DROP DEFAULT;

-- Adiciona trigger para atribuir tenant_id automaticamente
CREATE TRIGGER set_pinned_conversations_tenant_id
  BEFORE INSERT ON public.pinned_conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id_from_user();