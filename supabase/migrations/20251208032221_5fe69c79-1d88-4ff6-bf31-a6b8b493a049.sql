-- =====================================================
-- LIMPEZA DE CONVERSAS DUPLICADAS
-- Mantém a conversa mais recente para cada contact_id + channel_id
-- e fecha/deleta as duplicatas
-- =====================================================

-- Primeiro, identificar e fechar as conversas duplicadas (manter a mais recente de cada grupo)
WITH duplicates AS (
  SELECT id, contact_id, channel_id, status, created_at,
         ROW_NUMBER() OVER (
           PARTITION BY contact_id, channel_id 
           ORDER BY last_message_at DESC NULLS LAST, created_at DESC
         ) as rn
  FROM conversations
  WHERE status IN ('open', 'pending')
    AND channel_id IS NOT NULL
)
UPDATE conversations
SET status = 'closed',
    closed_at = NOW(),
    close_reason = 'duplicate_cleanup'
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- =====================================================
-- CRIAR ÍNDICE ÚNICO PARCIAL
-- Previne que existam 2 conversas abertas para o mesmo contact+channel
-- =====================================================
CREATE UNIQUE INDEX IF NOT EXISTS conversations_contact_channel_open_unique 
ON conversations (contact_id, channel_id) 
WHERE status IN ('open', 'pending') AND channel_id IS NOT NULL;