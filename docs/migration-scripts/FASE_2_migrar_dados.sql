-- ============================================
-- FASE 2: MIGRAÇÃO DE DADOS PARA SPACE SPORTS
-- ============================================
-- Execute este script no Supabase SQL Editor
-- Data: ____/____/________
-- Responsável: ________________
--
-- ATENÇÃO:
-- 1. Certifique-se que a FASE 1 foi executada com sucesso
-- 2. Este script DEVE ser executado em uma TRANSAÇÃO
-- 3. Se algo der errado, execute ROLLBACK imediatamente
-- ============================================

BEGIN;

-- Definir variáveis e executar migração
DO $$
DECLARE
  v_master_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  v_space_sports_id UUID := '11111111-1111-1111-1111-111111111111';
  v_count INTEGER;
  v_total INTEGER := 0;
BEGIN

  RAISE NOTICE '========================================';
  RAISE NOTICE 'INICIANDO MIGRAÇÃO DE DADOS';
  RAISE NOTICE 'De: MASTER_TENANT (%)' , v_master_tenant_id;
  RAISE NOTICE 'Para: Space Sports (%)', v_space_sports_id;
  RAISE NOTICE '========================================';

  -- ==========================================
  -- GRUPO 1: TABELAS DE USUÁRIOS
  -- ==========================================
  RAISE NOTICE '';
  RAISE NOTICE '--- GRUPO 1: TABELAS DE USUÁRIOS ---';

  UPDATE public.profiles SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'profiles: % registros', v_count;

  UPDATE public.user_departments SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'user_departments: % registros', v_count;

  UPDATE public.user_invites SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'user_invites: % registros', v_count;

  UPDATE public.user_quick_templates SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'user_quick_templates: % registros', v_count;

  UPDATE public.user_sessions SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'user_sessions: % registros', v_count;

  -- ==========================================
  -- GRUPO 2: TABELAS DE COMUNICAÇÃO
  -- ==========================================
  RAISE NOTICE '';
  RAISE NOTICE '--- GRUPO 2: TABELAS DE COMUNICAÇÃO ---';

  UPDATE public.contacts SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'contacts: % registros', v_count;

  UPDATE public.conversations SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'conversations: % registros', v_count;

  UPDATE public.messages SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'messages: % registros', v_count;

  UPDATE public.scheduled_messages SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'scheduled_messages: % registros', v_count;

  UPDATE public.message_templates SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'message_templates: % registros', v_count;

  -- ==========================================
  -- GRUPO 3: TABELAS DE CRM/VENDAS
  -- ==========================================
  RAISE NOTICE '';
  RAISE NOTICE '--- GRUPO 3: TABELAS DE CRM/VENDAS ---';

  UPDATE public.deals SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'deals: % registros', v_count;

  UPDATE public.pipelines SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'pipelines: % registros', v_count;

  UPDATE public.pipeline_stages SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'pipeline_stages: % registros', v_count;

  UPDATE public.orders SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'orders: % registros', v_count;

  UPDATE public.order_items SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'order_items: % registros', v_count;

  UPDATE public.order_payments SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'order_payments: % registros', v_count;

  UPDATE public.order_status_history SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'order_status_history: % registros', v_count;

  UPDATE public.order_statuses SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'order_statuses: % registros', v_count;

  UPDATE public.quotes SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'quotes: % registros', v_count;

  UPDATE public.quote_items SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'quote_items: % registros', v_count;

  -- ==========================================
  -- GRUPO 4: TABELAS DE PRODUTOS
  -- ==========================================
  RAISE NOTICE '';
  RAISE NOTICE '--- GRUPO 4: TABELAS DE PRODUTOS ---';

  UPDATE public.products SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'products: % registros', v_count;

  UPDATE public.product_catalogs SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'product_catalogs: % registros', v_count;

  UPDATE public.product_variations SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'product_variations: % registros', v_count;

  UPDATE public.product_templates SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'product_templates: % registros', v_count;

  UPDATE public.product_template_variations SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'product_template_variations: % registros', v_count;

  UPDATE public.product_attributes SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'product_attributes: % registros', v_count;

  UPDATE public.product_attribute_types SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'product_attribute_types: % registros', v_count;

  UPDATE public.product_attribute_values SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'product_attribute_values: % registros', v_count;

  UPDATE public.product_attribute_price_rules SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'product_attribute_price_rules: % registros', v_count;

  UPDATE public.inventory_movements SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'inventory_movements: % registros', v_count;

  UPDATE public.stores SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'stores: % registros', v_count;

  -- ==========================================
  -- GRUPO 5: TABELAS FINANCEIRAS
  -- ==========================================
  RAISE NOTICE '';
  RAISE NOTICE '--- GRUPO 5: TABELAS FINANCEIRAS ---';

  UPDATE public.financial_accounts SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'financial_accounts: % registros', v_count;

  UPDATE public.financial_categories SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'financial_categories: % registros', v_count;

  UPDATE public.financial_transactions SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'financial_transactions: % registros', v_count;

  UPDATE public.account_movements SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'account_movements: % registros', v_count;

  UPDATE public.payment_links SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'payment_links: % registros', v_count;

  -- ==========================================
  -- GRUPO 6: TABELAS DE CONFIGURAÇÃO
  -- ==========================================
  RAISE NOTICE '';
  RAISE NOTICE '--- GRUPO 6: TABELAS DE CONFIGURAÇÃO ---';

  UPDATE public.departments SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'departments: % registros', v_count;

  UPDATE public.role_definitions SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'role_definitions: % registros', v_count;

  UPDATE public.company_settings SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'company_settings: % registros', v_count;

  UPDATE public.close_reasons SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'close_reasons: % registros', v_count;

  UPDATE public.lead_statuses SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'lead_statuses: % registros', v_count;

  UPDATE public.tags SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'tags: % registros', v_count;

  UPDATE public.segments SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'segments: % registros', v_count;

  UPDATE public.whatsapp_channels SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'whatsapp_channels: % registros', v_count;

  UPDATE public.whatsapp_providers SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'whatsapp_providers: % registros', v_count;

  -- ==========================================
  -- GRUPO 7: TABELAS DE AUTOMAÇÃO
  -- ==========================================
  RAISE NOTICE '';
  RAISE NOTICE '--- GRUPO 7: TABELAS DE AUTOMAÇÃO ---';

  UPDATE public.chatbot_flows SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'chatbot_flows: % registros', v_count;

  UPDATE public.flow_nodes SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'flow_nodes: % registros', v_count;

  UPDATE public.flow_connections SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'flow_connections: % registros', v_count;

  UPDATE public.flow_executions SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'flow_executions: % registros', v_count;

  UPDATE public.flow_execution_logs SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'flow_execution_logs: % registros', v_count;

  UPDATE public.flow_node_templates SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'flow_node_templates: % registros', v_count;

  UPDATE public.bulk_dispatches SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'bulk_dispatches: % registros', v_count;

  UPDATE public.bulk_dispatch_contacts SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'bulk_dispatch_contacts: % registros', v_count;

  UPDATE public.rescue_templates SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'rescue_templates: % registros', v_count;

  UPDATE public.rescue_scheduled_messages SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'rescue_scheduled_messages: % registros', v_count;

  UPDATE public.active_rescues SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'active_rescues: % registros', v_count;

  -- ==========================================
  -- GRUPO 8: TABELAS DE EMAIL
  -- ==========================================
  RAISE NOTICE '';
  RAISE NOTICE '--- GRUPO 8: TABELAS DE EMAIL ---';

  UPDATE public.internal_emails SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'internal_emails: % registros', v_count;

  UPDATE public.internal_email_recipients SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'internal_email_recipients: % registros', v_count;

  UPDATE public.internal_email_attachments SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'internal_email_attachments: % registros', v_count;

  UPDATE public.internal_email_labels SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'internal_email_labels: % registros', v_count;

  UPDATE public.email_shared_boxes SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'email_shared_boxes: % registros', v_count;

  UPDATE public.email_shared_box_members SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'email_shared_box_members: % registros', v_count;

  UPDATE public.email_visibility_rules SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'email_visibility_rules: % registros', v_count;

  UPDATE public.email_activity_log SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'email_activity_log: % registros', v_count;

  -- ==========================================
  -- GRUPO 9: TABELAS DE LOGGING/TRACKING
  -- ==========================================
  RAISE NOTICE '';
  RAISE NOTICE '--- GRUPO 9: TABELAS DE LOGGING ---';

  UPDATE public.activity_log SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'activity_log: % registros', v_count;

  UPDATE public.conversation_events SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'conversation_events: % registros', v_count;

  UPDATE public.daily_metrics SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'daily_metrics: % registros', v_count;

  UPDATE public.contact_tags SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'contact_tags: % registros', v_count;

  UPDATE public.conversation_tags SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'conversation_tags: % registros', v_count;

  UPDATE public.deal_tags SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'deal_tags: % registros', v_count;

  UPDATE public.lead_status_history SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'lead_status_history: % registros', v_count;

  UPDATE public.lead_assignment_history SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'lead_assignment_history: % registros', v_count;

  -- ==========================================
  -- GRUPO 10: TABELAS DE GAMIFICATION
  -- ==========================================
  RAISE NOTICE '';
  RAISE NOTICE '--- GRUPO 10: TABELAS DE GAMIFICATION ---';

  UPDATE public.gamification_profiles SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'gamification_profiles: % registros', v_count;

  UPDATE public.gamification_badges SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'gamification_badges: % registros', v_count;

  UPDATE public.gamification_rankings SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'gamification_rankings: % registros', v_count;

  UPDATE public.gamification_badge_definitions SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'gamification_badge_definitions: % registros', v_count;

  UPDATE public.gamification_events SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'gamification_events: % registros', v_count;

  UPDATE public.gamification_settings SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'gamification_settings: % registros', v_count;

  UPDATE public.gamification_points SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'gamification_points: % registros', v_count;

  -- ==========================================
  -- GRUPO 11: TABELAS DE INTEGRAÇÕES
  -- ==========================================
  RAISE NOTICE '';
  RAISE NOTICE '--- GRUPO 11: TABELAS DE INTEGRAÇÕES ---';

  UPDATE public.meta_ad_accounts SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'meta_ad_accounts: % registros', v_count;

  UPDATE public.meta_campaigns SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'meta_campaigns: % registros', v_count;

  UPDATE public.meta_adsets SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'meta_adsets: % registros', v_count;

  UPDATE public.meta_ads SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'meta_ads: % registros', v_count;

  UPDATE public.meta_campaign_insights SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'meta_campaign_insights: % registros', v_count;

  UPDATE public.webhook_configs SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'webhook_configs: % registros', v_count;

  UPDATE public.webhook_deliveries SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'webhook_deliveries: % registros', v_count;

  UPDATE public.webhook_logs SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'webhook_logs: % registros', v_count;

  -- ==========================================
  -- GRUPO 12: TABELAS AUXILIARES
  -- ==========================================
  RAISE NOTICE '';
  RAISE NOTICE '--- GRUPO 12: TABELAS AUXILIARES ---';

  UPDATE public.custom_field_definitions SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'custom_field_definitions: % registros', v_count;

  UPDATE public.space_memory SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'space_memory: % registros', v_count;

  UPDATE public.template_folders SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'template_folders: % registros', v_count;

  UPDATE public.queues SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'queues: % registros', v_count;

  UPDATE public.queue_agents SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'queue_agents: % registros', v_count;

  UPDATE public.required_fields_rules SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'required_fields_rules: % registros', v_count;

  UPDATE public.ad_message_patterns SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'ad_message_patterns: % registros', v_count;

  UPDATE public.availability_release_requests SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'availability_release_requests: % registros', v_count;

  UPDATE public.shared_conversations SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'shared_conversations: % registros', v_count;

  UPDATE public.pinned_conversations SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'pinned_conversations: % registros', v_count;

  UPDATE public.contact_requests SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'contact_requests: % registros', v_count;

  UPDATE public.contact_merge_log SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'contact_merge_log: % registros', v_count;

  UPDATE public.import_history SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'import_history: % registros', v_count;

  UPDATE public.notification_settings SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'notification_settings: % registros', v_count;

  UPDATE public.tenant_notification_config SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'tenant_notification_config: % registros', v_count;

  UPDATE public.quote_expiration_notifications SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'quote_expiration_notifications: % registros', v_count;

  UPDATE public.call_logs SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'call_logs: % registros', v_count;

  UPDATE public.call_results SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'call_results: % registros', v_count;

  UPDATE public.internal_chat_threads SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'internal_chat_threads: % registros', v_count;

  UPDATE public.internal_chat_messages SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'internal_chat_messages: % registros', v_count;

  UPDATE public.internal_chat_participants SET tenant_id = v_space_sports_id WHERE tenant_id = v_master_tenant_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  v_total := v_total + v_count;
  RAISE NOTICE 'internal_chat_participants: % registros', v_count;

  -- ==========================================
  -- NOTA: Tabelas que NÃO são migradas:
  -- - menu_items (mantém no MASTER como catálogo base)
  -- - tenants (tabela de controle)
  -- - tenant_modules (já criados separadamente)
  -- - user_roles (roles globais)
  -- ==========================================

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MIGRAÇÃO CONCLUÍDA!';
  RAISE NOTICE 'Total de registros migrados: %', v_total;
  RAISE NOTICE '========================================';

