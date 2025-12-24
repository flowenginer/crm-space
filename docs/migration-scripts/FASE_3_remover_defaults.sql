-- ============================================
-- FASE 3: REMOVER DEFAULTS DE MASTER_TENANT
-- ============================================
-- Execute este script no Supabase SQL Editor
-- Data: ____/____/________
-- Responsável: ________________
--
-- OBJETIVO: Remover os defaults que apontam para MASTER_TENANT
-- Isso força a aplicação a sempre definir tenant_id explicitamente
-- ============================================

-- GRUPO 1: Tabelas de usuários
ALTER TABLE public.profiles ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.user_departments ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.user_invites ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.user_quick_templates ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.user_sessions ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 2: Tabelas de comunicação
ALTER TABLE public.contacts ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.conversations ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.messages ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.scheduled_messages ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.message_templates ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 3: Tabelas de CRM/Vendas
ALTER TABLE public.deals ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.pipelines ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.pipeline_stages ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.orders ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.order_items ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.order_payments ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.order_status_history ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.order_statuses ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.quotes ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.quote_items ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 4: Tabelas de produtos
ALTER TABLE public.products ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_catalogs ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_variations ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_templates ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_template_variations ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_attributes ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_attribute_types ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_attribute_values ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.product_attribute_price_rules ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.inventory_movements ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.stores ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 5: Tabelas financeiras
ALTER TABLE public.financial_accounts ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.financial_categories ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.financial_transactions ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.account_movements ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.payment_links ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 6: Tabelas de configuração
ALTER TABLE public.departments ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.role_definitions ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.company_settings ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.close_reasons ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.lead_statuses ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.tags ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.segments ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.whatsapp_channels ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.whatsapp_providers ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 7: Tabelas de automação
ALTER TABLE public.chatbot_flows ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.flow_nodes ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.flow_connections ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.flow_executions ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.flow_execution_logs ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.flow_node_templates ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.bulk_dispatches ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.bulk_dispatch_contacts ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.rescue_templates ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.rescue_scheduled_messages ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.active_rescues ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 8: Tabelas de email
ALTER TABLE public.internal_emails ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.internal_email_recipients ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.internal_email_attachments ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.internal_email_labels ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.email_shared_boxes ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.email_shared_box_members ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.email_visibility_rules ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.email_activity_log ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 9: Tabelas de logging
ALTER TABLE public.activity_log ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.conversation_events ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.daily_metrics ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.contact_tags ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.conversation_tags ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.deal_tags ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.lead_status_history ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.lead_assignment_history ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 10: Tabelas de gamification
ALTER TABLE public.gamification_profiles ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.gamification_badges ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.gamification_rankings ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.gamification_badge_definitions ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.gamification_events ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.gamification_settings ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.gamification_points ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 11: Tabelas de integrações
ALTER TABLE public.meta_ad_accounts ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.meta_campaigns ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.meta_adsets ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.meta_ads ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.meta_campaign_insights ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.webhook_configs ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.webhook_deliveries ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.webhook_logs ALTER COLUMN tenant_id DROP DEFAULT;

-- GRUPO 12: Tabelas auxiliares
ALTER TABLE public.custom_field_definitions ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.space_memory ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.template_folders ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.queues ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.queue_agents ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.required_fields_rules ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.ad_message_patterns ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.availability_release_requests ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.shared_conversations ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.pinned_conversations ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.contact_requests ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.contact_merge_log ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.import_history ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.notification_settings ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.tenant_notification_config ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.quote_expiration_notifications ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.call_logs ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.call_results ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.internal_chat_threads ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.internal_chat_messages ALTER COLUMN tenant_id DROP DEFAULT;
ALTER TABLE public.internal_chat_participants ALTER COLUMN tenant_id DROP DEFAULT;

-- NOTA: menu_items MANTÉM o default pois é usado como catálogo base
-- NÃO executar: ALTER TABLE public.menu_items ALTER COLUMN tenant_id DROP DEFAULT;

-- ============================================
-- VERIFICAÇÃO
-- ============================================
SELECT
  table_name,
  column_name,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'tenant_id'
  AND column_default IS NOT NULL
ORDER BY table_name;

-- ============================================
-- FIM DA FASE 3
-- ============================================
