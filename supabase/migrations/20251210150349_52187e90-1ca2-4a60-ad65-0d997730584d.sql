-- ============================================
-- FASE 2: ÍNDICES DE PERFORMANCE PARA O CHAT
-- ============================================

-- Índice para filtrar conversas por status e atribuição (muito usado na listagem)
CREATE INDEX IF NOT EXISTS idx_conversations_status_assigned 
ON conversations(status, assigned_to);

-- Índice para filtrar conversas por status e departamento
CREATE INDEX IF NOT EXISTS idx_conversations_status_department 
ON conversations(status, department_id);

-- Índice para ordenação por última mensagem (DESC para mais recentes primeiro)
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at_desc 
ON conversations(last_message_at DESC NULLS LAST);

-- Índice para filtrar conversas por canal
CREATE INDEX IF NOT EXISTS idx_conversations_channel_status 
ON conversations(channel_id, status);

-- Índice para filtrar conversas por referral_source (Meta Ads vs Orgânico)
CREATE INDEX IF NOT EXISTS idx_conversations_referral_source 
ON conversations(referral_source, status);

-- Índice para mensagens por conversa (muito usado na paginação de mensagens)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC);

-- Índice para busca de contatos por telefone (usado no webhook e busca)
CREATE INDEX IF NOT EXISTS idx_contacts_phone 
ON contacts(phone);

-- Índice para busca de contatos por nome (ILIKE é case-insensitive)
CREATE INDEX IF NOT EXISTS idx_contacts_full_name_lower 
ON contacts(LOWER(full_name));

-- Índice para filtrar contatos por lead_status (usado no Kanban)
CREATE INDEX IF NOT EXISTS idx_contacts_lead_status 
ON contacts(lead_status);

-- Índice para contact_tags (muito usado nos filtros de etiquetas)
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact 
ON contact_tags(contact_id);

CREATE INDEX IF NOT EXISTS idx_contact_tags_tag 
ON contact_tags(tag_id);

-- Índice para conversas não lidas (filtro comum)
CREATE INDEX IF NOT EXISTS idx_conversations_unread 
ON conversations(is_unread, status) WHERE is_unread = true;

-- Índice para conversas com última mensagem do cliente (filtro "não respondido")
CREATE INDEX IF NOT EXISTS idx_conversations_not_replied 
ON conversations(last_message_is_from_me, status) WHERE last_message_is_from_me = false;

-- Índice composto para a query mais comum do chat (status + assigned + last_message)
CREATE INDEX IF NOT EXISTS idx_conversations_chat_main 
ON conversations(status, assigned_to, last_message_at DESC NULLS LAST);

-- Índice para conversation_events por conversa (usado em realtime)
CREATE INDEX IF NOT EXISTS idx_conversation_events_conversation 
ON conversation_events(conversation_id, created_at DESC);

-- Índice para internal_notes por conversa
CREATE INDEX IF NOT EXISTS idx_internal_notes_conversation 
ON internal_notes(conversation_id);

-- Análise de estatísticas para o query planner
ANALYZE conversations;
ANALYZE messages;
ANALYZE contacts;
ANALYZE contact_tags;