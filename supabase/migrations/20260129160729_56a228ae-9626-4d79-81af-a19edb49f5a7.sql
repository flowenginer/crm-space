-- =====================================================
-- CORREÇÃO DE POLÍTICAS RLS - WITH CHECK FALTANDO
-- Parte 1: Tabelas A-C
-- =====================================================

ALTER POLICY "Tenant isolation for account_movements" ON account_movements 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for active_rescues" ON active_rescues 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for activity_log" ON activity_log 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for ad_message_patterns" ON ad_message_patterns 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for availability_release_requests" ON availability_release_requests 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for bling_id_mappings" ON bling_id_mappings 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for bling_integration_config" ON bling_integration_config 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for bling_sync_logs" ON bling_sync_logs 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for bulk_dispatch_contacts" ON bulk_dispatch_contacts 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for bulk_dispatches" ON bulk_dispatches 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for call_logs" ON call_logs 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for call_results" ON call_results 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for chatbot_flows" ON chatbot_flows 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for close_reasons" ON close_reasons 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for company_settings" ON company_settings 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for contact_merge_log" ON contact_merge_log 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for contact_requests" ON contact_requests 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for contact_tags" ON contact_tags 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for conversation_events" ON conversation_events 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for conversation_tags" ON conversation_tags 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for conversations" ON conversations 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for custom_field_definitions" ON custom_field_definitions 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));