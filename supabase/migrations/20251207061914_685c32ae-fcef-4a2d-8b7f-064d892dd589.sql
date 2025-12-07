-- 1. Inserir nova permissão view_unassigned
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES ('conversations', 'view_unassigned', 'Ver Não Atribuídas', 'Visualizar conversas não atribuídas a nenhum atendente')
ON CONFLICT DO NOTHING;

-- 2. Atualizar role admin para ter view_unassigned = true
UPDATE role_definitions
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{conversations,view_unassigned}',
  'true'::jsonb
)
WHERE role_key = 'admin';

-- 3. Atualizar role gerente para ter view_unassigned = true
UPDATE role_definitions
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{conversations,view_unassigned}',
  'true'::jsonb
)
WHERE role_key = 'gerente';

-- 4. Atualizar role vendedor para ter view_unassigned = false
UPDATE role_definitions
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{conversations,view_unassigned}',
  'false'::jsonb
)
WHERE role_key = 'vendedor';