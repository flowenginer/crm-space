-- Remover os defaults que estão causando o problema de isolamento multi-tenant
-- Isso permite que o trigger set_tenant_id_from_user atribua o tenant correto

ALTER TABLE public.message_templates 
ALTER COLUMN tenant_id DROP DEFAULT;

ALTER TABLE public.template_folders 
ALTER COLUMN tenant_id DROP DEFAULT;

ALTER TABLE public.user_quick_templates 
ALTER COLUMN tenant_id DROP DEFAULT;