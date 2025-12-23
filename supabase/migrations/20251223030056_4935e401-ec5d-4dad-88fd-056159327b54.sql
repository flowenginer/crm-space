
-- =====================================================
-- MIGRAÇÃO CRÍTICA: ISOLAMENTO MULTI-TENANT
-- =====================================================
-- Este script corrige a vulnerabilidade de vazamento de dados entre tenants

-- =====================================================
-- PARTE 1: ATUALIZAR FUNÇÕES AUXILIARES
-- =====================================================

-- 1.1 Atualizar is_admin_or_supervisor para verificar tenant
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.role IN ('admin', 'supervisor')
      AND p.tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid())
  )
$$;

-- 1.2 Atualizar can_view_all_data para filtrar por tenant
CREATE OR REPLACE FUNCTION public.can_view_all_data(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role text;
  user_flag boolean;
  dept_flag boolean;
  user_tenant_id uuid;
  caller_tenant_id uuid;
BEGIN
  -- Get the caller's tenant_id
  SELECT tenant_id INTO caller_tenant_id FROM profiles WHERE id = auth.uid();
  
  -- Get user info and verify same tenant
  SELECT role, can_view_all_conversations, tenant_id 
  INTO user_role, user_flag, user_tenant_id 
  FROM profiles WHERE id = _user_id;
  
  -- CRITICAL: Only allow if same tenant
  IF user_tenant_id IS DISTINCT FROM caller_tenant_id THEN
    RETURN FALSE;
  END IF;
  
  -- 1. Check role (admin/supervisor)
  IF user_role IN ('admin', 'supervisor') THEN
    RETURN TRUE;
  END IF;
  
  -- 2. Check user's individual flag
  IF user_flag = TRUE THEN
    RETURN TRUE;
  END IF;
  
  -- 3. Check user's departments (filtered by tenant)
  SELECT EXISTS (
    SELECT 1 FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = _user_id 
    AND d.can_view_all_conversations = TRUE
    AND d.tenant_id = caller_tenant_id
  ) INTO dept_flag;
  
  RETURN COALESCE(dept_flag, FALSE);
END;
$$;

-- 1.3 Atualizar get_user_accessible_departments para filtrar por tenant
CREATE OR REPLACE FUNCTION public.get_user_accessible_departments(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT dept_id) FILTER (WHERE dept_id IS NOT NULL),
    ARRAY[]::uuid[]
  )
  FROM (
    -- Departamentos via user_departments (filtered by tenant)
    SELECT ud.department_id as dept_id 
    FROM user_departments ud
    INNER JOIN departments d ON d.id = ud.department_id
    WHERE ud.user_id = _user_id
    AND d.tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
    UNION
    -- Departamento principal do perfil (filtered by tenant)
    SELECT p.department_id as dept_id 
    FROM profiles p 
    WHERE p.id = _user_id 
    AND p.department_id IS NOT NULL
    AND p.tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid())
  ) depts
$$;

-- =====================================================
-- PARTE 2: ADICIONAR POLICIES RESTRICTIVE DE TENANT ISOLATION
-- =====================================================

-- Helper: Drop policy if exists (to avoid errors)
CREATE OR REPLACE FUNCTION drop_policy_if_exists(policy_name text, table_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, table_name);
END;
$$;

-- Tabelas críticas que precisam de isolamento
-- Vamos criar policies RESTRICTIVE para garantir que SEMPRE filtre por tenant

