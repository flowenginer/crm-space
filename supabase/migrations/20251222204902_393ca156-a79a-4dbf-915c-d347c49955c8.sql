-- =============================================
-- FASE 2B: Adicionar tenant_id às tabelas OPERACIONAIS
-- =============================================

-- 9. BULK_DISPATCHES
ALTER TABLE public.bulk_dispatches ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.bulk_dispatches SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.bulk_dispatches ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.bulk_dispatches ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_bulk_dispatches_tenant_id ON public.bulk_dispatches(tenant_id);

-- 10. CHATBOT_FLOWS
ALTER TABLE public.chatbot_flows ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.chatbot_flows SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.chatbot_flows ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.chatbot_flows ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_chatbot_flows_tenant_id ON public.chatbot_flows(tenant_id);

-- 11. MESSAGE_TEMPLATES
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.message_templates SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.message_templates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.message_templates ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_message_templates_tenant_id ON public.message_templates(tenant_id);

-- 12. DEALS
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.deals SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.deals ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.deals ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_deals_tenant_id ON public.deals(tenant_id);

-- 13. PIPELINES
ALTER TABLE public.pipelines ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.pipelines SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.pipelines ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.pipelines ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_pipelines_tenant_id ON public.pipelines(tenant_id);

-- 14. PIPELINE_STAGES
ALTER TABLE public.pipeline_stages ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.pipeline_stages SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.pipeline_stages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.pipeline_stages ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_tenant_id ON public.pipeline_stages(tenant_id);

-- 15. RESCUE_TEMPLATES
ALTER TABLE public.rescue_templates ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.rescue_templates SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.rescue_templates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.rescue_templates ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_rescue_templates_tenant_id ON public.rescue_templates(tenant_id);

-- 16. ACTIVE_RESCUES
ALTER TABLE public.active_rescues ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.active_rescues SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.active_rescues ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.active_rescues ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_active_rescues_tenant_id ON public.active_rescues(tenant_id);