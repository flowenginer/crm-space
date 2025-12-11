-- =============================================
-- CHAT INTERNO - Sistema de Mensagens entre Usuários
-- =============================================

-- Tabela de threads/conversas
CREATE TABLE internal_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_message_sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Tabela de participantes (relaciona usuários com threads)
CREATE TABLE internal_chat_participants (
  thread_id UUID NOT NULL REFERENCES internal_chat_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (thread_id, user_id)
);

-- Tabela de mensagens
CREATE TABLE internal_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES internal_chat_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text', -- text, image, video, audio, document, link
  media_url TEXT,
  media_name TEXT,
  media_mime_type TEXT,
  reply_to_message_id UUID REFERENCES internal_chat_messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_internal_chat_participants_user ON internal_chat_participants(user_id);
CREATE INDEX idx_internal_chat_participants_thread ON internal_chat_participants(thread_id);
CREATE INDEX idx_internal_chat_messages_thread ON internal_chat_messages(thread_id);
CREATE INDEX idx_internal_chat_messages_sender ON internal_chat_messages(sender_id);
CREATE INDEX idx_internal_chat_messages_created ON internal_chat_messages(created_at DESC);
CREATE INDEX idx_internal_chat_threads_last_message ON internal_chat_threads(last_message_at DESC);

-- Habilitar RLS
ALTER TABLE internal_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_chat_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para threads (usuário só vê threads onde participa)
CREATE POLICY "Users can view own threads"
ON internal_chat_threads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM internal_chat_participants
    WHERE thread_id = internal_chat_threads.id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can create threads"
ON internal_chat_threads FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own threads"
ON internal_chat_threads FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM internal_chat_participants
    WHERE thread_id = internal_chat_threads.id
    AND user_id = auth.uid()
  )
);

-- Políticas RLS para participantes
CREATE POLICY "Users can view participants of own threads"
ON internal_chat_participants FOR SELECT
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM internal_chat_participants p2
    WHERE p2.thread_id = internal_chat_participants.thread_id
    AND p2.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert participants"
ON internal_chat_participants FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own participation"
ON internal_chat_participants FOR UPDATE
USING (user_id = auth.uid());

-- Políticas RLS para mensagens
CREATE POLICY "Users can view messages from own threads"
ON internal_chat_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM internal_chat_participants
    WHERE thread_id = internal_chat_messages.thread_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages to own threads"
ON internal_chat_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM internal_chat_participants
    WHERE thread_id = internal_chat_messages.thread_id
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own messages"
ON internal_chat_messages FOR UPDATE
USING (sender_id = auth.uid());

-- Habilitar Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE internal_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE internal_chat_participants;

-- Função para encontrar ou criar thread entre dois usuários
CREATE OR REPLACE FUNCTION find_or_create_direct_thread(p_user_id UUID, p_other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id UUID;
BEGIN
  -- Procurar thread existente entre os dois usuários (1-1)
  SELECT t.id INTO v_thread_id
  FROM internal_chat_threads t
  WHERE EXISTS (
    SELECT 1 FROM internal_chat_participants p1
    WHERE p1.thread_id = t.id AND p1.user_id = p_user_id
  )
  AND EXISTS (
    SELECT 1 FROM internal_chat_participants p2
    WHERE p2.thread_id = t.id AND p2.user_id = p_other_user_id
  )
  AND (
    SELECT COUNT(*) FROM internal_chat_participants p3
    WHERE p3.thread_id = t.id
  ) = 2
  LIMIT 1;

  -- Se não existe, criar nova thread
  IF v_thread_id IS NULL THEN
    INSERT INTO internal_chat_threads (created_at, updated_at)
    VALUES (now(), now())
    RETURNING id INTO v_thread_id;

    -- Adicionar participantes
    INSERT INTO internal_chat_participants (thread_id, user_id)
    VALUES (v_thread_id, p_user_id), (v_thread_id, p_other_user_id);
  END IF;

  RETURN v_thread_id;
END;
$$;

-- Função para atualizar thread quando mensagem é enviada
CREATE OR REPLACE FUNCTION update_thread_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualizar thread com última mensagem
  UPDATE internal_chat_threads
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100),
    last_message_sender_id = NEW.sender_id,
    updated_at = now()
  WHERE id = NEW.thread_id;

  -- Incrementar unread_count para outros participantes
  UPDATE internal_chat_participants
  SET unread_count = unread_count + 1
  WHERE thread_id = NEW.thread_id
  AND user_id != NEW.sender_id;

  RETURN NEW;
END;
$$;

-- Trigger para atualizar thread
CREATE TRIGGER trigger_update_thread_on_message
AFTER INSERT ON internal_chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_thread_on_message();

-- Função para obter total de mensagens não lidas
CREATE OR REPLACE FUNCTION get_internal_chat_unread_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COALESCE(SUM(unread_count), 0) INTO v_count
  FROM internal_chat_participants
  WHERE user_id = p_user_id;
  
  RETURN v_count;
END;
$$;

-- Criar bucket para anexos do chat interno
INSERT INTO storage.buckets (id, name, public)
VALUES ('internal-chat-attachments', 'internal-chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para anexos
CREATE POLICY "Users can upload internal chat attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'internal-chat-attachments' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view internal chat attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'internal-chat-attachments'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete own internal chat attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'internal-chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);