-- Corrigir RLS para permitir que vendedores transfiram contatos/conversas
-- O problema é que as policies de UPDATE não têm WITH CHECK, causando erro
-- quando o usuário altera assigned_to para outro agente

-- ============================================
-- CONTACTS TABLE: Adicionar WITH CHECK
-- ============================================

-- Drop e recriar policy para vendedores atualizarem contatos próprios
DROP POLICY IF EXISTS "Users can update own assigned contacts" ON public.contacts;
CREATE POLICY "Users can update own assigned contacts" 
ON public.contacts 
FOR UPDATE
TO authenticated
USING (assigned_to = auth.uid())
WITH CHECK (true);  -- Permite alterar assigned_to para qualquer valor válido

-- Drop e recriar policy otimizada para permitir UPDATE de contatos via conversa ativa
DROP POLICY IF EXISTS "contacts_update_optimized" ON public.contacts;
CREATE POLICY "contacts_update_optimized" 
ON public.contacts 
FOR UPDATE
TO authenticated
USING (
  is_admin_or_supervisor(auth.uid()) OR 
  (assigned_to = auth.uid()) OR 
  (EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.contact_id = contacts.id 
    AND c.status = ANY (ARRAY['open'::text, 'pending'::text])
    AND (
      c.assigned_to = auth.uid() OR 
      (c.assigned_to IS NULL AND c.department_id = ANY(get_user_accessible_departments(auth.uid())))
    )
  ))
)
WITH CHECK (true);  -- Permite alterar qualquer campo

-- ============================================
-- CONVERSATIONS TABLE: Adicionar WITH CHECK
-- ============================================

-- Drop e recriar policy para usuários atualizarem conversas
DROP POLICY IF EXISTS "Users can update conversations" ON public.conversations;
CREATE POLICY "Users can update conversations" 
ON public.conversations 
FOR UPDATE
TO authenticated
USING (
  (assigned_to = auth.uid()) OR 
  is_admin_or_supervisor(auth.uid()) OR 
  ((assigned_to IS NULL) AND (auth.uid() IS NOT NULL)) OR 
  (department_id IN (
    SELECT user_departments.department_id
    FROM user_departments
    WHERE user_departments.user_id = auth.uid()
    UNION
    SELECT profiles.department_id
    FROM profiles
    WHERE profiles.id = auth.uid()
  ))
)
WITH CHECK (true);  -- Permite transferir para qualquer agente válido