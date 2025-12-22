-- =============================================
-- FASE 2A: Adicionar tenant_id às tabelas CORE
-- =============================================

-- 1. CONTACTS
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.contacts SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.contacts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.contacts ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON public.contacts(tenant_id);

-- 2. CONVERSATIONS
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.conversations SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.conversations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.conversations ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON public.conversations(tenant_id);

-- 3. MESSAGES
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.messages SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.messages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.messages ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON public.messages(tenant_id);

-- 4. WHATSAPP_CHANNELS
ALTER TABLE public.whatsapp_channels ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.whatsapp_channels SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.whatsapp_channels ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.whatsapp_channels ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_whatsapp_channels_tenant_id ON public.whatsapp_channels(tenant_id);

-- 5. DEPARTMENTS
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.departments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.departments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.departments ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_departments_tenant_id ON public.departments(tenant_id);

-- 6. TAGS
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.tags SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.tags ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.tags ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_tags_tenant_id ON public.tags(tenant_id);

-- 7. LEAD_STATUSES
ALTER TABLE public.lead_statuses ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.lead_statuses SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.lead_statuses ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.lead_statuses ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_lead_statuses_tenant_id ON public.lead_statuses(tenant_id);

-- 8. SEGMENTS
ALTER TABLE public.segments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.segments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.segments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.segments ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_segments_tenant_id ON public.segments(tenant_id);