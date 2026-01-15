-- Remover constraint antigo
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- Adicionar constraint atualizado com novos tipos de mensagem
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check 
CHECK (message_type = ANY (ARRAY[
  'text', 
  'audio', 
  'image', 
  'video', 
  'document', 
  'sticker', 
  'location', 
  'template',
  'button',
  'interactive'
]));