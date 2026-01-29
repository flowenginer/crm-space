-- =====================================================
-- CORREÇÃO DE POLÍTICAS RLS - WITH CHECK FALTANDO
-- Parte 2: Tabelas D-L
-- =====================================================

ALTER POLICY "Tenant isolation for daily_metrics" ON daily_metrics 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for deal_tags" ON deal_tags 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for deals" ON deals 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for email_activity_log" ON email_activity_log 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for email_shared_box_members" ON email_shared_box_members 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for email_shared_boxes" ON email_shared_boxes 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for email_visibility_rules" ON email_visibility_rules 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for financial_accounts" ON financial_accounts 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for financial_categories" ON financial_categories 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for financial_transactions" ON financial_transactions 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for flow_connections" ON flow_connections 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for flow_execution_logs" ON flow_execution_logs 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for flow_executions" ON flow_executions 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for flow_nodes" ON flow_nodes 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for gamification_badge_definitions" ON gamification_badge_definitions 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for gamification_badges" ON gamification_badges 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for gamification_events" ON gamification_events 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for gamification_points" ON gamification_points 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for gamification_profiles" ON gamification_profiles 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for gamification_rankings" ON gamification_rankings 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for gamification_settings" ON gamification_settings 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for import_history" ON import_history 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for integration_api_keys" ON integration_api_keys 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for internal_chat_messages" ON internal_chat_messages 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for internal_chat_participants" ON internal_chat_participants 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for internal_chat_threads" ON internal_chat_threads 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for internal_email_attachments" ON internal_email_attachments 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for internal_email_labels" ON internal_email_labels 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for internal_email_recipients" ON internal_email_recipients 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for internal_emails" ON internal_emails 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for internal_notes" ON internal_notes 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for inventory_movements" ON inventory_movements 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for lead_assignment_history" ON lead_assignment_history 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for lead_status_history" ON lead_status_history 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for lead_statuses" ON lead_statuses 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));