-- Adicionar coluna de nível de permissão ao compartilhamento
ALTER TABLE public.shared_conversations 
ADD COLUMN permission_level TEXT NOT NULL DEFAULT 'view' 
CHECK (permission_level IN ('view', 'edit'));

-- Comentário para documentação
COMMENT ON COLUMN public.shared_conversations.permission_level IS 
  'view = só visualização, edit = pode enviar mensagens';