-- =============================================
-- FASE 2H: Tabelas restantes
-- =============================================

-- IMPORT_HISTORY (nome correto)
ALTER TABLE public.import_history ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.import_history SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.import_history ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.import_history ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_import_history_tenant_id ON public.import_history(tenant_id);

-- RESCUE_SCHEDULED_MESSAGES
ALTER TABLE public.rescue_scheduled_messages ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.rescue_scheduled_messages SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.rescue_scheduled_messages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.rescue_scheduled_messages ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_rescue_scheduled_messages_tenant_id ON public.rescue_scheduled_messages(tenant_id);

-- INTERNAL_CHAT_MESSAGES
ALTER TABLE public.internal_chat_messages ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.internal_chat_messages SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.internal_chat_messages ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.internal_chat_messages ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_internal_chat_messages_tenant_id ON public.internal_chat_messages(tenant_id);

-- INTERNAL_CHAT_THREADS
ALTER TABLE public.internal_chat_threads ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.internal_chat_threads SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.internal_chat_threads ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.internal_chat_threads ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_internal_chat_threads_tenant_id ON public.internal_chat_threads(tenant_id);

-- INTERNAL_CHAT_PARTICIPANTS
ALTER TABLE public.internal_chat_participants ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.internal_chat_participants SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.internal_chat_participants ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.internal_chat_participants ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_internal_chat_participants_tenant_id ON public.internal_chat_participants(tenant_id);

-- GAMIFICATION TABLES
ALTER TABLE public.gamification_events ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.gamification_events SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.gamification_events ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.gamification_events ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_gamification_events_tenant_id ON public.gamification_events(tenant_id);

ALTER TABLE public.gamification_points ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.gamification_points SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.gamification_points ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.gamification_points ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_gamification_points_tenant_id ON public.gamification_points(tenant_id);

ALTER TABLE public.gamification_profiles ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.gamification_profiles SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.gamification_profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.gamification_profiles ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_gamification_profiles_tenant_id ON public.gamification_profiles(tenant_id);

-- META TABLES
ALTER TABLE public.meta_ads ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.meta_ads SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.meta_ads ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.meta_ads ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_meta_ads_tenant_id ON public.meta_ads(tenant_id);

ALTER TABLE public.meta_adsets ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.meta_adsets SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.meta_adsets ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.meta_adsets ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_meta_adsets_tenant_id ON public.meta_adsets(tenant_id);

ALTER TABLE public.meta_campaign_insights ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.meta_campaign_insights SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.meta_campaign_insights ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.meta_campaign_insights ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001';
CREATE INDEX IF NOT EXISTS idx_meta_campaign_insights_tenant_id ON public.meta_campaign_insights(tenant_id);