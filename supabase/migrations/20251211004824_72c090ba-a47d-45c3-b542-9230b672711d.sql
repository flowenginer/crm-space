-- Tabela de conversas compartilhadas
CREATE TABLE public.shared_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_with UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  note TEXT,
  shared_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraint: deve ter shared_with OU department_id
  CONSTRAINT shared_target_check CHECK (
    (shared_with IS NOT NULL AND department_id IS NULL) OR
    (shared_with IS NULL AND department_id IS NOT NULL) OR
    (shared_with IS NOT NULL AND department_id IS NOT NULL)
  ),
  
  -- Evitar duplicatas
  CONSTRAINT unique_user_share UNIQUE (conversation_id, shared_by, shared_with),
  CONSTRAINT unique_department_share UNIQUE (conversation_id, shared_by, department_id)
);

-- Índices para performance
CREATE INDEX idx_shared_conversations_shared_with ON public.shared_conversations(shared_with);
CREATE INDEX idx_shared_conversations_department_id ON public.shared_conversations(department_id);
CREATE INDEX idx_shared_conversations_conversation_id ON public.shared_conversations(conversation_id);
CREATE INDEX idx_shared_conversations_shared_by ON public.shared_conversations(shared_by);

-- Enable RLS
ALTER TABLE public.shared_conversations ENABLE ROW LEVEL SECURITY;

-- Policies
-- SELECT: usuário pode ver se compartilhou, recebeu, ou está no departamento
CREATE POLICY "Users can view their shared conversations"
ON public.shared_conversations FOR SELECT
USING (
  auth.uid() = shared_by 
  OR auth.uid() = shared_with 
  OR department_id IN (SELECT department_id FROM user_departments WHERE user_id = auth.uid())
  OR is_admin_or_supervisor(auth.uid())
);

-- INSERT: usuário autenticado pode compartilhar
CREATE POLICY "Users can share conversations"
ON public.shared_conversations FOR INSERT
WITH CHECK (auth.uid() = shared_by);

-- DELETE: apenas quem compartilhou, quem recebeu (deixar de seguir), ou admin
CREATE POLICY "Users can delete shared conversations"
ON public.shared_conversations FOR DELETE
USING (
  auth.uid() = shared_by 
  OR auth.uid() = shared_with 
  OR is_admin_or_supervisor(auth.uid())
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE shared_conversations;

-- Função para contar conversas compartilhadas não lidas
CREATE OR REPLACE FUNCTION public.get_shared_conversation_count(p_user_id UUID)
RETURNS TABLE(total BIGINT, unread BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT sc.conversation_id)::BIGINT as total,
    COUNT(DISTINCT CASE WHEN c.is_unread = true THEN sc.conversation_id END)::BIGINT as unread
  FROM shared_conversations sc
  INNER JOIN conversations c ON c.id = sc.conversation_id
  WHERE (
    sc.shared_with = p_user_id
    OR sc.department_id IN (SELECT department_id FROM user_departments WHERE user_id = p_user_id)
  )
  AND sc.shared_by != p_user_id
  AND c.status IN ('open', 'pending');
END;
$$;