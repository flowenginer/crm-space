-- =====================================================
-- OTIMIZAÇÃO DE PERFORMANCE: ÍNDICES COMPOSTOS
-- =====================================================

-- 1. Índice otimizado para mensagens no chat (CRÍTICO!)
CREATE INDEX IF NOT EXISTS idx_messages_conv_tenant_active 
ON messages (tenant_id, conversation_id, created_at DESC) 
WHERE is_deleted IS NOT TRUE;

-- 2. Índice para busca de última mensagem com dados inclusos
CREATE INDEX IF NOT EXISTS idx_messages_tenant_conv_last 
ON messages (tenant_id, conversation_id, created_at DESC NULLS LAST);

-- 3. Índice para queries do chat principal com todos filtros
CREATE INDEX IF NOT EXISTS idx_conversations_main_filters
ON conversations (tenant_id, status, assigned_to, department_id, last_message_at DESC NULLS LAST)
WHERE status IN ('open', 'pending');

-- 4. Índice para contagem rápida por origin/referral
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_origin
ON conversations (tenant_id, referral_source, status)
WHERE status IN ('open', 'pending');

-- 5. Índice para histórico de leads (melhora get_lead_journey_metrics)
CREATE INDEX IF NOT EXISTS idx_lead_status_history_contact_date
ON lead_status_history (contact_id, changed_at DESC);

-- 6. Índice para contatos por tenant e status
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_lead_status
ON contacts (tenant_id, lead_status, last_interaction_at DESC NULLS LAST);

-- 7. Atualizar estatísticas do planner
ANALYZE messages;
ANALYZE conversations;
ANALYZE contacts;
ANALYZE lead_status_history;