-- Causa raiz: tenant_id DEFAULT fixo aponta para Space Sports (000...0001)
-- Isso faz o BEFORE INSERT trigger não sobrescrever (porque NEW.tenant_id já vem não-NULL)
-- Resultado: INSERT no tenant Master viola a política RESTRICTIVE de tenant.

ALTER TABLE public.internal_notes
  ALTER COLUMN tenant_id DROP DEFAULT;

ALTER TABLE public.conversation_tags
  ALTER COLUMN tenant_id DROP DEFAULT;

ALTER TABLE public.contact_tags
  ALTER COLUMN tenant_id DROP DEFAULT;

COMMENT ON COLUMN public.internal_notes.tenant_id IS 'Set by triggers (set_tenant_id_from_user/auto_set_tenant_id). No fixed default to avoid cross-tenant inserts.';
COMMENT ON COLUMN public.conversation_tags.tenant_id IS 'Set by trigger set_tenant_id_from_user. No fixed default to avoid cross-tenant inserts.';
COMMENT ON COLUMN public.contact_tags.tenant_id IS 'Set by trigger set_tenant_id_from_user. No fixed default to avoid cross-tenant inserts.';