-- Corrigir permissões do vendedor da conta Master (664dfcb4-5432-4c14-9838-7db14360cabf)
-- Adicionar permissões de transferência, close, e outras ações necessárias
UPDATE role_definitions
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{conversations}',
  '{
    "view": true,
    "create": true,
    "transfer": true,
    "close": true,
    "respond": true,
    "requests": false
  }'::jsonb
)
WHERE role_key = 'vendedor' 
  AND tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf';

-- Garantir que contacts tem permissões de create e update
UPDATE role_definitions
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{contacts}',
  '{
    "view": true,
    "create": true,
    "update": true
  }'::jsonb
)
WHERE role_key = 'vendedor' 
  AND tenant_id = '664dfcb4-5432-4c14-9838-7db14360cabf';