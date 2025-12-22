-- =============================================
-- FASE 2I: Tabelas finais
-- =============================================

-- EMAIL TABLES
ALTER TABLE public.email_shared_boxes ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.email_shared_boxes SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.email_shared_boxes ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.email_shared_boxes ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_email_shared_boxes_tenant_id ON public.email_shared_boxes(tenant_id);

ALTER TABLE public.email_shared_box_members ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.email_shared_box_members SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.email_shared_box_members ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.email_shared_box_members ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_email_shared_box_members_tenant_id ON public.email_shared_box_members(tenant_id);

ALTER TABLE public.email_visibility_rules ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.email_visibility_rules SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.email_visibility_rules ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.email_visibility_rules ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_email_visibility_rules_tenant_id ON public.email_visibility_rules(tenant_id);

ALTER TABLE public.internal_email_attachments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.internal_email_attachments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.internal_email_attachments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.internal_email_attachments ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_internal_email_attachments_tenant_id ON public.internal_email_attachments(tenant_id);

ALTER TABLE public.internal_email_labels ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.internal_email_labels SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.internal_email_labels ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.internal_email_labels ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_internal_email_labels_tenant_id ON public.internal_email_labels(tenant_id);

ALTER TABLE public.internal_email_recipients ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.internal_email_recipients SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.internal_email_recipients ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.internal_email_recipients ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_internal_email_recipients_tenant_id ON public.internal_email_recipients(tenant_id);

-- MENU ITEMS
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.menu_items SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.menu_items ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.menu_items ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_menu_items_tenant_id ON public.menu_items(tenant_id);

-- TEMPLATE_FOLDERS
ALTER TABLE public.template_folders ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.template_folders SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.template_folders ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.template_folders ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_template_folders_tenant_id ON public.template_folders(tenant_id);

-- USER QUICK_TEMPLATES
ALTER TABLE public.user_quick_templates ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.user_quick_templates SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.user_quick_templates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_quick_templates ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_user_quick_templates_tenant_id ON public.user_quick_templates(tenant_id);

-- WHATSAPP_PROVIDERS
ALTER TABLE public.whatsapp_providers ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.whatsapp_providers SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.whatsapp_providers ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.whatsapp_providers ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_whatsapp_providers_tenant_id ON public.whatsapp_providers(tenant_id);

-- AVAILABILITY_RELEASE_REQUESTS
ALTER TABLE public.availability_release_requests ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.availability_release_requests SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.availability_release_requests ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.availability_release_requests ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_availability_release_requests_tenant_id ON public.availability_release_requests(tenant_id);

-- USER_INVITES
ALTER TABLE public.user_invites ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.user_invites SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.user_invites ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_invites ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_user_invites_tenant_id ON public.user_invites(tenant_id);