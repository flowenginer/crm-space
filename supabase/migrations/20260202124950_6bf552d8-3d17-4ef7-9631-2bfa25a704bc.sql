-- Atualizar permissões de reports do vendedor da conta Master
-- Adicionar view_sla para que pelo menos uma aba apareça
UPDATE role_definitions
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{reports}',
  '{
    "view": true,
    "view_sla": true,
    "view_attendance": true,
    "view_calls": true,
    "view_performance": true
  }'::jsonb
)
WHERE role_key = 'vendedor' 
  AND tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf';