-- Função para verificar se usuário pode ver anexo do email
CREATE OR REPLACE FUNCTION public.can_view_email_attachment(p_email_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    -- É recipient direto
    SELECT 1 FROM internal_email_recipients 
    WHERE email_id = p_email_id AND user_id = p_user_id
  ) OR EXISTS (
    -- É remetente
    SELECT 1 FROM internal_emails 
    WHERE id = p_email_id AND sender_id = p_user_id
  ) OR EXISTS (
    -- É membro da caixa compartilhada do e-mail
    SELECT 1 FROM internal_emails ie
    JOIN email_shared_box_members esbm ON esbm.shared_box_id = ie.shared_box_id
    WHERE ie.id = p_email_id 
    AND esbm.user_id = p_user_id 
    AND esbm.is_active = true
  );
END;
$$;

-- Atualizar política de anexos para usar nova função
DROP POLICY IF EXISTS "Recipients can view attachments" ON internal_email_attachments;
CREATE POLICY "Users can view attachments of accessible emails"
ON internal_email_attachments
FOR SELECT
USING (public.can_view_email_attachment(email_id, auth.uid()));

-- Permitir que membros de caixa compartilhada se adicionem como recipient ao claim
CREATE POLICY "Shared box members can claim emails"
ON internal_email_recipients
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM internal_emails ie
    JOIN email_shared_box_members esbm ON esbm.shared_box_id = ie.shared_box_id
    WHERE ie.id = email_id 
    AND esbm.user_id = auth.uid() 
    AND esbm.is_active = true
  )
);

-- Permitir que usuários deletem suas próprias entradas (para release)
CREATE POLICY "Users can release claimed emails"
ON internal_email_recipients
FOR DELETE
USING (user_id = auth.uid());