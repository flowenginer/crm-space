-- =====================================================
-- CORREÇÃO DE POLÍTICAS RLS - WITH CHECK FALTANDO
-- Parte 4: Tabelas R-Z (excluindo user_roles que não tem tenant_id)
-- =====================================================

ALTER POLICY "Tenant isolation for rede_oauth_tokens" ON rede_oauth_tokens 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for redirect_campaign_channels" ON redirect_campaign_channels 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for redirect_campaigns" ON redirect_campaigns 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for redirect_logs" ON redirect_logs 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for required_fields_rules" ON required_fields_rules 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for rescue_scheduled_messages" ON rescue_scheduled_messages 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for rescue_templates" ON rescue_templates 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for role_definitions" ON role_definitions 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for sales_evaluation_targets" ON sales_evaluation_targets 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for sales_evaluations" ON sales_evaluations 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for satisfaction_config" ON satisfaction_config 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for satisfaction_surveys" ON satisfaction_surveys 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for scheduled_messages" ON scheduled_messages 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for segments" ON segments 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for shared_conversations" ON shared_conversations 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for space_memory" ON space_memory 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for stores" ON stores 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for tags" ON tags 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for template_folders" ON template_folders 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for tenant_admins" ON tenant_admins 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for tenant_invitations" ON tenant_invitations 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for tenant_modules" ON tenant_modules 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for tenant_notification_config" ON tenant_notification_config 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for user_departments" ON user_departments 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for user_invites" ON user_invites 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for user_quick_templates" ON user_quick_templates 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for user_sessions" ON user_sessions 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for webhook_configs" ON webhook_configs 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for webhook_deliveries" ON webhook_deliveries 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for webhook_logs" ON webhook_logs 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));