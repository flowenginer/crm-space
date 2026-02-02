-- Corrigir role_definitions para vendedores: garantir permissões completas de contacts
UPDATE role_definitions
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{contacts}',
  '{"view": true, "create": true, "update": true}'::jsonb
)
WHERE role_key = 'vendedor'
  AND (
    permissions IS NULL
    OR permissions->'contacts' IS NULL
    OR permissions->'contacts'->'create' IS NULL
    OR permissions->'contacts'->'create' = 'false'::jsonb
  );