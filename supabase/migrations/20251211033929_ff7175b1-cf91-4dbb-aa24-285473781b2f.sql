-- Índices para melhorar performance de queries frequentes
-- 1. Índice composto para filtros de conversas (status + assigned_to)
CREATE INDEX IF NOT EXISTS idx_conversations_status_assigned 
ON conversations(status, assigned_to) 
WHERE status IN ('open', 'pending');

-- 2. Índice para lead_status em contacts (usado no Kanban)
CREATE INDEX IF NOT EXISTS idx_contacts_lead_status 
ON contacts(lead_status) 
WHERE lead_status IS NOT NULL;

-- 3. Índice para messages por conversation_id excluindo deletadas
CREATE INDEX IF NOT EXISTS idx_messages_conversation_active 
ON messages(conversation_id, created_at DESC) 
WHERE is_deleted IS NOT TRUE;

-- 4. Índice para department_id em conversas
CREATE INDEX IF NOT EXISTS idx_conversations_department 
ON conversations(department_id) 
WHERE department_id IS NOT NULL;

-- 5. Índice para channel_id em conversas
CREATE INDEX IF NOT EXISTS idx_conversations_channel 
ON conversations(channel_id) 
WHERE channel_id IS NOT NULL;

-- 6. Índice composto para ordenação comum (last_message_at)
CREATE INDEX IF NOT EXISTS idx_conversations_last_message 
ON conversations(last_message_at DESC NULLS LAST) 
WHERE status IN ('open', 'pending');

-- 7. Índice para is_unread (usado em contagens)
CREATE INDEX IF NOT EXISTS idx_conversations_unread 
ON conversations(is_unread) 
WHERE is_unread = true AND status IN ('open', 'pending');

-- 8. Índice para referral_source (filtro de origem)
CREATE INDEX IF NOT EXISTS idx_conversations_referral 
ON conversations(referral_source) 
WHERE referral_source IS NOT NULL;