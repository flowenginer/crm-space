-- Update all role_definitions to use granular settings permissions
-- This ensures consistency across all existing and future roles

-- Update Admin - full access to all settings
UPDATE role_definitions 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{settings}',
  '{
    "view": true,
    "update": true,
    "users": true,
    "departments": true,
    "channels": true,
    "fields": true,
    "tags": true,
    "close_reasons": true,
    "integrations": true
  }'::jsonb
)
WHERE role_key = 'admin';

-- Update Supervisor - only team and tags management
UPDATE role_definitions 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{settings}',
  '{
    "view": true,
    "update": false,
    "users": true,
    "departments": false,
    "channels": false,
    "fields": false,
    "tags": true,
    "close_reasons": false,
    "integrations": false
  }'::jsonb
)
WHERE role_key = 'supervisor';

-- Update Vendedor - no settings access except personal (notifications/security which don't need permission)
UPDATE role_definitions 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{settings}',
  '{
    "view": true,
    "update": false,
    "users": false,
    "departments": false,
    "channels": false,
    "fields": false,
    "tags": false,
    "close_reasons": false,
    "integrations": false
  }'::jsonb
)
WHERE role_key = 'vendedor';

-- Update SAC - no settings access
UPDATE role_definitions 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{settings}',
  '{
    "view": true,
    "update": false,
    "users": false,
    "departments": false,
    "channels": false,
    "fields": false,
    "tags": false,
    "close_reasons": false,
    "integrations": false
  }'::jsonb
)
WHERE role_key = 'sac';

-- Update Designer - no settings access
UPDATE role_definitions 
SET permissions = jsonb_set(
  COALESCE(permissions, '{}'::jsonb),
  '{settings}',
  '{
    "view": true,
    "update": false,
    "users": false,
    "departments": false,
    "channels": false,
    "fields": false,
    "tags": false,
    "close_reasons": false,
    "integrations": false
  }'::jsonb
)
WHERE role_key = 'designer';

-- Also add these permissions to permission_definitions table for UI display
INSERT INTO permission_definitions (category, permission_key, permission_name, description)
VALUES 
  ('settings', 'settings.users', 'Gerenciar Equipe', 'Visualizar e gerenciar membros da equipe'),
  ('settings', 'settings.departments', 'Gerenciar Departamentos', 'Criar e editar departamentos'),
  ('settings', 'settings.channels', 'Gerenciar Canais', 'Configurar canais de atendimento'),
  ('settings', 'settings.fields', 'Gerenciar Campos', 'Criar campos personalizados'),
  ('settings', 'settings.tags', 'Gerenciar Etiquetas', 'Criar e editar tags do sistema'),
  ('settings', 'settings.close_reasons', 'Motivos de Fechamento', 'Configurar motivos de encerramento'),
  ('settings', 'settings.integrations', 'Integrações', 'Configurar integrações externas')
ON CONFLICT (permission_key) DO NOTHING;