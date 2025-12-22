-- =============================================
-- FASE 2C: Adicionar tenant_id às tabelas de CONFIGURAÇÃO
-- =============================================

-- 17. CLOSE_REASONS
ALTER TABLE public.close_reasons ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.close_reasons SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.close_reasons ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.close_reasons ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_close_reasons_tenant_id ON public.close_reasons(tenant_id);

-- 18. CALL_RESULTS
ALTER TABLE public.call_results ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.call_results SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.call_results ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.call_results ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_call_results_tenant_id ON public.call_results(tenant_id);

-- 19. CALL_LOGS
ALTER TABLE public.call_logs ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.call_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.call_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.call_logs ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_call_logs_tenant_id ON public.call_logs(tenant_id);

-- 20. COMPANY_SETTINGS
ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.company_settings SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.company_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.company_settings ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_company_settings_tenant_id ON public.company_settings(tenant_id);

-- 21. CUSTOM_FIELD_DEFINITIONS
ALTER TABLE public.custom_field_definitions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.custom_field_definitions SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.custom_field_definitions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.custom_field_definitions ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_tenant_id ON public.custom_field_definitions(tenant_id);

-- 22. AD_MESSAGE_PATTERNS
ALTER TABLE public.ad_message_patterns ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.ad_message_patterns SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.ad_message_patterns ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.ad_message_patterns ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_ad_message_patterns_tenant_id ON public.ad_message_patterns(tenant_id);

-- 23. WEBHOOK_CONFIGS
ALTER TABLE public.webhook_configs ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.webhook_configs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.webhook_configs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.webhook_configs ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_webhook_configs_tenant_id ON public.webhook_configs(tenant_id);

-- 24. QUEUES
ALTER TABLE public.queues ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.queues SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.queues ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.queues ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_queues_tenant_id ON public.queues(tenant_id);