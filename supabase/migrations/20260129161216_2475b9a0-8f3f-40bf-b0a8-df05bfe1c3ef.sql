-- =====================================================
-- CORREÇÃO DE POLÍTICAS RLS - WITH CHECK FALTANDO
-- Parte 3: Tabelas M-Q
-- =====================================================

ALTER POLICY "Tenant isolation for marketing_action_logs" ON marketing_action_logs 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for menu_items" ON menu_items 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for meta_ads" ON meta_ads 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for meta_adsets" ON meta_adsets 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for meta_campaign_insights" ON meta_campaign_insights 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for meta_campaigns" ON meta_campaigns 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for meta_sync_logs" ON meta_sync_logs 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for notification_settings" ON notification_settings 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for order_items" ON order_items 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for order_payments" ON order_payments 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for order_status_history" ON order_status_history 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for order_statuses" ON order_statuses 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for orders" ON orders 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for payment_links" ON payment_links 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for pinned_conversations" ON pinned_conversations 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for pipeline_stages" ON pipeline_stages 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for pipelines" ON pipelines 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for product_attribute_price_rules" ON product_attribute_price_rules 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for product_attribute_types" ON product_attribute_types 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for product_attribute_values" ON product_attribute_values 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for product_attributes" ON product_attributes 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for product_catalogs" ON product_catalogs 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for product_template_variations" ON product_template_variations 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for product_templates" ON product_templates 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for product_variations" ON product_variations 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for variations" ON product_variations 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for queue_agents" ON queue_agents 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for queues" ON queues 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for quote_expiration_notifications" ON quote_expiration_notifications 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for quote_items" ON quote_items 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));

ALTER POLICY "Tenant isolation for quotes" ON quotes 
WITH CHECK ((tenant_id IS NULL) OR (tenant_id = get_user_tenant_id()));