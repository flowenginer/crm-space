
-- =====================================================
-- FASE 2: REDUZIR FREQUÊNCIA DOS CRON JOBS
-- =====================================================

-- Alterar process-scheduled-messages para cada 5 minutos
SELECT cron.alter_job(1, schedule := '*/5 * * * *');

-- Alterar process-rescue-messages para cada 5 minutos
SELECT cron.alter_job(3, schedule := '*/5 * * * *');

-- =====================================================
-- FASE 4: REMOVER ÍNDICES NÃO UTILIZADOS (0 scans)
-- =====================================================

-- Índices duplicados ou não utilizados em messages (economiza ~19MB)
DROP INDEX IF EXISTS idx_messages_conv_tenant_active;
DROP INDEX IF EXISTS idx_messages_conversation_active;

-- Índices não utilizados em contacts (economiza ~5.5MB)
DROP INDEX IF EXISTS idx_contacts_full_name_lower;
DROP INDEX IF EXISTS idx_contacts_full_name_unaccent;
DROP INDEX IF EXISTS idx_contacts_email_gin;

-- Índices não utilizados em webhook_logs
DROP INDEX IF EXISTS idx_webhook_logs_unprocessed;

-- Índices não utilizados em redirect campaigns
DROP INDEX IF EXISTS idx_campaign_views_campaign_id;
DROP INDEX IF EXISTS idx_redirect_pageviews_campaign;

-- Índices não utilizados em gamification
DROP INDEX IF EXISTS idx_gamification_points_user_date;

-- Índices não utilizados em internal chat
DROP INDEX IF EXISTS idx_internal_chat_messages_created;

-- Índices não utilizados em conversations
DROP INDEX IF EXISTS idx_conversations_analysis_pending;

-- Índices não utilizados em meta sync
DROP INDEX IF EXISTS idx_meta_sync_logs_created_at;

-- Índices não utilizados em products
DROP INDEX IF EXISTS idx_products_search;
DROP INDEX IF EXISTS idx_variations_attribute_ids;

-- =====================================================
-- FASE 5: VACUUM ANALYZE nas tabelas críticas
-- =====================================================
ANALYZE messages;
ANALYZE conversations;
ANALYZE contacts;
ANALYZE profiles;
