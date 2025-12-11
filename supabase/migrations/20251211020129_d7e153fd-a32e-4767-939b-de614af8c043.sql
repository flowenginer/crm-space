-- 1. Criar função SECURITY DEFINER para verificar propriedade da conversa sem disparar RLS
CREATE OR REPLACE FUNCTION public.is_conversation_owner(
  _conversation_id uuid,
  _user_id uuid
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM conversations
    WHERE id = _conversation_id
      AND assigned_to = _user_id
  )
$$;

-- 2. Remover a política problemática que causa recursão
DROP POLICY IF EXISTS "Only conversation owner can share" ON shared_conversations;

-- 3. Remover a política duplicada para recriar corretamente
DROP POLICY IF EXISTS "Users can share conversations" ON shared_conversations;

-- 4. Criar nova política de INSERT usando a função SECURITY DEFINER
CREATE POLICY "Users can share conversations" 
ON shared_conversations
FOR INSERT
WITH CHECK (
  auth.uid() = shared_by 
  AND public.is_conversation_owner(conversation_id, auth.uid())
);