-- Remover política permissiva atual
DROP POLICY IF EXISTS "Authenticated access contacts" ON public.contacts;

-- SELECT: Admins e supervisores podem ver todos os contatos
CREATE POLICY "Admins can view all contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- SELECT: Usuários comuns só veem contatos atribuídos a eles
CREATE POLICY "Users can view own assigned contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (assigned_to = auth.uid());

-- SELECT: Usuários com acesso especial podem ver todos
CREATE POLICY "Users with special access can view all contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (can_view_all_data(auth.uid()));

-- INSERT: Qualquer usuário autenticado pode criar contatos
CREATE POLICY "Authenticated users can create contacts"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Admins podem editar qualquer contato
CREATE POLICY "Admins can update all contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));

-- UPDATE: Usuários só podem editar contatos atribuídos a eles
CREATE POLICY "Users can update own assigned contacts"
ON public.contacts
FOR UPDATE
TO authenticated
USING (assigned_to = auth.uid());

-- DELETE: Apenas admins/supervisores podem deletar contatos
CREATE POLICY "Only admins can delete contacts"
ON public.contacts
FOR DELETE
TO authenticated
USING (is_admin_or_supervisor(auth.uid()));