
-- Phase 3: Add tenant_id to remaining tables

-- role_definitions
ALTER TABLE public.role_definitions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.role_definitions SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.role_definitions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.role_definitions ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- space_memory
ALTER TABLE public.space_memory ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.space_memory SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.space_memory ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.space_memory ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- user_sessions
ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.user_sessions us SET tenant_id = (
  SELECT p.tenant_id FROM public.profiles p WHERE p.id = us.user_id
) WHERE us.tenant_id IS NULL;
UPDATE public.user_sessions SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.user_sessions ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_sessions ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- webhook_deliveries
ALTER TABLE public.webhook_deliveries ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.webhook_deliveries wd SET tenant_id = (
  SELECT wc.tenant_id FROM public.webhook_configs wc WHERE wc.id = wd.webhook_id
) WHERE wd.tenant_id IS NULL;
UPDATE public.webhook_deliveries SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.webhook_deliveries ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.webhook_deliveries ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- webhook_logs
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.webhook_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.webhook_logs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.webhook_logs ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- user_departments
ALTER TABLE public.user_departments ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
UPDATE public.user_departments ud SET tenant_id = (
  SELECT p.tenant_id FROM public.profiles p WHERE p.id = ud.user_id
) WHERE ud.tenant_id IS NULL;
UPDATE public.user_departments SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE public.user_departments ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.user_departments ALTER COLUMN tenant_id SET DEFAULT '00000000-0000-0000-0000-000000000001'::uuid;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_role_definitions_tenant_id ON public.role_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_space_memory_tenant_id ON public.space_memory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_id ON public.user_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_tenant_id ON public.webhook_deliveries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_tenant_id ON public.webhook_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_tenant_id ON public.user_departments(tenant_id);

-- Now create RLS policies for these tables
DROP POLICY IF EXISTS "Tenant isolation for role_definitions" ON public.role_definitions;
CREATE POLICY "Tenant isolation for role_definitions"
ON public.role_definitions
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for space_memory" ON public.space_memory;
CREATE POLICY "Tenant isolation for space_memory"
ON public.space_memory
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for user_sessions" ON public.user_sessions;
CREATE POLICY "Tenant isolation for user_sessions"
ON public.user_sessions
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for webhook_deliveries" ON public.webhook_deliveries;
CREATE POLICY "Tenant isolation for webhook_deliveries"
ON public.webhook_deliveries
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for webhook_logs" ON public.webhook_logs;
CREATE POLICY "Tenant isolation for webhook_logs"
ON public.webhook_logs
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for user_departments" ON public.user_departments;
CREATE POLICY "Tenant isolation for user_departments"
ON public.user_departments
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

-- user_roles - tenant isolation via profile join
DROP POLICY IF EXISTS "Tenant isolation for user_roles" ON public.user_roles;
CREATE POLICY "Tenant isolation for user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles p 
  WHERE p.id = user_roles.user_id 
  AND p.tenant_id = get_user_tenant_id()
));

-- permission_definitions is global (same for all tenants)
-- tenants - users can only see their own tenant
DROP POLICY IF EXISTS "Users can view their own tenant" ON public.tenants;
CREATE POLICY "Users can view their own tenant"
ON public.tenants
FOR SELECT
USING (id = get_user_tenant_id());

-- Create remaining RLS policies for tables we created earlier
DROP POLICY IF EXISTS "Tenant isolation for pinned_conversations" ON public.pinned_conversations;
CREATE POLICY "Tenant isolation for pinned_conversations"
ON public.pinned_conversations
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for flow_execution_logs" ON public.flow_execution_logs;
CREATE POLICY "Tenant isolation for flow_execution_logs"
ON public.flow_execution_logs
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for flow_node_templates" ON public.flow_node_templates;
CREATE POLICY "Tenant isolation for flow_node_templates"
ON public.flow_node_templates
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for internal_chat_participants" ON public.internal_chat_participants;
CREATE POLICY "Tenant isolation for internal_chat_participants"
ON public.internal_chat_participants
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for internal_email_attachments" ON public.internal_email_attachments;
CREATE POLICY "Tenant isolation for internal_email_attachments"
ON public.internal_email_attachments
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for internal_email_labels" ON public.internal_email_labels;
CREATE POLICY "Tenant isolation for internal_email_labels"
ON public.internal_email_labels
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for internal_email_recipients" ON public.internal_email_recipients;
CREATE POLICY "Tenant isolation for internal_email_recipients"
ON public.internal_email_recipients
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for order_items" ON public.order_items;
CREATE POLICY "Tenant isolation for order_items"
ON public.order_items
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for order_payments" ON public.order_payments;
CREATE POLICY "Tenant isolation for order_payments"
ON public.order_payments
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for order_status_history" ON public.order_status_history;
CREATE POLICY "Tenant isolation for order_status_history"
ON public.order_status_history
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for product_attribute_price_rules" ON public.product_attribute_price_rules;
CREATE POLICY "Tenant isolation for product_attribute_price_rules"
ON public.product_attribute_price_rules
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for product_attribute_values" ON public.product_attribute_values;
CREATE POLICY "Tenant isolation for product_attribute_values"
ON public.product_attribute_values
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for product_template_variations" ON public.product_template_variations;
CREATE POLICY "Tenant isolation for product_template_variations"
ON public.product_template_variations
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for product_variations" ON public.product_variations;
CREATE POLICY "Tenant isolation for product_variations"
ON public.product_variations
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for quote_expiration_notifications" ON public.quote_expiration_notifications;
CREATE POLICY "Tenant isolation for quote_expiration_notifications"
ON public.quote_expiration_notifications
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for quote_items" ON public.quote_items;
CREATE POLICY "Tenant isolation for quote_items"
ON public.quote_items
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for rescue_scheduled_messages" ON public.rescue_scheduled_messages;
CREATE POLICY "Tenant isolation for rescue_scheduled_messages"
ON public.rescue_scheduled_messages
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for user_quick_templates" ON public.user_quick_templates;
CREATE POLICY "Tenant isolation for user_quick_templates"
ON public.user_quick_templates
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for user_invites" ON public.user_invites;
CREATE POLICY "Tenant isolation for user_invites"
ON public.user_invites
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for tenant_admins" ON public.tenant_admins;
CREATE POLICY "Tenant isolation for tenant_admins"
ON public.tenant_admins
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());

DROP POLICY IF EXISTS "Tenant isolation for tags" ON public.tags;
CREATE POLICY "Tenant isolation for tags"
ON public.tags
AS RESTRICTIVE
FOR ALL
USING (tenant_id = get_user_tenant_id());
