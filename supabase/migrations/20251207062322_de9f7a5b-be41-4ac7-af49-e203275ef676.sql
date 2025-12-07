-- Garantir que vendedor tenha channels.view = false
UPDATE role_definitions
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{channels,view}',
  'false'::jsonb
)
WHERE role_key = 'vendedor';