-- =============================================
-- FASE 2E: Adicionar tenant_id às tabelas de FLOWS e restantes
-- =============================================

-- 33. FLOW_CONNECTIONS (ao invés de flow_edges)
ALTER TABLE public.flow_connections ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.flow_connections SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.flow_connections ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.flow_connections ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_flow_connections_tenant_id ON public.flow_connections(tenant_id);

-- 34. FLOW_EXECUTIONS
ALTER TABLE public.flow_executions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.flow_executions SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.flow_executions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.flow_executions ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_flow_executions_tenant_id ON public.flow_executions(tenant_id);

-- 35. FLOW_EXECUTION_LOGS
ALTER TABLE public.flow_execution_logs ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.flow_execution_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.flow_execution_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.flow_execution_logs ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_flow_execution_logs_tenant_id ON public.flow_execution_logs(tenant_id);

-- 36. FLOW_NODE_TEMPLATES
ALTER TABLE public.flow_node_templates ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.flow_node_templates SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.flow_node_templates ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.flow_node_templates ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_flow_node_templates_tenant_id ON public.flow_node_templates(tenant_id);

-- 37. SHARED_CONVERSATIONS
ALTER TABLE public.shared_conversations ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.shared_conversations SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.shared_conversations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.shared_conversations ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_shared_conversations_tenant_id ON public.shared_conversations(tenant_id);

-- 38. PINNED_CONVERSATIONS
ALTER TABLE public.pinned_conversations ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.pinned_conversations SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.pinned_conversations ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.pinned_conversations ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_pinned_conversations_tenant_id ON public.pinned_conversations(tenant_id);

-- 39. GAMIFICATION_RANKINGS
ALTER TABLE public.gamification_rankings ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.gamification_rankings SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.gamification_rankings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.gamification_rankings ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_gamification_rankings_tenant_id ON public.gamification_rankings(tenant_id);

-- 40. GAMIFICATION_SETTINGS
ALTER TABLE public.gamification_settings ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.gamification_settings SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.gamification_settings ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.gamification_settings ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_gamification_settings_tenant_id ON public.gamification_settings(tenant_id);