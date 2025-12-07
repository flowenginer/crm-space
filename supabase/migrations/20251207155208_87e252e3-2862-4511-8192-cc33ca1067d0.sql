-- Adicionar permissão dashboard para admin (TRUE)
UPDATE role_definitions 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb), 
  '{dashboard}', 
  '{"view": true}'::jsonb
)
WHERE role_key = 'admin';

-- Adicionar permissão dashboard para supervisor (TRUE)
UPDATE role_definitions 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb), 
  '{dashboard}', 
  '{"view": true}'::jsonb
)
WHERE role_key = 'supervisor';

-- Adicionar permissão dashboard para vendedor (FALSE - sem acesso)
UPDATE role_definitions 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb), 
  '{dashboard}', 
  '{"view": false}'::jsonb
)
WHERE role_key = 'vendedor';

-- Adicionar permissão dashboard para designer (FALSE - sem acesso)
UPDATE role_definitions 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb), 
  '{dashboard}', 
  '{"view": false}'::jsonb
)
WHERE role_key = 'designer';

-- Adicionar permissão dashboard para SAC (TRUE - acesso para visualizar métricas)
UPDATE role_definitions 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb), 
  '{dashboard}', 
  '{"view": true}'::jsonb
)
WHERE role_key = 'sac';