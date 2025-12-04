-- =============================================
-- SPACE SPORTS CRM - MISSING TABLES & ENHANCEMENTS
-- Adding tables that don't exist yet
-- =============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================
-- 1. QUEUES (Filas de Atendimento) - NEW TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.queues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#8B5CF6',
  icon TEXT DEFAULT 'Users',
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  max_per_agent INTEGER DEFAULT 15,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  auto_assign BOOLEAN DEFAULT true,
  business_hours JSONB DEFAULT '{
    "monday": {"start": "08:00", "end": "18:00", "active": true},
    "tuesday": {"start": "08:00", "end": "18:00", "active": true},
    "wednesday": {"start": "08:00", "end": "18:00", "active": true},
    "thursday": {"start": "08:00", "end": "18:00", "active": true},
    "friday": {"start": "08:00", "end": "18:00", "active": true},
    "saturday": {"start": "08:00", "end": "12:00", "active": false},
    "sunday": {"start": "00:00", "end": "00:00", "active": false}
  }'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- =============================================
-- 2. QUEUE_AGENTS (Agentes por Fila) - NEW TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.queue_agents (
  queue_id UUID REFERENCES public.queues(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (queue_id, agent_id)
);

-- =============================================
-- 3. CONVERSATION_TAGS - NEW TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.conversation_tags (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (conversation_id, tag_id)
);

-- =============================================
-- 4. INTERNAL_NOTES - NEW TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.internal_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- =============================================
-- 5. DEAL_TAGS - NEW TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.deal_tags (
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (deal_id, tag_id)
);

-- =============================================
-- 6. SCHEDULED_MESSAGES - NEW TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES public.whatsapp_channels(id) NOT NULL,
  template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  variables JSONB DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ NOT NULL,
  recurrence_rule TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'sent', 'failed', 'cancelled')),
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- =============================================
-- 7. ACTIVITY_LOG - NEW TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- =============================================
-- 8. DAILY_METRICS - NEW TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.daily_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  new_contacts INTEGER DEFAULT 0,
  conversations_started INTEGER DEFAULT 0,
  conversations_closed INTEGER DEFAULT 0,
  conversations_transferred INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  messages_received INTEGER DEFAULT 0,
  avg_first_response_seconds INTEGER DEFAULT 0,
  avg_resolution_seconds INTEGER DEFAULT 0,
  sla_ok INTEGER DEFAULT 0,
  sla_warning INTEGER DEFAULT 0,
  sla_critical INTEGER DEFAULT 0,
  deals_created INTEGER DEFAULT 0,
  deals_won INTEGER DEFAULT 0,
  deals_lost INTEGER DEFAULT 0,
  revenue DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  UNIQUE (date, user_id)
);

-- =============================================
-- 9. COMPANY_SETTINGS - NEW TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT DEFAULT 'Space Sports',
  cnpj TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  business_hours JSONB DEFAULT '{
    "monday": {"start": "08:00", "end": "18:00", "active": true},
    "tuesday": {"start": "08:00", "end": "18:00", "active": true},
    "wednesday": {"start": "08:00", "end": "18:00", "active": true},
    "thursday": {"start": "08:00", "end": "18:00", "active": true},
    "friday": {"start": "08:00", "end": "18:00", "active": true},
    "saturday": {"start": "08:00", "end": "12:00", "active": false},
    "sunday": {"start": "00:00", "end": "00:00", "active": false}
  }'::jsonb,
  timezone TEXT DEFAULT 'America/Sao_Paulo',
  sla_first_response_minutes INTEGER DEFAULT 5,
  sla_resolution_minutes INTEGER DEFAULT 60,
  max_conversations_per_agent INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- =============================================
-- ADD MISSING COLUMNS TO EXISTING TABLES
-- =============================================

-- Add missing columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_conversations INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_conversations INTEGER DEFAULT 15;

-- Add missing columns to conversations
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS queue_id UUID REFERENCES public.queues(id);
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS sla_status TEXT DEFAULT 'ok';
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS close_reason TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS transferred_from UUID;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS transfer_note TEXT;

