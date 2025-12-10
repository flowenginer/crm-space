-- =====================================================
-- OTIMIZAÇÃO DE PERFORMANCE - FASE 2: RLS
-- =====================================================
-- Substitui políticas RLS com subqueries complexas por
-- funções SECURITY DEFINER otimizadas

-- 1. FUNÇÃO: Retorna IDs de departamentos do usuário (com cache interno)
CREATE OR REPLACE FUNCTION public.get_user_accessible_departments(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT dept_id) FILTER (WHERE dept_id IS NOT NULL),
    ARRAY[]::uuid[]
  )
  FROM (
    -- Departamentos via user_departments
    SELECT department_id as dept_id FROM user_departments WHERE user_id = _user_id
    UNION
    -- Departamento principal do perfil
    SELECT department_id as dept_id FROM profiles WHERE id = _user_id AND department_id IS NOT NULL
  ) depts
$$;

-- 2. FUNÇÃO: Verifica se usuário pode acessar um contato específico
CREATE OR REPLACE FUNCTION public.can_access_contact(_contact_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    -- Caso 1: É admin/supervisor
    SELECT 1 FROM profiles WHERE id = _user_id AND role IN ('admin', 'supervisor')
  ) OR EXISTS (
    -- Caso 2: Contato está atribuído ao usuário
    SELECT 1 FROM contacts WHERE id = _contact_id AND assigned_to = _user_id
  ) OR EXISTS (
    -- Caso 3: Tem conversa ativa com o contato (atribuída ao usuário)
    SELECT 1 FROM conversations 
    WHERE contact_id = _contact_id 
    AND assigned_to = _user_id
  ) OR EXISTS (
    -- Caso 4: Conversa não atribuída no departamento do usuário
    SELECT 1 FROM conversations c
    WHERE c.contact_id = _contact_id
    AND c.assigned_to IS NULL
    AND c.department_id = ANY(get_user_accessible_departments(_user_id))
  ) OR (
    -- Caso 5: Usuário tem can_view_all_data
    can_view_all_data(_user_id)
  )
$$;

-- 3. FUNÇÃO: Verifica se usuário pode acessar uma conversa específica
CREATE OR REPLACE FUNCTION public.can_access_conversation_fast(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = _conversation_id
    AND (
      -- É admin/supervisor
      is_admin_or_supervisor(_user_id)
      -- OU está atribuída ao usuário
      OR c.assigned_to = _user_id
      -- OU não atribuída e no departamento do usuário
      OR (c.assigned_to IS NULL AND c.department_id = ANY(get_user_accessible_departments(_user_id)))
      -- OU usuário pode ver todos os dados
      OR can_view_all_data(_user_id)
    )
  )
$$;

-- 4. REMOVER POLÍTICAS ANTIGAS DE CONTACTS (as problemáticas)
DROP POLICY IF EXISTS "Users can view contacts from accessible conversations" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts from accessible conversations" ON contacts;

-- 5. CRIAR POLÍTICAS OTIMIZADAS PARA CONTACTS
-- SELECT: Usuários podem ver contatos que têm acesso
CREATE POLICY "contacts_select_optimized" ON contacts
FOR SELECT USING (
  is_admin_or_supervisor(auth.uid())
  OR assigned_to = auth.uid()
  OR can_view_all_data(auth.uid())
  OR EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.contact_id = contacts.id
    AND c.status IN ('open', 'pending')
    AND (
      c.assigned_to = auth.uid()
      OR (c.assigned_to IS NULL AND c.department_id = ANY(get_user_accessible_departments(auth.uid())))
    )
  )
);

-- UPDATE: Usuários podem atualizar contatos que têm acesso
CREATE POLICY "contacts_update_optimized" ON contacts
FOR UPDATE USING (
  is_admin_or_supervisor(auth.uid())
  OR assigned_to = auth.uid()
  OR EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.contact_id = contacts.id
    AND c.status IN ('open', 'pending')
    AND (
      c.assigned_to = auth.uid()
      OR (c.assigned_to IS NULL AND c.department_id = ANY(get_user_accessible_departments(auth.uid())))
    )
  )
);

-- 6. REMOVER POLÍTICAS ANTIGAS DE CONVERSATIONS (as problemáticas)
DROP POLICY IF EXISTS "Users can view unassigned conversations in their department" ON conversations;

-- 7. CRIAR POLÍTICA OTIMIZADA PARA CONVERSATIONS
CREATE POLICY "conversations_select_unassigned_optimized" ON conversations
FOR SELECT USING (
  assigned_to IS NULL 
  AND department_id = ANY(get_user_accessible_departments(auth.uid()))
);