-- 1. Limpar webhook_logs antigos (mais de 3 dias)
DELETE FROM webhook_logs 
WHERE created_at < NOW() - INTERVAL '3 days';

-- 2. Criar índice crítico para listagem de conversas (se não existir)
CREATE INDEX IF NOT EXISTS idx_conversations_status_lastmsg 
ON conversations (status, last_message_at DESC NULLS LAST);

-- 3. Criar índice para webhook_logs (se não existir)
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created 
ON webhook_logs (created_at DESC);

-- 4. Criar índice para messages por conversa (se não existir)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
ON messages (conversation_id, created_at DESC);

-- 5. Configurar cron job para limpeza automática a cada 6 horas
SELECT cron.schedule(
  'cleanup-webhook-logs-auto',
  '0 */6 * * *',
  $$DELETE FROM webhook_logs WHERE created_at < NOW() - INTERVAL '3 days'$$
);