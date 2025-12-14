-- Atualizar item do menu de E-mail para usar a permissão correta
UPDATE menu_items 
SET permission = 'internal_email.view'
WHERE href = '/internal-email';

-- Atualizar perfis existentes adicionando permissões de E-mail Interno
-- A estrutura é JSONB com categoria -> {action: boolean}

-- Supervisor: adicionar internal_email.view, internal_email.send
UPDATE role_definitions 
SET permissions = permissions || '{"internal_email": {"view": true, "send": true, "delete": false}}'::jsonb
WHERE role_key = 'supervisor';

-- Vendedor: adicionar internal_email.view, internal_email.send
UPDATE role_definitions 
SET permissions = permissions || '{"internal_email": {"view": true, "send": true, "delete": false}}'::jsonb
WHERE role_key = 'vendedor';

-- SAC: adicionar internal_email.view, internal_email.send, quotes.view
UPDATE role_definitions 
SET permissions = 
  permissions 
  || '{"internal_email": {"view": true, "send": true, "delete": false}}'::jsonb
  || '{"quotes": {"view": true, "view_all": false, "create": false, "update": false, "delete": false, "convert": false}}'::jsonb
WHERE role_key = 'sac';

-- Designer: adicionar internal_email, internal_chat
UPDATE role_definitions 
SET permissions = 
  permissions 
  || '{"internal_email": {"view": true, "send": true, "delete": false}}'::jsonb
  || '{"internal_chat": {"view": true, "send": true}}'::jsonb
WHERE role_key = 'designer';