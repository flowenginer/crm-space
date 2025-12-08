-- Corrigir permissões: apenas admin e supervisor devem ter view_all
-- SAC, vendedor, designer não podem acessar conversas de outros

-- Criar função para verificar se usuário pode acessar uma conversa específica
CREATE OR REPLACE FUNCTION public.can_access_conversation(conv_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conv_id
    AND (
      -- É o dono da conversa
      c.assigned_to = user_id
      -- OU conversa não atribuída do mesmo departamento
      OR (c.assigned_to IS NULL AND c.department_id IN (
        SELECT department_id FROM profiles WHERE id = user_id
      ))
      -- OU é admin/supervisor
      OR is_admin_or_supervisor(user_id)
    )
  )
$$;

-- Criar função para obter nome do atendente da conversa
CREATE OR REPLACE FUNCTION public.get_conversation_owner_name(conv_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.full_name
  FROM conversations c
  JOIN profiles p ON p.id = c.assigned_to
  WHERE c.id = conv_id
$$;

-- Garantir que SAC não tenha view_all (corrigir se estiver errado)
UPDATE role_definitions 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{conversations,view_all}',
  'false'::jsonb
)
WHERE role_key = 'sac';

-- Garantir que vendedor não tenha view_all
UPDATE role_definitions 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{conversations,view_all}',
  'false'::jsonb
)
WHERE role_key = 'vendedor';

-- Garantir que designer não tenha view_all
UPDATE role_definitions 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{conversations,view_all}',
  'false'::jsonb
)
WHERE role_key = 'designer';

-- Garantir que admin tenha view_all
UPDATE role_definitions 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{conversations,view_all}',
  'true'::jsonb
)
WHERE role_key = 'admin';

-- Garantir que supervisor tenha view_all
UPDATE role_definitions 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{conversations,view_all}',
  'true'::jsonb
)
WHERE role_key = 'supervisor';