-- Add missing columns to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS origin_campaign TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Add missing columns to whatsapp_channels
ALTER TABLE public.whatsapp_channels ADD COLUMN IF NOT EXISTS messages_sent_today INTEGER DEFAULT 0;
ALTER TABLE public.whatsapp_channels ADD COLUMN IF NOT EXISTS messages_received_today INTEGER DEFAULT 0;

-- Add missing columns to deals
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id);
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS lost_reason TEXT;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS days_in_stage INTEGER DEFAULT 0;
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS stage_entered_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- Add missing columns to message_templates
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS shortcut TEXT;
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.message_templates ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id);

-- Add missing columns to custom_field_definitions
ALTER TABLE public.custom_field_definitions ADD COLUMN IF NOT EXISTS field_key TEXT;
ALTER TABLE public.custom_field_definitions ADD COLUMN IF NOT EXISTS default_value TEXT;
ALTER TABLE public.custom_field_definitions ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true;

-- =============================================
-- ENABLE RLS ON NEW TABLES
-- =============================================
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES FOR NEW TABLES
-- =============================================
CREATE POLICY "Authenticated access queues" ON public.queues FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access queue_agents" ON public.queue_agents FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access conversation_tags" ON public.conversation_tags FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access internal_notes" ON public.internal_notes FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access deal_tags" ON public.deal_tags FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access scheduled_messages" ON public.scheduled_messages FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access activity_log" ON public.activity_log FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access daily_metrics" ON public.daily_metrics FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated access company_settings" ON public.company_settings FOR ALL USING (auth.uid() IS NOT NULL);

-- =============================================
-- PERFORMANCE INDEXES
-- =============================================

-- Contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm ON public.contacts USING gin(phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON public.contacts USING gin(full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON public.contacts(lead_score DESC);

-- Conversations indexes
CREATE INDEX IF NOT EXISTS idx_conversations_queue ON public.conversations(queue_id) WHERE queue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_priority ON public.conversations(priority);
CREATE INDEX IF NOT EXISTS idx_conversations_sla ON public.conversations(sla_status) WHERE status = 'open';

-- Messages indexes  
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_pending ON public.messages(status) WHERE status IN ('pending', 'failed');

-- Deals indexes
CREATE INDEX IF NOT EXISTS idx_deals_stage_position ON public.deals(stage_id, order_position) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_deals_conversation ON public.deals(conversation_id) WHERE conversation_id IS NOT NULL;

-- Scheduled messages indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_pending ON public.scheduled_messages(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_scheduled_channel ON public.scheduled_messages(channel_id);

-- Activity log indexes
CREATE INDEX IF NOT EXISTS idx_activity_entity ON public.activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_user ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.activity_log(created_at DESC);

-- Daily metrics indexes
CREATE INDEX IF NOT EXISTS idx_metrics_date ON public.daily_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_user_date ON public.daily_metrics(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_metrics_dept_date ON public.daily_metrics(department_id, date DESC);

-- Tags relation indexes
CREATE INDEX IF NOT EXISTS idx_conversation_tags_conv ON public.conversation_tags(conversation_id);
CREATE INDEX IF NOT EXISTS idx_deal_tags_deal ON public.deal_tags(deal_id);

-- Templates indexes
CREATE INDEX IF NOT EXISTS idx_templates_shortcut ON public.message_templates(shortcut) WHERE shortcut IS NOT NULL;

-- =============================================
-- SEED DATA
-- =============================================

-- Company settings
INSERT INTO public.company_settings (company_name, timezone, sla_first_response_minutes, sla_resolution_minutes, max_conversations_per_agent)
VALUES ('Space Sports', 'America/Sao_Paulo', 5, 60, 15)
ON CONFLICT DO NOTHING;

-- Queues
INSERT INTO public.queues (name, description, color, icon, max_per_agent, priority, auto_assign) VALUES
  ('Vendas - Novos', 'Leads novos e primeiro atendimento', '#8B5CF6', 'UserPlus', 15, 'high', true),
  ('Vendas - Follow-up', 'Clientes em negociação', '#3B82F6', 'Clock', 20, 'medium', true),
  ('Pós-venda', 'Acompanhamento de pedidos', '#10B981', 'Package', 20, 'medium', true),
  ('Suporte', 'Dúvidas e problemas', '#F59E0B', 'Headphones', 10, 'high', true)
ON CONFLICT DO NOTHING;

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;