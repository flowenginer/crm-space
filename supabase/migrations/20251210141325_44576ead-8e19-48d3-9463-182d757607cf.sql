-- Remover política permissiva atual
DROP POLICY IF EXISTS "Authenticated access scheduled_messages" ON public.scheduled_messages;

-- SELECT: Admins e supervisores podem ver todos
CREATE POLICY "Admins can view all scheduled messages"
ON public.scheduled_messages
FOR SELECT
TO authenticated
USING (
  is_admin_or_supervisor(auth.uid())
);

-- SELECT: Usuários comuns só veem seus próprios agendamentos
CREATE POLICY "Users can view own scheduled messages"
ON public.scheduled_messages
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
);

-- INSERT: Usuários só podem criar com seu próprio ID
CREATE POLICY "Users can create scheduled messages"
ON public.scheduled_messages
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
);

-- UPDATE: Admins podem editar qualquer agendamento
CREATE POLICY "Admins can update all scheduled messages"
ON public.scheduled_messages
FOR UPDATE
TO authenticated
USING (
  is_admin_or_supervisor(auth.uid())
);

-- UPDATE: Usuários só podem editar seus próprios agendamentos
CREATE POLICY "Users can update own scheduled messages"
ON public.scheduled_messages
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
);

-- DELETE: Admins podem deletar qualquer agendamento
CREATE POLICY "Admins can delete all scheduled messages"
ON public.scheduled_messages
FOR DELETE
TO authenticated
USING (
  is_admin_or_supervisor(auth.uid())
);

-- DELETE: Usuários só podem deletar seus próprios agendamentos
CREATE POLICY "Users can delete own scheduled messages"
ON public.scheduled_messages
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
);