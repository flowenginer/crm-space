-- =====================================================
-- CORREÇÃO: Triggers de Tenant Isolation para 21 tabelas
-- =====================================================

-- 1. TABELAS COM PLACEHOLDER PROBLEMÁTICO (remover default + criar trigger)

-- satisfaction_config
ALTER TABLE satisfaction_config ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_satisfaction_config
BEFORE INSERT ON satisfaction_config
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- satisfaction_surveys
ALTER TABLE satisfaction_surveys ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_satisfaction_surveys
BEFORE INSERT ON satisfaction_surveys
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- conversation_analysis
ALTER TABLE conversation_analysis ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_conversation_analysis
BEFORE INSERT ON conversation_analysis
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- bling_integration_config
ALTER TABLE bling_integration_config ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_bling_integration_config
BEFORE INSERT ON bling_integration_config
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- bling_id_mappings
ALTER TABLE bling_id_mappings ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_bling_id_mappings
BEFORE INSERT ON bling_id_mappings
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- bling_sync_logs
ALTER TABLE bling_sync_logs ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_bling_sync_logs
BEFORE INSERT ON bling_sync_logs
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- meta_sync_logs
ALTER TABLE meta_sync_logs ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_meta_sync_logs
BEFORE INSERT ON meta_sync_logs
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- redirect_campaign_channels
ALTER TABLE redirect_campaign_channels ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_redirect_campaign_channels
BEFORE INSERT ON redirect_campaign_channels
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- redirect_logs
ALTER TABLE redirect_logs ALTER COLUMN tenant_id DROP DEFAULT;
CREATE TRIGGER trigger_set_tenant_id_redirect_logs
BEFORE INSERT ON redirect_logs
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- 2. TABELAS SEM DEFAULT (apenas criar trigger)

-- support_tickets
CREATE TRIGGER trigger_set_tenant_id_support_tickets
BEFORE INSERT ON support_tickets
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- sales_evaluations
CREATE TRIGGER trigger_set_tenant_id_sales_evaluations
BEFORE INSERT ON sales_evaluations
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- sales_evaluation_targets
CREATE TRIGGER trigger_set_tenant_id_sales_evaluation_targets
BEFORE INSERT ON sales_evaluation_targets
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- cloudapi_configs
CREATE TRIGGER trigger_set_tenant_id_cloudapi_configs
BEFORE INSERT ON cloudapi_configs
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- integration_api_keys
CREATE TRIGGER trigger_set_tenant_id_integration_api_keys
BEFORE INSERT ON integration_api_keys
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- redirect_campaigns
CREATE TRIGGER trigger_set_tenant_id_redirect_campaigns
BEFORE INSERT ON redirect_campaigns
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- redirect_ab_tests
CREATE TRIGGER trigger_set_tenant_id_redirect_ab_tests
BEFORE INSERT ON redirect_ab_tests
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- redirect_ab_test_variants
CREATE TRIGGER trigger_set_tenant_id_redirect_ab_test_variants
BEFORE INSERT ON redirect_ab_test_variants
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- whatsapp_channel_events
CREATE TRIGGER trigger_set_tenant_id_whatsapp_channel_events
BEFORE INSERT ON whatsapp_channel_events
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- template_pricing
CREATE TRIGGER trigger_set_tenant_id_template_pricing
BEFORE INSERT ON template_pricing
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- meta_message_templates
CREATE TRIGGER trigger_set_tenant_id_meta_message_templates
BEFORE INSERT ON meta_message_templates
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();

-- marketing_action_logs
CREATE TRIGGER trigger_set_tenant_id_marketing_action_logs
BEFORE INSERT ON marketing_action_logs
FOR EACH ROW EXECUTE FUNCTION set_tenant_id_from_user();