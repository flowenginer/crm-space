
-- Phase 3: Add tenant_id to remaining tables and create RLS policies

-- Add tenant_id to tables that don't have it
-- activity_log
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.activity_log SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.activity_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.activity_log ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- bulk_dispatch_contacts (get tenant from dispatch)
ALTER TABLE public.bulk_dispatch_contacts ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.bulk_dispatch_contacts bdc SET tenant_id = (
  SELECT bd.tenant_id FROM public.bulk_dispatches bd WHERE bd.id = bdc.dispatch_id
) WHERE bdc.tenant_id IS NULL;
UPDATE public.bulk_dispatch_contacts SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.bulk_dispatch_contacts ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.bulk_dispatch_contacts ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- contact_merge_log
ALTER TABLE public.contact_merge_log ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.contact_merge_log SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.contact_merge_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.contact_merge_log ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- contact_requests
ALTER TABLE public.contact_requests ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.contact_requests cr SET tenant_id = (
  SELECT c.tenant_id FROM public.contacts c WHERE c.id = cr.contact_id
) WHERE cr.tenant_id IS NULL;
UPDATE public.contact_requests SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.contact_requests ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.contact_requests ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- contact_tags
ALTER TABLE public.contact_tags ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.contact_tags ct SET tenant_id = (
  SELECT c.tenant_id FROM public.contacts c WHERE c.id = ct.contact_id
) WHERE ct.tenant_id IS NULL;
UPDATE public.contact_tags SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.contact_tags ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.contact_tags ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- conversation_tags
ALTER TABLE public.conversation_tags ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.conversation_tags ct SET tenant_id = (
  SELECT c.tenant_id FROM public.conversations c WHERE c.id = ct.conversation_id
) WHERE ct.tenant_id IS NULL;
UPDATE public.conversation_tags SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.conversation_tags ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.conversation_tags ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- deal_tags
ALTER TABLE public.deal_tags ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.deal_tags dt SET tenant_id = (
  SELECT d.tenant_id FROM public.deals d WHERE d.id = dt.deal_id
) WHERE dt.tenant_id IS NULL;
UPDATE public.deal_tags SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.deal_tags ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.deal_tags ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- email_activity_log
ALTER TABLE public.email_activity_log ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.email_activity_log eal SET tenant_id = (
  SELECT ie.tenant_id FROM public.internal_emails ie WHERE ie.id = eal.email_id
) WHERE eal.tenant_id IS NULL;
UPDATE public.email_activity_log SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.email_activity_log ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.email_activity_log ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- product_attributes
ALTER TABLE public.product_attributes ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.product_attributes pa SET tenant_id = (
  SELECT p.tenant_id FROM public.products p WHERE p.id = pa.product_id
) WHERE pa.tenant_id IS NULL;
UPDATE public.product_attributes SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.product_attributes ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.product_attributes ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- queue_agents
ALTER TABLE public.queue_agents ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.queue_agents qa SET tenant_id = (
  SELECT q.tenant_id FROM public.queues q WHERE q.id = qa.queue_id
) WHERE qa.tenant_id IS NULL;
UPDATE public.queue_agents SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.queue_agents ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.queue_agents ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_log_tenant_id ON public.activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bulk_dispatch_contacts_tenant_id ON public.bulk_dispatch_contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_merge_log_tenant_id ON public.contact_merge_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_tenant_id ON public.contact_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tenant_id ON public.contact_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversation_tags_tenant_id ON public.conversation_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deal_tags_tenant_id ON public.deal_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_activity_log_tenant_id ON public.email_activity_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_product_attributes_tenant_id ON public.product_attributes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_queue_agents_tenant_id ON public.queue_agents(tenant_id);
