-- =============================================
-- FASE 1: ÍNDICES CRÍTICOS PARA PERFORMANCE
-- =============================================

-- Índice GIN para busca de texto em contatos (muito mais rápido que ILIKE)
CREATE INDEX IF NOT EXISTS idx_contacts_fullname_gin 
ON contacts USING gin (full_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_phone_gin 
ON contacts USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_contacts_email_gin 
ON contacts USING gin (email gin_trgm_ops);

-- Índice para ordenação por created_at (listagem de contatos)
CREATE INDEX IF NOT EXISTS idx_contacts_created_at_desc 
ON contacts (created_at DESC);

-- Índice para filtro por assigned_to
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to 
ON contacts (assigned_to) WHERE assigned_to IS NOT NULL;

-- Índice para filtro por department_id
CREATE INDEX IF NOT EXISTS idx_contacts_department_id 
ON contacts (department_id) WHERE department_id IS NOT NULL;

-- Índice para filtro por lead_status
CREATE INDEX IF NOT EXISTS idx_contacts_lead_status 
ON contacts (lead_status) WHERE lead_status IS NOT NULL;

-- Índice para filtro por state
CREATE INDEX IF NOT EXISTS idx_contacts_state 
ON contacts (state) WHERE state IS NOT NULL;

-- =============================================
-- ÍNDICES PARA CONTACT_TAGS
-- =============================================

-- Índice para lookup por contact_id (JOIN frequente)
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_id 
ON contact_tags (contact_id);

-- Índice para lookup por tag_id
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag_id 
ON contact_tags (tag_id);

-- =============================================
-- ÍNDICES PARA CONVERSATIONS
-- =============================================

-- Índice para conversas por assigned_to + status (listagem principal)
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_status 
ON conversations (assigned_to, status);

-- Índice para conversas por department + status
CREATE INDEX IF NOT EXISTS idx_conversations_dept_status 
ON conversations (department_id, status);

-- Índice parcial para conversas abertas (mais usado)
CREATE INDEX IF NOT EXISTS idx_conversations_open_last_message 
ON conversations (last_message_at DESC) 
WHERE status = 'open';

-- Índice para conversas por contact_id
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id 
ON conversations (contact_id);

-- Índice para conversas por channel_id
CREATE INDEX IF NOT EXISTS idx_conversations_channel_id 
ON conversations (channel_id) WHERE channel_id IS NOT NULL;

-- Índice para is_unread (filtro frequente)
CREATE INDEX IF NOT EXISTS idx_conversations_unread 
ON conversations (is_unread) WHERE is_unread = true;

-- =============================================
-- ÍNDICES PARA MESSAGES
-- =============================================

-- Índice para messages por conversation_id + created_at
CREATE INDEX IF NOT EXISTS idx_messages_conv_created 
ON messages (conversation_id, created_at DESC);

-- Índice para messages por contact_id
CREATE INDEX IF NOT EXISTS idx_messages_contact_id 
ON messages (contact_id) WHERE contact_id IS NOT NULL;

-- =============================================
-- ÍNDICES PARA CONVERSATION_TAGS
-- =============================================

CREATE INDEX IF NOT EXISTS idx_conversation_tags_conv_id 
ON conversation_tags (conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_tags_tag_id 
ON conversation_tags (tag_id);

-- =============================================
-- FASE 4: ATUALIZAR ESTATÍSTICAS
-- =============================================

ANALYZE contacts;
ANALYZE conversations;
ANALYZE messages;
ANALYZE contact_tags;
ANALYZE conversation_tags;

-- =============================================
-- FASE 5: LIMPAR WEBHOOK LOGS ANTIGOS (> 7 dias)
-- =============================================

DELETE FROM webhook_logs 
WHERE created_at < NOW() - INTERVAL '7 days';