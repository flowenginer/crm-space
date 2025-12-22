-- =============================================
-- FASE 2K: Tabelas que faltavam
-- =============================================

-- INTERNAL_NOTES (não foi aplicado corretamente)
ALTER TABLE public.internal_notes ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.internal_notes SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.internal_notes ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_internal_notes_tenant_id ON public.internal_notes(tenant_id);

-- CONVERSATION_EVENTS (não foi aplicado corretamente)
ALTER TABLE public.conversation_events ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.conversation_events SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.conversation_events ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_conversation_events_tenant_id ON public.conversation_events(tenant_id);

-- DAILY_METRICS
ALTER TABLE public.daily_metrics ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.daily_metrics SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.daily_metrics ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_daily_metrics_tenant_id ON public.daily_metrics(tenant_id);

-- LEAD_STATUS_HISTORY
ALTER TABLE public.lead_status_history ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.lead_status_history SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.lead_status_history ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_lead_status_history_tenant_id ON public.lead_status_history(tenant_id);

-- LEAD_ASSIGNMENT_HISTORY
ALTER TABLE public.lead_assignment_history ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.lead_assignment_history SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.lead_assignment_history ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_lead_assignment_history_tenant_id ON public.lead_assignment_history(tenant_id);

-- SCHEDULED_MESSAGES
ALTER TABLE public.scheduled_messages ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.scheduled_messages SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.scheduled_messages ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_tenant_id ON public.scheduled_messages(tenant_id);

-- META_AD_ACCOUNTS
ALTER TABLE public.meta_ad_accounts ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.meta_ad_accounts SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.meta_ad_accounts ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_tenant_id ON public.meta_ad_accounts(tenant_id);

-- META_CAMPAIGNS
ALTER TABLE public.meta_campaigns ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.meta_campaigns SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.meta_campaigns ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_meta_campaigns_tenant_id ON public.meta_campaigns(tenant_id);

-- FLOW_NODES
ALTER TABLE public.flow_nodes ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.flow_nodes SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.flow_nodes ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_flow_nodes_tenant_id ON public.flow_nodes(tenant_id);

-- ORDER_STATUSES
ALTER TABLE public.order_statuses ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.order_statuses SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.order_statuses ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_order_statuses_tenant_id ON public.order_statuses(tenant_id);

-- REQUIRED_FIELDS_RULES
ALTER TABLE public.required_fields_rules ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.required_fields_rules SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.required_fields_rules ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_required_fields_rules_tenant_id ON public.required_fields_rules(tenant_id);

-- PAYMENT_LINKS
ALTER TABLE public.payment_links ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.payment_links SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.payment_links ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_payment_links_tenant_id ON public.payment_links(tenant_id);

-- NOTIFICATION_SETTINGS
ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.notification_settings SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.notification_settings ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_notification_settings_tenant_id ON public.notification_settings(tenant_id);

-- GAMIFICATION_BADGES
ALTER TABLE public.gamification_badges ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.gamification_badges SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.gamification_badges ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_gamification_badges_tenant_id ON public.gamification_badges(tenant_id);

-- GAMIFICATION_BADGE_DEFINITIONS
ALTER TABLE public.gamification_badge_definitions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.gamification_badge_definitions SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.gamification_badge_definitions ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_gamification_badge_definitions_tenant_id ON public.gamification_badge_definitions(tenant_id);