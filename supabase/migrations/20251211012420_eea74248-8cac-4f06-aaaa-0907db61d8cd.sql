-- Política RLS para permitir SELECT em conversas compartilhadas
CREATE POLICY "Users can view shared conversations"
ON public.conversations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM shared_conversations sc
    WHERE sc.conversation_id = conversations.id
    AND sc.shared_by != auth.uid()
    AND (
      sc.shared_with = auth.uid()
      OR sc.department_id IN (
        SELECT department_id FROM user_departments WHERE user_id = auth.uid()
      )
    )
  )
);

-- Política RLS para restringir INSERT em shared_conversations apenas ao responsável da conversa
CREATE POLICY "Only conversation owner can share"
ON public.shared_conversations
FOR INSERT
WITH CHECK (
  shared_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_id
    AND c.assigned_to = auth.uid()
  )
);

-- Política para o dono da conversa poder deletar compartilhamentos que fez
CREATE POLICY "Conversation owner can delete own shares"
ON public.shared_conversations
FOR DELETE
USING (
  shared_by = auth.uid()
);

-- Política para destinatários poderem remover compartilhamentos recebidos (deixar de seguir)
CREATE POLICY "Recipients can unfollow shared conversations"
ON public.shared_conversations
FOR DELETE
USING (
  shared_with = auth.uid()
  OR department_id IN (
    SELECT department_id FROM user_departments WHERE user_id = auth.uid()
  )
);

-- Política de SELECT para shared_conversations
CREATE POLICY "Users can view relevant shares"
ON public.shared_conversations
FOR SELECT
USING (
  shared_by = auth.uid()
  OR shared_with = auth.uid()
  OR department_id IN (
    SELECT department_id FROM user_departments WHERE user_id = auth.uid()
  )
  OR is_admin_or_supervisor(auth.uid())
);