-- 2.1 CONVERSATIONS
SELECT drop_policy_if_exists('Tenant isolation for conversations', 'conversations');
CREATE POLICY "Tenant isolation for conversations" ON conversations
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.2 CONTACTS
SELECT drop_policy_if_exists('Tenant isolation for contacts', 'contacts');
CREATE POLICY "Tenant isolation for contacts" ON contacts
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.3 MESSAGES
SELECT drop_policy_if_exists('Tenant isolation for messages', 'messages');
CREATE POLICY "Tenant isolation for messages" ON messages
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.4 PROFILES
SELECT drop_policy_if_exists('Tenant isolation for profiles', 'profiles');
CREATE POLICY "Tenant isolation for profiles" ON profiles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.5 DEPARTMENTS
SELECT drop_policy_if_exists('Tenant isolation for departments', 'departments');
CREATE POLICY "Tenant isolation for departments" ON departments
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.6 WHATSAPP_CHANNELS
SELECT drop_policy_if_exists('Tenant isolation for whatsapp_channels', 'whatsapp_channels');
CREATE POLICY "Tenant isolation for whatsapp_channels" ON whatsapp_channels
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.7 TAGS
SELECT drop_policy_if_exists('Tenant isolation for tags', 'tags');
CREATE POLICY "Tenant isolation for tags" ON tags
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.8 CONTACT_TAGS
SELECT drop_policy_if_exists('Tenant isolation for contact_tags', 'contact_tags');
CREATE POLICY "Tenant isolation for contact_tags" ON contact_tags
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.9 CONVERSATION_TAGS
SELECT drop_policy_if_exists('Tenant isolation for conversation_tags', 'conversation_tags');
CREATE POLICY "Tenant isolation for conversation_tags" ON conversation_tags
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.10 DEALS
SELECT drop_policy_if_exists('Tenant isolation for deals', 'deals');
CREATE POLICY "Tenant isolation for deals" ON deals
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.11 PIPELINES
SELECT drop_policy_if_exists('Tenant isolation for pipelines', 'pipelines');
CREATE POLICY "Tenant isolation for pipelines" ON pipelines
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.12 PIPELINE_STAGES
SELECT drop_policy_if_exists('Tenant isolation for pipeline_stages', 'pipeline_stages');
CREATE POLICY "Tenant isolation for pipeline_stages" ON pipeline_stages
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.13 ORDERS
SELECT drop_policy_if_exists('Tenant isolation for orders', 'orders');
CREATE POLICY "Tenant isolation for orders" ON orders
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.14 ORDER_ITEMS
SELECT drop_policy_if_exists('Tenant isolation for order_items', 'order_items');
CREATE POLICY "Tenant isolation for order_items" ON order_items
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.15 QUOTES
SELECT drop_policy_if_exists('Tenant isolation for quotes', 'quotes');
CREATE POLICY "Tenant isolation for quotes" ON quotes
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.16 QUOTE_ITEMS
SELECT drop_policy_if_exists('Tenant isolation for quote_items', 'quote_items');
CREATE POLICY "Tenant isolation for quote_items" ON quote_items
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.17 PRODUCTS
SELECT drop_policy_if_exists('Tenant isolation for products', 'products');
CREATE POLICY "Tenant isolation for products" ON products
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.18 PRODUCT_CATALOGS
SELECT drop_policy_if_exists('Tenant isolation for product_catalogs', 'product_catalogs');
CREATE POLICY "Tenant isolation for product_catalogs" ON product_catalogs
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.19 PRODUCT_VARIATIONS
SELECT drop_policy_if_exists('Tenant isolation for product_variations', 'product_variations');
CREATE POLICY "Tenant isolation for product_variations" ON product_variations
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.20 COMPANY_SETTINGS
SELECT drop_policy_if_exists('Tenant isolation for company_settings', 'company_settings');
CREATE POLICY "Tenant isolation for company_settings" ON company_settings
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.21 CLOSE_REASONS
SELECT drop_policy_if_exists('Tenant isolation for close_reasons', 'close_reasons');
CREATE POLICY "Tenant isolation for close_reasons" ON close_reasons
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.22 LEAD_STATUSES
SELECT drop_policy_if_exists('Tenant isolation for lead_statuses', 'lead_statuses');
CREATE POLICY "Tenant isolation for lead_statuses" ON lead_statuses
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.23 MESSAGE_TEMPLATES
SELECT drop_policy_if_exists('Tenant isolation for message_templates', 'message_templates');
CREATE POLICY "Tenant isolation for message_templates" ON message_templates
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.24 SEGMENTS
SELECT drop_policy_if_exists('Tenant isolation for segments', 'segments');
CREATE POLICY "Tenant isolation for segments" ON segments
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.25 QUEUES
SELECT drop_policy_if_exists('Tenant isolation for queues', 'queues');
CREATE POLICY "Tenant isolation for queues" ON queues
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.26 QUEUE_AGENTS
SELECT drop_policy_if_exists('Tenant isolation for queue_agents', 'queue_agents');
CREATE POLICY "Tenant isolation for queue_agents" ON queue_agents
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.27 ROLE_DEFINITIONS
SELECT drop_policy_if_exists('Tenant isolation for role_definitions', 'role_definitions');
CREATE POLICY "Tenant isolation for role_definitions" ON role_definitions
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.28 MENU_ITEMS
SELECT drop_policy_if_exists('Tenant isolation for menu_items', 'menu_items');
CREATE POLICY "Tenant isolation for menu_items" ON menu_items
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.29 USER_DEPARTMENTS
SELECT drop_policy_if_exists('Tenant isolation for user_departments', 'user_departments');
CREATE POLICY "Tenant isolation for user_departments" ON user_departments
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.30 CONVERSATION_EVENTS
SELECT drop_policy_if_exists('Tenant isolation for conversation_events', 'conversation_events');
CREATE POLICY "Tenant isolation for conversation_events" ON conversation_events
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.31 DAILY_METRICS
SELECT drop_policy_if_exists('Tenant isolation for daily_metrics', 'daily_metrics');
CREATE POLICY "Tenant isolation for daily_metrics" ON daily_metrics
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.32 CUSTOM_FIELD_DEFINITIONS
SELECT drop_policy_if_exists('Tenant isolation for custom_field_definitions', 'custom_field_definitions');
CREATE POLICY "Tenant isolation for custom_field_definitions" ON custom_field_definitions
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.33 CHATBOT_FLOWS
SELECT drop_policy_if_exists('Tenant isolation for chatbot_flows', 'chatbot_flows');
CREATE POLICY "Tenant isolation for chatbot_flows" ON chatbot_flows
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.34 FLOW_NODES
SELECT drop_policy_if_exists('Tenant isolation for flow_nodes', 'flow_nodes');
CREATE POLICY "Tenant isolation for flow_nodes" ON flow_nodes
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.35 FLOW_CONNECTIONS
SELECT drop_policy_if_exists('Tenant isolation for flow_connections', 'flow_connections');
CREATE POLICY "Tenant isolation for flow_connections" ON flow_connections
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.36 FLOW_EXECUTIONS
SELECT drop_policy_if_exists('Tenant isolation for flow_executions', 'flow_executions');
CREATE POLICY "Tenant isolation for flow_executions" ON flow_executions
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.37 FLOW_EXECUTION_LOGS
SELECT drop_policy_if_exists('Tenant isolation for flow_execution_logs', 'flow_execution_logs');
CREATE POLICY "Tenant isolation for flow_execution_logs" ON flow_execution_logs
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.38 FINANCIAL_ACCOUNTS
SELECT drop_policy_if_exists('Tenant isolation for financial_accounts', 'financial_accounts');
CREATE POLICY "Tenant isolation for financial_accounts" ON financial_accounts
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.39 FINANCIAL_CATEGORIES
SELECT drop_policy_if_exists('Tenant isolation for financial_categories', 'financial_categories');
CREATE POLICY "Tenant isolation for financial_categories" ON financial_categories
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.40 FINANCIAL_TRANSACTIONS
SELECT drop_policy_if_exists('Tenant isolation for financial_transactions', 'financial_transactions');
CREATE POLICY "Tenant isolation for financial_transactions" ON financial_transactions
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.41 ACCOUNT_MOVEMENTS
SELECT drop_policy_if_exists('Tenant isolation for account_movements', 'account_movements');
CREATE POLICY "Tenant isolation for account_movements" ON account_movements
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.42 PAYMENT_LINKS
SELECT drop_policy_if_exists('Tenant isolation for payment_links', 'payment_links');
CREATE POLICY "Tenant isolation for payment_links" ON payment_links
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.43 INTERNAL_EMAILS
SELECT drop_policy_if_exists('Tenant isolation for internal_emails', 'internal_emails');
CREATE POLICY "Tenant isolation for internal_emails" ON internal_emails
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.44 INTERNAL_EMAIL_RECIPIENTS
SELECT drop_policy_if_exists('Tenant isolation for internal_email_recipients', 'internal_email_recipients');
CREATE POLICY "Tenant isolation for internal_email_recipients" ON internal_email_recipients
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.45 INTERNAL_EMAIL_ATTACHMENTS
SELECT drop_policy_if_exists('Tenant isolation for internal_email_attachments', 'internal_email_attachments');
CREATE POLICY "Tenant isolation for internal_email_attachments" ON internal_email_attachments
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.46 INTERNAL_EMAIL_LABELS
SELECT drop_policy_if_exists('Tenant isolation for internal_email_labels', 'internal_email_labels');
CREATE POLICY "Tenant isolation for internal_email_labels" ON internal_email_labels
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.47 EMAIL_SHARED_BOXES
SELECT drop_policy_if_exists('Tenant isolation for email_shared_boxes', 'email_shared_boxes');
CREATE POLICY "Tenant isolation for email_shared_boxes" ON email_shared_boxes
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.48 EMAIL_SHARED_BOX_MEMBERS
SELECT drop_policy_if_exists('Tenant isolation for email_shared_box_members', 'email_shared_box_members');
CREATE POLICY "Tenant isolation for email_shared_box_members" ON email_shared_box_members
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.49 EMAIL_VISIBILITY_RULES
SELECT drop_policy_if_exists('Tenant isolation for email_visibility_rules', 'email_visibility_rules');
CREATE POLICY "Tenant isolation for email_visibility_rules" ON email_visibility_rules
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.50 EMAIL_ACTIVITY_LOG
SELECT drop_policy_if_exists('Tenant isolation for email_activity_log', 'email_activity_log');
CREATE POLICY "Tenant isolation for email_activity_log" ON email_activity_log
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.51 INTERNAL_CHAT_THREADS
SELECT drop_policy_if_exists('Tenant isolation for internal_chat_threads', 'internal_chat_threads');
CREATE POLICY "Tenant isolation for internal_chat_threads" ON internal_chat_threads
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.52 INTERNAL_CHAT_PARTICIPANTS
SELECT drop_policy_if_exists('Tenant isolation for internal_chat_participants', 'internal_chat_participants');
CREATE POLICY "Tenant isolation for internal_chat_participants" ON internal_chat_participants
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.53 INTERNAL_CHAT_MESSAGES
SELECT drop_policy_if_exists('Tenant isolation for internal_chat_messages', 'internal_chat_messages');
CREATE POLICY "Tenant isolation for internal_chat_messages" ON internal_chat_messages
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.54 INTERNAL_NOTES
SELECT drop_policy_if_exists('Tenant isolation for internal_notes', 'internal_notes');
CREATE POLICY "Tenant isolation for internal_notes" ON internal_notes
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.55 NOTIFICATION_SETTINGS
SELECT drop_policy_if_exists('Tenant isolation for notification_settings', 'notification_settings');
CREATE POLICY "Tenant isolation for notification_settings" ON notification_settings
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.56 SCHEDULED_MESSAGES
SELECT drop_policy_if_exists('Tenant isolation for scheduled_messages', 'scheduled_messages');
CREATE POLICY "Tenant isolation for scheduled_messages" ON scheduled_messages
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.57 RESCUE_TEMPLATES
SELECT drop_policy_if_exists('Tenant isolation for rescue_templates', 'rescue_templates');
CREATE POLICY "Tenant isolation for rescue_templates" ON rescue_templates
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.58 RESCUE_SCHEDULED_MESSAGES
SELECT drop_policy_if_exists('Tenant isolation for rescue_scheduled_messages', 'rescue_scheduled_messages');
CREATE POLICY "Tenant isolation for rescue_scheduled_messages" ON rescue_scheduled_messages
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.59 ACTIVE_RESCUES
SELECT drop_policy_if_exists('Tenant isolation for active_rescues', 'active_rescues');
CREATE POLICY "Tenant isolation for active_rescues" ON active_rescues
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.60 BULK_DISPATCHES
SELECT drop_policy_if_exists('Tenant isolation for bulk_dispatches', 'bulk_dispatches');
CREATE POLICY "Tenant isolation for bulk_dispatches" ON bulk_dispatches
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.61 BULK_DISPATCH_CONTACTS
SELECT drop_policy_if_exists('Tenant isolation for bulk_dispatch_contacts', 'bulk_dispatch_contacts');
CREATE POLICY "Tenant isolation for bulk_dispatch_contacts" ON bulk_dispatch_contacts
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.62 CALL_LOGS
SELECT drop_policy_if_exists('Tenant isolation for call_logs', 'call_logs');
CREATE POLICY "Tenant isolation for call_logs" ON call_logs
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.63 CALL_RESULTS
SELECT drop_policy_if_exists('Tenant isolation for call_results', 'call_results');
CREATE POLICY "Tenant isolation for call_results" ON call_results
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.64 ACTIVITY_LOG
SELECT drop_policy_if_exists('Tenant isolation for activity_log', 'activity_log');
CREATE POLICY "Tenant isolation for activity_log" ON activity_log
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.65 AD_MESSAGE_PATTERNS
SELECT drop_policy_if_exists('Tenant isolation for ad_message_patterns', 'ad_message_patterns');
CREATE POLICY "Tenant isolation for ad_message_patterns" ON ad_message_patterns
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.66 AVAILABILITY_RELEASE_REQUESTS
SELECT drop_policy_if_exists('Tenant isolation for availability_release_requests', 'availability_release_requests');
CREATE POLICY "Tenant isolation for availability_release_requests" ON availability_release_requests
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.67 CONTACT_MERGE_LOG
SELECT drop_policy_if_exists('Tenant isolation for contact_merge_log', 'contact_merge_log');
CREATE POLICY "Tenant isolation for contact_merge_log" ON contact_merge_log
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.68 CONTACT_REQUESTS
SELECT drop_policy_if_exists('Tenant isolation for contact_requests', 'contact_requests');
CREATE POLICY "Tenant isolation for contact_requests" ON contact_requests
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.69 DEAL_TAGS
SELECT drop_policy_if_exists('Tenant isolation for deal_tags', 'deal_tags');
CREATE POLICY "Tenant isolation for deal_tags" ON deal_tags
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.70 GAMIFICATION_SETTINGS
SELECT drop_policy_if_exists('Tenant isolation for gamification_settings', 'gamification_settings');
CREATE POLICY "Tenant isolation for gamification_settings" ON gamification_settings
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.71 GAMIFICATION_BADGE_DEFINITIONS
SELECT drop_policy_if_exists('Tenant isolation for gamification_badge_definitions', 'gamification_badge_definitions');
CREATE POLICY "Tenant isolation for gamification_badge_definitions" ON gamification_badge_definitions
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.72 GAMIFICATION_BADGES
SELECT drop_policy_if_exists('Tenant isolation for gamification_badges', 'gamification_badges');
CREATE POLICY "Tenant isolation for gamification_badges" ON gamification_badges
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.73 GAMIFICATION_EVENTS
SELECT drop_policy_if_exists('Tenant isolation for gamification_events', 'gamification_events');
CREATE POLICY "Tenant isolation for gamification_events" ON gamification_events
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.74 GAMIFICATION_POINTS
SELECT drop_policy_if_exists('Tenant isolation for gamification_points', 'gamification_points');
CREATE POLICY "Tenant isolation for gamification_points" ON gamification_points
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.75 GAMIFICATION_PROFILES
SELECT drop_policy_if_exists('Tenant isolation for gamification_profiles', 'gamification_profiles');
CREATE POLICY "Tenant isolation for gamification_profiles" ON gamification_profiles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.76 GAMIFICATION_RANKINGS
SELECT drop_policy_if_exists('Tenant isolation for gamification_rankings', 'gamification_rankings');
CREATE POLICY "Tenant isolation for gamification_rankings" ON gamification_rankings
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.77 IMPORT_HISTORY
SELECT drop_policy_if_exists('Tenant isolation for import_history', 'import_history');
CREATE POLICY "Tenant isolation for import_history" ON import_history
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.78 INVENTORY_MOVEMENTS
SELECT drop_policy_if_exists('Tenant isolation for inventory_movements', 'inventory_movements');
CREATE POLICY "Tenant isolation for inventory_movements" ON inventory_movements
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.79 LEAD_ASSIGNMENT_HISTORY
SELECT drop_policy_if_exists('Tenant isolation for lead_assignment_history', 'lead_assignment_history');
CREATE POLICY "Tenant isolation for lead_assignment_history" ON lead_assignment_history
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.80 LEAD_STATUS_HISTORY
SELECT drop_policy_if_exists('Tenant isolation for lead_status_history', 'lead_status_history');
CREATE POLICY "Tenant isolation for lead_status_history" ON lead_status_history
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.81 META_AD_ACCOUNTS
SELECT drop_policy_if_exists('Tenant isolation for meta_ad_accounts', 'meta_ad_accounts');
CREATE POLICY "Tenant isolation for meta_ad_accounts" ON meta_ad_accounts
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.82 META_CAMPAIGNS
SELECT drop_policy_if_exists('Tenant isolation for meta_campaigns', 'meta_campaigns');
CREATE POLICY "Tenant isolation for meta_campaigns" ON meta_campaigns
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.83 META_ADSETS
SELECT drop_policy_if_exists('Tenant isolation for meta_adsets', 'meta_adsets');
CREATE POLICY "Tenant isolation for meta_adsets" ON meta_adsets
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.84 META_ADS
SELECT drop_policy_if_exists('Tenant isolation for meta_ads', 'meta_ads');
CREATE POLICY "Tenant isolation for meta_ads" ON meta_ads
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.85 META_CAMPAIGN_INSIGHTS
SELECT drop_policy_if_exists('Tenant isolation for meta_campaign_insights', 'meta_campaign_insights');
CREATE POLICY "Tenant isolation for meta_campaign_insights" ON meta_campaign_insights
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.86 ORDER_PAYMENTS
SELECT drop_policy_if_exists('Tenant isolation for order_payments', 'order_payments');
CREATE POLICY "Tenant isolation for order_payments" ON order_payments
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.87 ORDER_STATUS_HISTORY
SELECT drop_policy_if_exists('Tenant isolation for order_status_history', 'order_status_history');
CREATE POLICY "Tenant isolation for order_status_history" ON order_status_history
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.88 ORDER_STATUSES
SELECT drop_policy_if_exists('Tenant isolation for order_statuses', 'order_statuses');
CREATE POLICY "Tenant isolation for order_statuses" ON order_statuses
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.89 PINNED_CONVERSATIONS
SELECT drop_policy_if_exists('Tenant isolation for pinned_conversations', 'pinned_conversations');
CREATE POLICY "Tenant isolation for pinned_conversations" ON pinned_conversations
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.90 PRODUCT_ATTRIBUTE_TYPES
SELECT drop_policy_if_exists('Tenant isolation for product_attribute_types', 'product_attribute_types');
CREATE POLICY "Tenant isolation for product_attribute_types" ON product_attribute_types
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.91 PRODUCT_ATTRIBUTE_VALUES
SELECT drop_policy_if_exists('Tenant isolation for product_attribute_values', 'product_attribute_values');
CREATE POLICY "Tenant isolation for product_attribute_values" ON product_attribute_values
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.92 PRODUCT_ATTRIBUTES
SELECT drop_policy_if_exists('Tenant isolation for product_attributes', 'product_attributes');
CREATE POLICY "Tenant isolation for product_attributes" ON product_attributes
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.93 PRODUCT_ATTRIBUTE_PRICE_RULES
SELECT drop_policy_if_exists('Tenant isolation for product_attribute_price_rules', 'product_attribute_price_rules');
CREATE POLICY "Tenant isolation for product_attribute_price_rules" ON product_attribute_price_rules
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.94 PRODUCT_TEMPLATES
SELECT drop_policy_if_exists('Tenant isolation for product_templates', 'product_templates');
CREATE POLICY "Tenant isolation for product_templates" ON product_templates
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.95 PRODUCT_TEMPLATE_VARIATIONS
SELECT drop_policy_if_exists('Tenant isolation for product_template_variations', 'product_template_variations');
CREATE POLICY "Tenant isolation for product_template_variations" ON product_template_variations
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.96 QUOTE_EXPIRATION_NOTIFICATIONS
SELECT drop_policy_if_exists('Tenant isolation for quote_expiration_notifications', 'quote_expiration_notifications');
CREATE POLICY "Tenant isolation for quote_expiration_notifications" ON quote_expiration_notifications
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.97 REQUIRED_FIELDS_RULES
SELECT drop_policy_if_exists('Tenant isolation for required_fields_rules', 'required_fields_rules');
CREATE POLICY "Tenant isolation for required_fields_rules" ON required_fields_rules
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.98 SHARED_CONVERSATIONS
SELECT drop_policy_if_exists('Tenant isolation for shared_conversations', 'shared_conversations');
CREATE POLICY "Tenant isolation for shared_conversations" ON shared_conversations
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.99 SPACE_MEMORY
SELECT drop_policy_if_exists('Tenant isolation for space_memory', 'space_memory');
CREATE POLICY "Tenant isolation for space_memory" ON space_memory
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.100 STORES
SELECT drop_policy_if_exists('Tenant isolation for stores', 'stores');
CREATE POLICY "Tenant isolation for stores" ON stores
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.101 TEMPLATE_FOLDERS
SELECT drop_policy_if_exists('Tenant isolation for template_folders', 'template_folders');
CREATE POLICY "Tenant isolation for template_folders" ON template_folders
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.102 TENANT_ADMINS
SELECT drop_policy_if_exists('Tenant isolation for tenant_admins', 'tenant_admins');
CREATE POLICY "Tenant isolation for tenant_admins" ON tenant_admins
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.103 TENANT_INVITATIONS
SELECT drop_policy_if_exists('Tenant isolation for tenant_invitations', 'tenant_invitations');
CREATE POLICY "Tenant isolation for tenant_invitations" ON tenant_invitations
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.104 TENANT_MODULES
SELECT drop_policy_if_exists('Tenant isolation for tenant_modules', 'tenant_modules');
CREATE POLICY "Tenant isolation for tenant_modules" ON tenant_modules
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.105 TENANT_NOTIFICATION_CONFIG
SELECT drop_policy_if_exists('Tenant isolation for tenant_notification_config', 'tenant_notification_config');
CREATE POLICY "Tenant isolation for tenant_notification_config" ON tenant_notification_config
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.106 USER_INVITES
SELECT drop_policy_if_exists('Tenant isolation for user_invites', 'user_invites');
CREATE POLICY "Tenant isolation for user_invites" ON user_invites
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.107 USER_QUICK_TEMPLATES
SELECT drop_policy_if_exists('Tenant isolation for user_quick_templates', 'user_quick_templates');
CREATE POLICY "Tenant isolation for user_quick_templates" ON user_quick_templates
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.108 USER_SESSIONS
SELECT drop_policy_if_exists('Tenant isolation for user_sessions', 'user_sessions');
CREATE POLICY "Tenant isolation for user_sessions" ON user_sessions
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.109 WEBHOOK_CONFIGS
SELECT drop_policy_if_exists('Tenant isolation for webhook_configs', 'webhook_configs');
CREATE POLICY "Tenant isolation for webhook_configs" ON webhook_configs
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.110 WEBHOOK_DELIVERIES
SELECT drop_policy_if_exists('Tenant isolation for webhook_deliveries', 'webhook_deliveries');
CREATE POLICY "Tenant isolation for webhook_deliveries" ON webhook_deliveries
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.111 WEBHOOK_LOGS
SELECT drop_policy_if_exists('Tenant isolation for webhook_logs', 'webhook_logs');
CREATE POLICY "Tenant isolation for webhook_logs" ON webhook_logs
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.112 WHATSAPP_PROVIDERS
SELECT drop_policy_if_exists('Tenant isolation for whatsapp_providers', 'whatsapp_providers');
CREATE POLICY "Tenant isolation for whatsapp_providers" ON whatsapp_providers
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- 2.113 FLOW_NODE_TEMPLATES
SELECT drop_policy_if_exists('Tenant isolation for flow_node_templates', 'flow_node_templates');
CREATE POLICY "Tenant isolation for flow_node_templates" ON flow_node_templates
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (tenant_id = get_user_tenant_id());

-- Cleanup: Drop helper function
DROP FUNCTION IF EXISTS drop_policy_if_exists(text, text);

-- =====================================================
-- PARTE 3: VERIFICAÇÃO
-- =====================================================
-- Após rodar, cada tenant só verá seus próprios dados
