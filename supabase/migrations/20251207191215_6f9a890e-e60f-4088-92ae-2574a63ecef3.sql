-- Adicionar campo content_blocks para armazenar múltiplas mensagens em templates
ALTER TABLE message_templates 
ADD COLUMN IF NOT EXISTS content_blocks JSONB DEFAULT NULL;

-- Comentário explicando a estrutura
COMMENT ON COLUMN message_templates.content_blocks IS 'Array de blocos de mensagem: [{"type": "text", "content": "..."}, {"type": "media", "media_url": "...", "media_type": "image"}]';