END $$;

-- ==========================================
-- VERIFICAÇÃO PÓS-MIGRAÇÃO
-- ==========================================

-- Verificar dados no Space Sports
SELECT
  'Dados no Space Sports (após migração)' as info,
  (SELECT COUNT(*) FROM contacts WHERE tenant_id = '11111111-1111-1111-1111-111111111111') as contacts,
  (SELECT COUNT(*) FROM conversations WHERE tenant_id = '11111111-1111-1111-1111-111111111111') as conversations,
  (SELECT COUNT(*) FROM profiles WHERE tenant_id = '11111111-1111-1111-1111-111111111111') as profiles,
  (SELECT COUNT(*) FROM orders WHERE tenant_id = '11111111-1111-1111-1111-111111111111') as orders,
  (SELECT COUNT(*) FROM deals WHERE tenant_id = '11111111-1111-1111-1111-111111111111') as deals,
  (SELECT COUNT(*) FROM products WHERE tenant_id = '11111111-1111-1111-1111-111111111111') as products;

-- Verificar se ainda há dados no MASTER_TENANT (não deveria ter, exceto menu_items)
SELECT
  'Dados restantes no MASTER_TENANT' as info,
  (SELECT COUNT(*) FROM contacts WHERE tenant_id = '00000000-0000-0000-0000-000000000001') as contacts,
  (SELECT COUNT(*) FROM conversations WHERE tenant_id = '00000000-0000-0000-0000-000000000001') as conversations,
  (SELECT COUNT(*) FROM profiles WHERE tenant_id = '00000000-0000-0000-0000-000000000001') as profiles,
  (SELECT COUNT(*) FROM menu_items WHERE tenant_id = '00000000-0000-0000-0000-000000000001') as menu_items_base;

-- ==========================================
-- SE TUDO ESTIVER OK, EXECUTE:
-- COMMIT;
--
-- SE ALGO DEU ERRADO, EXECUTE:
-- ROLLBACK;
-- ==========================================

-- Descomente a linha abaixo para confirmar:
-- COMMIT;
